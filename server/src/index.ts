import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { storage } from './db/storage.js'
import { config } from './config.js'
import { logger } from './logger.js'

interface Response {
  status: number
  headers: Record<string, string>
  body: string | Buffer
}

const STATIC_DIR = join(process.cwd(), 'client', 'dist')
const MIME: Record<string, string> = {
  '.html':  'text/html',
  '.js':    'application/javascript',
  '.css':   'text/css',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.ico':   'image/x-icon',
  '.json':  'application/json',
  '.woff2': 'font/woff2',
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body: unknown, status = 200): Response {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}
function err(message: string, status: number): Response { return json({ error: message }, status) }
function noContent(): Response { return { status: 204, headers: {}, body: '' } }

function parseBody(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw || '{}') as Record<string, unknown> } catch { return null }
}

// We accept friendly 5e.tools URLs but actually fetch from the community
// GitHub mirror because 5e.tools is behind Cloudflare and challenges server-
// side fetches. Same file, no bot wall. Character-builder content is included
// so classes/species/backgrounds/feats/items can be privately imported.
const FRONT_PREFIX  = 'https://5e.tools/data/'
const MIRROR_PREFIX = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/'
const ALLOWED_SUBPATHS = ['bestiary/', 'spells/', 'class/', 'races.json', 'backgrounds.json', 'feats.json', 'items.json', 'items-base.json']

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

async function proxy5eTools(rawQuery: string): Promise<Response> {
  const params = new URLSearchParams(rawQuery)
  const target = params.get('url')?.trim() ?? ''
  if (!target) {
    logger.warn('proxy.5etools missing url', {})
    return err('Missing ?url=', 400)
  }
  const resolved = resolve5eToolsUrl(target)
  if (!resolved) {
    logger.warn('proxy.5etools rejected (allowlist)', { target })
    return err(`Only ${FRONT_PREFIX}{${ALLOWED_SUBPATHS.join(',')}}*.json URLs are allowed`, 400)
  }
  const start = Date.now()
  logger.info('proxy.5etools fetching', { requested: target, resolved })
  try {
    const upstream = await fetch(resolved, { headers: { 'User-Agent': 'combatr/1.0' } })
    const text = await upstream.text()
    const ms = Date.now() - start
    const contentType = upstream.headers.get('content-type') ?? 'application/json'
    logger.info('proxy.5etools result', {
      resolved, status: upstream.status, contentType, bytes: text.length, ms,
    })
    if (!upstream.ok) {
      return err(`Upstream ${upstream.status} ${upstream.statusText}: ${text.slice(0, 200)}`, 502)
    }
    return { status: 200, headers: { 'Content-Type': contentType }, body: text }
  } catch (e) {
    const ms = Date.now() - start
    logger.error('proxy.5etools failed', { resolved, ms, error: String(e) })
    return err(`Proxy fetch failed: ${e instanceof Error ? e.message : String(e)}`, 502)
  }
}

function handleRequest(method: string, url: string, body: string): Response {
  if (method === 'OPTIONS') return { status: 204, headers: { 'Content-Type': 'text/plain' }, body: '' }

  // ── Health ────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/health') return json({ status: 'ok' })

  // ── State snapshot (one round trip for the whole app) ─────────────
  if (method === 'GET' && url === '/api/state') return json(storage.getState())

  // ── Campaigns ─────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/campaigns') return json(storage.listCampaigns())
  if (method === 'POST' && url === '/api/campaigns') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.id !== 'string') return err('Invalid campaign', 400)
    return json(storage.putCampaign(parsed as never), 201)
  }
  const campMatch = url.match(/^\/api\/campaigns\/([^/]+)$/)
  if (campMatch) {
    const id = campMatch[1]
    if (method === 'GET') {
      const r = storage.getCampaign(id)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), id } as Record<string, unknown> & { id: string }
      return json(storage.putCampaign(next))
    }
    if (method === 'DELETE') {
      return storage.deleteCampaign(id) ? noContent() : err('Cannot delete (not found, or last campaign)', 400)
    }
  }

  // ── Encounters ────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/encounters') return json(storage.listEncounters())
  if (method === 'POST' && url === '/api/encounters') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.id !== 'string') return err('Invalid encounter', 400)
    return json(storage.putEncounter(parsed as never), 201)
  }
  const encMatch = url.match(/^\/api\/encounters\/([^/]+)$/)
  if (encMatch) {
    const id = encMatch[1]
    if (method === 'GET') {
      const r = storage.getEncounter(id)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), id } as Record<string, unknown> & { id: string }
      return json(storage.putEncounter(next))
    }
    if (method === 'DELETE') {
      return storage.deleteEncounter(id) ? noContent() : err('Not found', 404)
    }
  }

  // ── Sessions ──────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/sessions') return json(storage.listSessions())
  if (method === 'POST' && url === '/api/sessions') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.id !== 'string') return err('Invalid session', 400)
    return json(storage.putSession(parsed as never), 201)
  }
  const sesMatch = url.match(/^\/api\/sessions\/([^/]+)$/)
  if (sesMatch) {
    const id = sesMatch[1]
    if (method === 'GET') {
      const r = storage.getSession(id)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), id } as Record<string, unknown> & { id: string }
      return json(storage.putSession(next))
    }
    if (method === 'DELETE') {
      return storage.deleteSession(id) ? noContent() : err('Not found', 404)
    }
  }

  // ── Characters ─────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/characters') return json(storage.listCharacters())
  if (method === 'POST' && url === '/api/characters') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.id !== 'string') return err('Invalid character', 400)
    return json(storage.putCharacter(parsed as never), 201)
  }
  const charMatch = url.match(/^\/api\/characters\/([^/]+)$/)
  if (charMatch) {
    const id = charMatch[1]
    if (method === 'GET') {
      const r = storage.getCharacter(id)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), id } as Record<string, unknown> & { id: string }
      return json(storage.putCharacter(next))
    }
    if (method === 'DELETE') {
      return storage.deleteCharacter(id) ? noContent() : err('Not found', 404)
    }
  }

  // ── Custom monsters ───────────────────────────────────────────────
  if (method === 'GET' && url === '/api/monsters') return json(storage.listCustomMonsters())
  if (method === 'POST' && url === '/api/monsters') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.slug !== 'string') return err('Invalid monster (missing slug)', 400)
    return json(storage.putCustomMonster(parsed as never), 201)
  }
  if (method === 'DELETE' && url === '/api/monsters') {
    return json(storage.wipeCustomMonsters())
  }
  if (method === 'POST' && url === '/api/monsters/bulk') {
    const parsed = parseBody(body)
    const list = Array.isArray(parsed) ? parsed : (parsed?.monsters as unknown)
    if (!Array.isArray(list)) return err('Expected an array of monsters or { monsters: [...] }', 400)
    return json(storage.putCustomMonstersBulk(list as never), 201)
  }

  // ── Custom spells (mirrors monsters) ──────────────────────────────
  if (method === 'GET' && url === '/api/spells') return json(storage.listCustomSpells())
  if (method === 'POST' && url === '/api/spells') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.slug !== 'string') return err('Invalid spell (missing slug)', 400)
    return json(storage.putCustomSpell(parsed as never), 201)
  }
  if (method === 'DELETE' && url === '/api/spells') {
    return json(storage.wipeCustomSpells())
  }
  if (method === 'POST' && url === '/api/spells/bulk') {
    const parsed = parseBody(body)
    const list = Array.isArray(parsed) ? parsed : (parsed?.spells as unknown)
    if (!Array.isArray(list)) return err('Expected an array of spells or { spells: [...] }', 400)
    return json(storage.putCustomSpellsBulk(list as never), 201)
  }

  // ── Custom character rule elements ─────────────────────────────────────
  if (method === 'GET' && url === '/api/rules') return json(storage.listCustomRuleElements())
  if (method === 'POST' && url === '/api/rules') {
    const parsed = parseBody(body)
    if (!parsed || typeof parsed.slug !== 'string') return err('Invalid rule element (missing slug)', 400)
    return json(storage.putCustomRuleElement(parsed as never), 201)
  }
  if (method === 'DELETE' && url === '/api/rules') {
    return json(storage.wipeCustomRuleElements())
  }
  if (method === 'POST' && url === '/api/rules/bulk') {
    const parsed = parseBody(body)
    const list = Array.isArray(parsed) ? parsed : (parsed?.rules as unknown)
    if (!Array.isArray(list)) return err('Expected an array of rules or { rules: [...] }', 400)
    return json(storage.putCustomRuleElementsBulk(list as never), 201)
  }
  const ruleMatch = url.match(/^\/api\/rules\/([^/]+)$/)
  if (ruleMatch) {
    const slug = ruleMatch[1]
    if (method === 'GET') {
      const r = storage.getCustomRuleElement(slug)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), slug } as Record<string, unknown> & { slug: string }
      return json(storage.putCustomRuleElement(next))
    }
    if (method === 'DELETE') {
      return storage.deleteCustomRuleElement(slug) ? noContent() : err('Not found', 404)
    }
  }
  const spellMatch = url.match(/^\/api\/spells\/([^/]+)$/)
  if (spellMatch) {
    const slug = spellMatch[1]
    if (method === 'GET') {
      const r = storage.getCustomSpell(slug)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), slug } as Record<string, unknown> & { slug: string }
      return json(storage.putCustomSpell(next))
    }
    if (method === 'DELETE') {
      return storage.deleteCustomSpell(slug) ? noContent() : err('Not found', 404)
    }
  }
  const monMatch = url.match(/^\/api\/monsters\/([^/]+)$/)
  if (monMatch) {
    const slug = monMatch[1]
    if (method === 'GET') {
      const r = storage.getCustomMonster(slug)
      return r ? json(r) : err('Not found', 404)
    }
    if (method === 'PUT') {
      const parsed = parseBody(body)
      if (!parsed) return err('Invalid JSON', 400)
      const next = { ...(parsed as object), slug } as Record<string, unknown> & { slug: string }
      return json(storage.putCustomMonster(next))
    }
    if (method === 'DELETE') {
      return storage.deleteCustomMonster(slug) ? noContent() : err('Not found', 404)
    }
  }

  // ── Import / Export ───────────────────────────────────────────────
  if (method === 'GET' && url === '/api/export') return json(storage.getState())
  if (method === 'POST' && url === '/api/import') {
    const parsed = parseBody(body)
    if (!parsed) return err('Invalid JSON', 400)
    storage.importAll(parsed as never)
    return json({ ok: true })
  }

  // ── Static (prod) ─────────────────────────────────────────────────
  if (!url.startsWith('/api/') && process.env.NODE_ENV === 'production' && existsSync(STATIC_DIR)) {
    const urlPath = url.split('?')[0] ?? '/'
    const filePath = join(STATIC_DIR, urlPath === '/' ? 'index.html' : urlPath)
    const file = existsSync(filePath) ? filePath : join(STATIC_DIR, 'index.html')
    const mime = MIME[extname(file)] ?? 'application/octet-stream'
    const isHashed = urlPath.startsWith('/assets/')
    const cacheControl = isHashed ? 'public, max-age=31536000, immutable' : 'no-cache'
    return { status: 200, headers: { 'Content-Type': mime, 'Cache-Control': cacheControl }, body: readFileSync(file) }
  }

  return err('Not found', 404)
}

function startServer() {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    const start = Date.now()

    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString()
      const method = req.method ?? 'GET'
      const url = req.url ?? '/'
      const [path, rawQuery = ''] = url.split('?')
      let response: Response

      try {
        if (method === 'GET' && (path === '/api/proxy/bestiary' || path === '/api/proxy/5etools')) {
          response = await proxy5eTools(rawQuery)
        } else {
          response = handleRequest(method, path ?? '/', body)
        }
      } catch (e) {
        logger.error('Unhandled error', { error: String(e) })
        response = err('Internal server error', 500)
      }

      res.writeHead(response.status, { ...CORS_HEADERS, ...response.headers })
      res.end(response.body)

      // Suppress the chatty polling endpoints (/api/state, /api/health) when
      // they succeed — they fire on every page mount and drown out the log.
      // Still log them if they fail.
      const isQuiet = method === 'GET'
        && /^\/api\/(state|health)(\?|$)/.test(path ?? '')
        && response.status < 400
      if (!isQuiet) {
        logger.info('request', { method, url, status: response.status, ms: Date.now() - start })
      }
    })
  })

  server.listen(config.port, '0.0.0.0', () => {
    logger.info('Combatr server started', { port: config.port })
  })
}

startServer()
