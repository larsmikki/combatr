import { Router, type Request, type Response } from 'express'
import dns from 'dns/promises'
import { logger } from '../logger.js'

const router = Router()

// We accept friendly 5e.tools URLs but actually fetch from the community
// GitHub mirror because 5e.tools is behind Cloudflare and challenges server-
// side fetches. Same file, no bot wall.
const FRONT_PREFIX  = 'https://5e.tools/data/'
const MIRROR_PREFIX = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/'
const ALLOWED_SUBPATHS = ['bestiary/', 'spells/', 'class/', 'races.json', 'backgrounds.json', 'feats.json', 'items.json', 'items-base.json']
const SEARCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\.0\.0\.0$/,
]

function resolve5eToolsUrl(input: string): string | null {
  for (const sub of ALLOWED_SUBPATHS) {
    const front = FRONT_PREFIX + sub
    const mirror = MIRROR_PREFIX + sub
    if (input === front || (sub.endsWith('/') && input.startsWith(front) && input.endsWith('.json'))) {
      return mirror + input.slice(front.length)
    }
    if (input === mirror || (sub.endsWith('/') && input.startsWith(mirror) && input.endsWith('.json'))) {
      return input
    }
  }
  return null
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs are allowed')
  const { address } = await dns.lookup(parsed.hostname)
  if (PRIVATE_RANGES.some(range => range.test(address))) throw new Error('URL resolves to a private address')
  return parsed
}

// 5e.tools compendium proxy (bestiary/spells/class/etc.)
router.get(['/proxy/bestiary', '/proxy/5etools'], async (req: Request, res: Response) => {
  const target = String(req.query.url ?? '').trim()
  if (!target) {
    logger.warn('proxy.5etools missing url', {})
    return res.status(400).json({ error: 'Missing ?url=' })
  }
  const resolved = resolve5eToolsUrl(target)
  if (!resolved) {
    logger.warn('proxy.5etools rejected (allowlist)', { target })
    return res.status(400).json({ error: `Only ${FRONT_PREFIX}{${ALLOWED_SUBPATHS.join(',')}}*.json URLs are allowed` })
  }
  const start = Date.now()
  logger.info('proxy.5etools fetching', { requested: target, resolved })
  try {
    const upstream = await fetch(resolved, { headers: { 'User-Agent': 'combatr/1.0' } })
    const text = await upstream.text()
    const ms = Date.now() - start
    const contentType = upstream.headers.get('content-type') ?? 'application/json'
    logger.info('proxy.5etools result', { resolved, status: upstream.status, contentType, bytes: text.length, ms })
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream ${upstream.status} ${upstream.statusText}: ${text.slice(0, 200)}` })
    }
    return res.status(200).type(contentType).send(text)
  } catch (e) {
    const ms = Date.now() - start
    logger.error('proxy.5etools failed', { resolved, ms, error: String(e) })
    return res.status(502).json({ error: `Proxy fetch failed: ${e instanceof Error ? e.message : String(e)}` })
  }
})

// DuckDuckGo image search (token-image picker)
router.get('/search-images', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '').trim()
  const offset = parseInt(String(req.query.offset ?? '0'), 10)
  if (!query) return res.status(400).json({ error: 'Missing ?q=' })

  const encodedQuery = encodeURIComponent(query)
  try {
    const initHtml = await fetch(`https://duckduckgo.com/?q=${encodedQuery}&iax=images&ia=images`, {
      headers: { 'User-Agent': SEARCH_USER_AGENT },
    }).then(response => response.text())
    const vqdMatch = initHtml.match(/vqd=['"]?([^'"&\s]+)/)
    if (!vqdMatch) return res.status(502).json({ error: 'Could not get DuckDuckGo session token' })

    const data = await fetch(
      `https://duckduckgo.com/i.js?q=${encodedQuery}&vqd=${encodeURIComponent(vqdMatch[1])}&o=json&s=${Number.isFinite(offset) ? offset : 0}`,
      { headers: { 'User-Agent': SEARCH_USER_AGENT, Referer: 'https://duckduckgo.com/' } },
    ).then(response => response.json() as Promise<{ results?: Array<{ thumbnail: string; image: string; title?: string }> }>)

    return res.json({
      images: (data.results ?? []).slice(0, 9).map(result => ({
        thumb: result.thumbnail,
        full: result.image,
        title: result.title ?? '',
      })),
    })
  } catch (e) {
    logger.error('image.search failed', { query, offset, error: String(e) })
    return res.status(502).json({ error: `Image search failed: ${e instanceof Error ? e.message : String(e)}` })
  }
})

// Fetch an external image and return it as a base64 data URL (SSRF-guarded)
router.get('/proxy-image-data', async (req: Request, res: Response) => {
  const target = String(req.query.url ?? '').trim()
  if (!target) return res.status(400).json({ error: 'Missing ?url=' })

  try {
    await assertPublicUrl(target)
    const upstream = await fetch(target, { headers: { 'User-Agent': SEARCH_USER_AGENT } })
    if (!upstream.ok) return res.status(502).json({ error: `Upstream ${upstream.status} ${upstream.statusText}` })
    const contentType = (upstream.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) return res.status(415).json({ error: `Unsupported image type: ${contentType}` })
    const buffer = Buffer.from(await upstream.arrayBuffer())
    return res.json({ dataUrl: `data:${contentType};base64,${buffer.toString('base64')}` })
  } catch (e) {
    logger.error('image.proxy failed', { target, error: String(e) })
    return res.status(502).json({ error: `Image fetch failed: ${e instanceof Error ? e.message : String(e)}` })
  }
})

export default router
