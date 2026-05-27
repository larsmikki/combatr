import { Router, type Request, type Response } from 'express'
import { storage } from '../db/storage.js'

const router = Router()

// Whole-app snapshot in one round trip.
router.get('/state', (_req: Request, res: Response) => {
  res.json(storage.getState())
})

router.get('/export', (_req: Request, res: Response) => {
  res.json(storage.getState())
})

router.post('/import', (req: Request, res: Response) => {
  storage.importAll(req.body as never)
  res.json({ ok: true })
})

export default router
