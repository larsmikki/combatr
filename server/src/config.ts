import { mkdirSync } from 'fs'

export const config = {
  port: parseInt(process.env.PORT ?? '3051', 10),
  dataFile: process.env.COMBATR_DATA_FILE ?? 'data/combatr.json',
}

try { mkdirSync('data', { recursive: true }) } catch {}
