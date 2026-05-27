import { Router, type Request, type Response } from 'express'

type Rec = Record<string, unknown>

// Shared CRUD shape for id-keyed resources (campaigns, encounters, sessions, characters).
export interface IdResourceConfig {
  path: string
  list: () => unknown
  get: (id: string) => unknown
  put: (value: Rec) => unknown
  remove: (id: string) => boolean
  invalidMsg: string
  deleteFailStatus: number
  deleteFailMsg: string
}

export function idResourceRouter(cfg: IdResourceConfig): Router {
  const router = Router()

  router.get(cfg.path, (_req: Request, res: Response) => {
    res.json(cfg.list())
  })

  router.post(cfg.path, (req: Request, res: Response) => {
    const parsed = req.body as Rec
    if (!parsed || typeof parsed.id !== 'string') {
      return res.status(400).json({ error: cfg.invalidMsg })
    }
    res.status(201).json(cfg.put(parsed))
  })

  router.get(`${cfg.path}/:id`, (req: Request, res: Response) => {
    const found = cfg.get(req.params.id as string)
    return found ? res.json(found) : res.status(404).json({ error: 'Not found' })
  })

  router.put(`${cfg.path}/:id`, (req: Request, res: Response) => {
    const parsed = (req.body ?? {}) as Rec
    res.json(cfg.put({ ...parsed, id: req.params.id as string }))
  })

  router.delete(`${cfg.path}/:id`, (req: Request, res: Response) => {
    return cfg.remove(req.params.id as string)
      ? res.status(204).end()
      : res.status(cfg.deleteFailStatus).json({ error: cfg.deleteFailMsg })
  })

  return router
}

// Shared CRUD shape for slug-keyed resources with wipe + bulk import
// (custom monsters, spells, rule elements).
export interface SlugResourceConfig {
  path: string
  list: () => unknown
  get: (slug: string) => unknown
  put: (value: Rec) => unknown
  remove: (slug: string) => boolean
  wipe: () => unknown
  putBulk: (list: unknown[]) => unknown
  invalidMsg: string
  bulkKey: string
  bulkErrMsg: string
}

export function slugResourceRouter(cfg: SlugResourceConfig): Router {
  const router = Router()

  router.get(cfg.path, (_req: Request, res: Response) => {
    res.json(cfg.list())
  })

  router.post(cfg.path, (req: Request, res: Response) => {
    const parsed = req.body as Rec
    if (!parsed || typeof parsed.slug !== 'string') {
      return res.status(400).json({ error: cfg.invalidMsg })
    }
    res.status(201).json(cfg.put(parsed))
  })

  router.delete(cfg.path, (_req: Request, res: Response) => {
    res.json(cfg.wipe())
  })

  router.post(`${cfg.path}/bulk`, (req: Request, res: Response) => {
    const parsed = req.body as unknown
    const list = Array.isArray(parsed) ? parsed : (parsed as Rec)?.[cfg.bulkKey]
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: cfg.bulkErrMsg })
    }
    res.status(201).json(cfg.putBulk(list))
  })

  router.get(`${cfg.path}/:slug`, (req: Request, res: Response) => {
    const found = cfg.get(req.params.slug as string)
    return found ? res.json(found) : res.status(404).json({ error: 'Not found' })
  })

  router.put(`${cfg.path}/:slug`, (req: Request, res: Response) => {
    const parsed = (req.body ?? {}) as Rec
    res.json(cfg.put({ ...parsed, slug: req.params.slug as string }))
  })

  router.delete(`${cfg.path}/:slug`, (req: Request, res: Response) => {
    return cfg.remove(req.params.slug as string)
      ? res.status(204).end()
      : res.status(404).json({ error: 'Not found' })
  })

  return router
}
