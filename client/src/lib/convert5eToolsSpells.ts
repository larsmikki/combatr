// Converts 5etools-format spell JSON into Combatr Spell[] shape.
// Pure functions — no fs/network access — consumable by both the Compendium
// UI and any future Node script.
//
// 5etools puts per-source spells in /data/spells/spells-{src}.json with a
// top-level { spell: [...] } array. Field shape differs significantly from
// the bestiary schema.

import type { Spell } from '../types'
import { stripTags, flattenEntries, slugify, type Entry } from './5etoolsTags'

const SCHOOL_MAP: Record<string, string> = {
  A: 'abjuration',
  C: 'conjuration',
  D: 'divination',
  E: 'enchantment',
  V: 'evocation',
  I: 'illusion',
  N: 'necromancy',
  T: 'transmutation',
  P: 'psionic', // rarely used
}

// ── time / casting time ──────────────────────────────────────────────

interface Time5e { number: number; unit: string; condition?: string }

function mapCastingTime(time: unknown): string {
  if (!Array.isArray(time) || time.length === 0) return '1 action'
  const parts: string[] = []
  for (const t of time as Time5e[]) {
    if (!t || typeof t.number !== 'number') continue
    const unit = t.unit ?? 'action'
    const plural = t.number !== 1 && !/s$/.test(unit) ? `${unit}s` : unit
    let s = `${t.number} ${plural}`
    if (t.condition) s += ` (${stripTags(t.condition)})`
    parts.push(s)
  }
  return parts.join(' or ') || '1 action'
}

// ── range ────────────────────────────────────────────────────────────

interface Range5e {
  type?: string
  distance?: { type?: string; amount?: number }
}

function mapRange(range: unknown): string {
  if (!range || typeof range !== 'object') return ''
  const r = range as Range5e
  const dist = r.distance
  const distType = dist?.type ?? ''
  const amount = dist?.amount

  // Self / Touch / Sight / Unlimited / etc.
  if (distType === 'self')      return 'Self'
  if (distType === 'touch')     return 'Touch'
  if (distType === 'sight')     return 'Sight'
  if (distType === 'unlimited') return 'Unlimited'
  if (distType === 'special')   return 'Special'

  const unit = distType === 'miles' ? (amount === 1 ? 'mile' : 'miles')
             : distType === 'feet'  ? 'feet'
             : distType

  const measure = (amount !== undefined && unit) ? `${amount} ${unit}` : ''

  switch (r.type) {
    case 'point':       return measure || 'Special'
    case 'radius':      return `Self (${measure} radius)`
    case 'sphere':      return measure ? `${measure}-radius sphere` : 'Sphere'
    case 'cone':        return `Self (${measure} cone)`
    case 'line':        return `Self (${measure} line)`
    case 'cube':        return `Self (${measure} cube)`
    case 'hemisphere':  return `Self (${measure} hemisphere)`
    case 'special':     return 'Special'
    default:            return measure || 'Special'
  }
}

// ── components ───────────────────────────────────────────────────────

interface Components5e {
  v?: boolean
  s?: boolean
  m?: boolean | string | { text?: string; cost?: number; consume?: boolean }
  r?: boolean // royalty (UA)
}

function mapComponents(comp: unknown): { components: string; material?: string } {
  if (!comp || typeof comp !== 'object') return { components: '' }
  const c = comp as Components5e
  const tokens: string[] = []
  if (c.v) tokens.push('V')
  if (c.s) tokens.push('S')

  let material: string | undefined
  if (c.m) {
    tokens.push('M')
    if (typeof c.m === 'string') material = stripTags(c.m)
    else if (typeof c.m === 'object' && c.m && typeof c.m.text === 'string') {
      material = stripTags(c.m.text)
    }
  }
  return { components: tokens.join(', '), material }
}

// ── duration / concentration / ritual ────────────────────────────────

interface Duration5e {
  type?: string
  duration?: { type?: string; amount?: number; upTo?: boolean }
  concentration?: boolean
  ends?: string[]
}

function mapDuration(duration: unknown): { duration: string; concentration: boolean } {
  if (!Array.isArray(duration) || duration.length === 0) return { duration: 'Instantaneous', concentration: false }
  const parts: string[] = []
  let concentration = false
  for (const d of duration as Duration5e[]) {
    if (!d) continue
    if (d.concentration) concentration = true
    if (d.type === 'instant')   { parts.push('Instantaneous'); continue }
    if (d.type === 'permanent') { parts.push('Until dispelled'); continue }
    if (d.type === 'special')   { parts.push('Special'); continue }
    if (d.type === 'timed' && d.duration) {
      const amount = d.duration.amount ?? 0
      const unit = d.duration.type ?? ''
      const plural = amount !== 1 && !/s$/.test(unit) ? `${unit}s` : unit
      const base = `${amount} ${plural}`
      parts.push(d.duration.upTo ? `up to ${base}` : base)
      continue
    }
  }
  let durationStr = parts.join(' or ') || 'Instantaneous'
  if (concentration) durationStr = `Concentration, ${durationStr}`
  return { duration: durationStr, concentration }
}

// ── classes ──────────────────────────────────────────────────────────

interface Classes5e {
  fromClassList?: Array<{ name: string; source?: string }>
  fromClassListVariant?: Array<{ name: string; source?: string }>
  fromSubclass?: Array<{ class?: { name: string }; subclass?: { name: string } }>
}

function mapClasses(classes: unknown): string[] {
  if (!classes || typeof classes !== 'object') return []
  const c = classes as Classes5e
  const set = new Set<string>()
  for (const cls of c.fromClassList ?? []) if (cls?.name) set.add(cls.name)
  for (const cls of c.fromClassListVariant ?? []) if (cls?.name) set.add(cls.name)
  return [...set].sort()
}

// ── Spell shape (5etools side) ───────────────────────────────────────

export interface Spell5e {
  name: string
  source?: string
  page?: number
  level: number
  school: string
  time?: Time5e[]
  range?: Range5e
  components?: Components5e
  duration?: Duration5e[]
  meta?: { ritual?: boolean; concentration?: boolean }
  entries?: Entry[]
  entriesHigherLevel?: Entry[]
  classes?: Classes5e
}

export interface ConvertOptions {
  sourceName?: string
  defaultTag?: string  // currently unused — Spell type doesn't carry tags
}

export function convertOne(s: Spell5e, opts: ConvertOptions = {}): Spell {
  const components = mapComponents(s.components)
  const { duration, concentration } = mapDuration(s.duration)
  const ritual = Boolean(s.meta?.ritual)

  const description = flattenEntries(s.entries)
  const higherLevel = flattenEntries(s.entriesHigherLevel) || undefined

  const out: Spell = {
    slug: slugify(s.name),
    name: s.name,
    level: typeof s.level === 'number' ? s.level : 0,
    school: SCHOOL_MAP[s.school?.toUpperCase()] ?? (s.school ?? '').toLowerCase(),
    castingTime: mapCastingTime(s.time),
    range: mapRange(s.range),
    components: components.components,
    duration,
    concentration,
    ritual,
    description,
    classes: mapClasses(s.classes),
    source: {
      sourceId: s.source ?? 'UNKNOWN',
      sourceName: opts.sourceName ?? s.source ?? 'Private import',
      sourceType: 'PRIVATE_IMPORT',
      isRedistributable: false,
    },
  }
  if (components.material) out.material = components.material
  if (higherLevel) out.higherLevel = higherLevel
  return out
}

export interface ConvertResult {
  converted: Spell[]
  skipped: Array<{ name: string; page?: number; reason: string }>
}

export function looksLike5eToolsSpellbook(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false
  const obj = parsed as Record<string, unknown>
  if (Array.isArray(obj.spell)) return true
  if (Array.isArray(parsed)) {
    const first = (parsed as unknown[])[0] as Record<string, unknown> | undefined
    if (first && typeof first === 'object') {
      // 5etools spells have `level` (number) + `school` (single char) + `time`/`range`/`components`
      // Combatr spells have `slug` + `castingTime`.
      if ('castingTime' in first || 'slug' in first) return false
      if ('level' in first && 'school' in first && ('time' in first || 'range' in first)) return true
    }
  }
  return false
}

export function convertSpellbook(parsed: unknown, opts: ConvertOptions = {}): ConvertResult {
  const list: Spell5e[] = Array.isArray(parsed)
    ? (parsed as Spell5e[])
    : Array.isArray((parsed as { spell?: unknown }).spell)
      ? ((parsed as { spell: Spell5e[] }).spell)
      : []

  const converted: Spell[] = []
  const skipped: ConvertResult['skipped'] = []
  for (const s of list) {
    if (!s || !s.name) continue
    try { converted.push(convertOne(s, opts)) }
    catch (err) {
      skipped.push({ name: s.name, page: s.page, reason: (err as Error).message })
    }
  }
  return { converted, skipped }
}
