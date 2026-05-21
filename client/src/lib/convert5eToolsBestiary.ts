// Converts 5etools-format bestiary JSON into Combatr Monster[] shape.
// Pure functions — no fs/network access — so this module is consumable
// by both the Node CLI (scripts/convert-rotf-bestiary.ts) and the
// browser-side Compendium importer.
//
// Inputs the user provides must come from content they have legally
// acquired; the Combatr private-import path keeps output out of the repo.

import type {
  Monster, AbilityScores, MovementSpeeds, ArmorClassEntry, SenseEntry,
  StatBlockFeature, SpellcastingBlock, CreatureSize, Ability,
} from '../types'
import { stripTags, flattenEntries, slugify, type Entry } from './5etoolsTags'

export { stripTags, slugify }

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
}

const SIZE_MAP: Record<string, CreatureSize> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan',
}

const ABILS: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function mapSize(size: unknown): CreatureSize {
  if (Array.isArray(size) && typeof size[0] === 'string') return SIZE_MAP[size[0]] ?? 'Medium'
  if (typeof size === 'string') return SIZE_MAP[size] ?? 'Medium'
  return 'Medium'
}

function mapType(t: unknown): { type: string; subtype?: string } {
  if (typeof t === 'string') return { type: t }
  if (t && typeof t === 'object') {
    const obj = t as { type?: string; tags?: Array<string | { tag: string; prefix?: string }> }
    const tags = (obj.tags ?? []).map(x => typeof x === 'string' ? x : `${x.prefix ?? ''}${x.tag}`)
    return { type: obj.type ?? 'humanoid', subtype: tags.length ? tags.join(', ') : undefined }
  }
  return { type: 'humanoid' }
}

function mapAlignment(a: unknown): string | undefined {
  if (!Array.isArray(a)) return undefined
  const codes: Record<string, string> = {
    L: 'lawful', N: 'neutral', C: 'chaotic',
    G: 'good', E: 'evil', A: 'any', U: 'unaligned',
  }
  const parts = a.map(x => {
    if (typeof x === 'string') return codes[x] ?? x.toLowerCase()
    if (x && typeof x === 'object') return JSON.stringify(x)
    return ''
  }).filter(Boolean)
  return parts.join(' ').replace(/\bneutral neutral\b/i, 'neutral').trim() || undefined
}

function mapAC(ac: unknown): ArmorClassEntry[] {
  if (!Array.isArray(ac)) return [{ value: 10 }]
  return ac.map(a => {
    if (typeof a === 'number') return { value: a }
    if (a && typeof a === 'object') {
      const obj = a as { ac: number; from?: string[]; condition?: string }
      const fromStr = obj.from?.map(stripTags).join(', ')
      const entry: ArmorClassEntry = { value: obj.ac }
      if (fromStr) entry.type = fromStr
      if (obj.condition) entry.condition = obj.condition
      return entry
    }
    return { value: 10 }
  })
}

function mapSpeed(speed: unknown): MovementSpeeds {
  if (!speed || typeof speed !== 'object') return { walk: 30 }
  const out: MovementSpeeds = {}
  for (const [k, v] of Object.entries(speed as Record<string, unknown>)) {
    if (!['walk', 'fly', 'swim', 'climb', 'burrow'].includes(k)) continue
    const key = k as keyof MovementSpeeds
    if (typeof v === 'number') out[key] = v
    else if (v && typeof v === 'object' && typeof (v as { number?: number }).number === 'number') {
      out[key] = (v as { number: number }).number
    }
  }
  if (Object.keys(out).length === 0) out.walk = 30
  return out
}

function parseSignedInt(s: unknown): number | undefined {
  if (typeof s === 'number') return s
  if (typeof s !== 'string') return undefined
  const m = s.match(/-?\d+/)
  return m ? parseInt(m[0], 10) : undefined
}

function mapSaves(save: unknown): Partial<Record<Ability, number>> | undefined {
  if (!save || typeof save !== 'object') return undefined
  const out: Partial<Record<Ability, number>> = {}
  for (const a of ABILS) {
    const v = parseSignedInt((save as Record<string, unknown>)[a])
    if (v !== undefined) out[a] = v
  }
  return Object.keys(out).length ? out : undefined
}

function mapSkills(skill: unknown): Record<string, number> | undefined {
  if (!skill || typeof skill !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(skill as Record<string, unknown>)) {
    const n = parseSignedInt(v)
    if (n !== undefined) out[k.toLowerCase()] = n
  }
  return Object.keys(out).length ? out : undefined
}

function flattenDamageList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  const out: string[] = []
  for (const v of arr) {
    if (typeof v === 'string') out.push(stripTags(v))
    else if (v && typeof v === 'object') {
      const obj = v as { immune?: unknown; resist?: unknown; vulnerable?: unknown; note?: string }
      const inner = (obj.immune ?? obj.resist ?? obj.vulnerable) as unknown
      const innerList = flattenDamageList(inner)
      const note = obj.note ? ` (${stripTags(obj.note)})` : ''
      out.push(innerList.join(', ') + note)
    }
  }
  return out
}

const SENSE_TYPE_MAP: Record<string, SenseEntry['type']> = {
  darkvision: 'darkvision',
  blindsight: 'blindsight',
  truesight: 'truesight',
  tremorsense: 'tremorsense',
}

function mapSenses(senses: unknown, passive: unknown): SenseEntry[] {
  const out: SenseEntry[] = []
  if (Array.isArray(senses)) {
    for (const s of senses) {
      if (typeof s !== 'string') continue
      const lower = s.toLowerCase()
      for (const key of Object.keys(SENSE_TYPE_MAP)) {
        if (lower.startsWith(key)) {
          const m = lower.match(/(\d+)\s*ft/)
          if (m) out.push({ type: SENSE_TYPE_MAP[key], value: parseInt(m[1], 10) })
          break
        }
      }
    }
  }
  if (typeof passive === 'number') out.push({ type: 'passivePerception', value: passive })
  return out
}

function mapLanguages(langs: unknown): string[] {
  if (!Array.isArray(langs)) return []
  return langs.map(l => typeof l === 'string' ? stripTags(l) : '').filter(Boolean)
}

interface Feature5e { name?: string; entries?: Entry[] }

function mapFeatures(arr: Feature5e[] | undefined): StatBlockFeature[] {
  if (!Array.isArray(arr)) return []
  const out: StatBlockFeature[] = []
  for (const f of arr) {
    if (!f || !f.name) continue
    const name = stripTags(f.name)
    const description = flattenEntries(f.entries)
    const feat: StatBlockFeature = { name, description }
    const rmatch = name.match(/\(Recharge\s+(\d)(?:[–—-](\d))?\)/i)
    if (rmatch) {
      const lo = parseInt(rmatch[1], 10)
      const hi = rmatch[2] ? parseInt(rmatch[2], 10) : lo
      const values: number[] = []
      for (let v = lo; v <= hi; v++) values.push(v)
      feat.recharge = { type: 'recharge', values }
    }
    out.push(feat)
  }
  return out
}

interface Spellcasting5e {
  name?: string
  ability?: Ability
  headerEntries?: Entry[]
  will?: string[]
  daily?: Record<string, string[]>
  spells?: Record<string, { slots?: number; spells?: string[] }>
}

function mapSpellcasting(sc: unknown): SpellcastingBlock | undefined {
  if (!Array.isArray(sc) || sc.length === 0) return undefined
  const first = sc[0] as Spellcasting5e
  const description = flattenEntries(first.headerEntries)
  let saveDc: number | undefined
  let attackBonus: number | undefined
  const dcMatch = description.match(/DC\s*(\d+)/i)
  if (dcMatch) saveDc = parseInt(dcMatch[1], 10)
  const atkMatch = description.match(/([+-]?\d+)\s+to hit/i)
  if (atkMatch) attackBonus = parseInt(atkMatch[1], 10)

  const atWill = (first.will ?? []).map(stripTags)
  const perDay: Array<{ slots: number; spells: string[] }> = []
  if (first.daily) {
    for (const [key, spells] of Object.entries(first.daily)) {
      const slots = parseInt(key, 10) || 1
      perDay.push({ slots, spells: (spells ?? []).map(stripTags) })
    }
  }
  const spellSlots: Array<{ level: number; slots: number; spells: string[] }> = []
  if (first.spells) {
    for (const [lvl, info] of Object.entries(first.spells)) {
      spellSlots.push({
        level: parseInt(lvl, 10) || 0,
        slots: info.slots ?? 0,
        spells: (info.spells ?? []).map(stripTags),
      })
    }
  }
  const block: SpellcastingBlock = { ability: first.ability ?? 'cha' }
  if (saveDc !== undefined) block.saveDc = saveDc
  if (attackBonus !== undefined) block.attackBonus = attackBonus
  if (description) block.description = description
  if (atWill.length) block.atWill = atWill
  if (perDay.length) block.perDay = perDay
  if (spellSlots.length) block.spellSlots = spellSlots
  return block
}

// ── Monster shape (5etools side) ─────────────────────────────────────

export interface Monster5e {
  name: string
  source?: string
  page?: number
  _copy?: unknown
  size?: unknown
  type?: unknown
  alignment?: unknown
  ac?: unknown
  hp?: { average?: number; formula?: string; special?: string }
  speed?: unknown
  str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number
  save?: unknown
  skill?: unknown
  senses?: unknown
  passive?: unknown
  immune?: unknown
  resist?: unknown
  vulnerable?: unknown
  conditionImmune?: unknown
  languages?: unknown
  cr?: unknown
  trait?: Feature5e[]
  action?: Feature5e[]
  bonus?: Feature5e[]
  reaction?: Feature5e[]
  legendary?: Feature5e[]
  legendaryHeader?: Entry[]
  legendaryActions?: number
  spellcasting?: unknown
  isNpc?: boolean
}

function crToString(cr: unknown): string {
  if (typeof cr === 'string') return cr
  if (typeof cr === 'number') return String(cr)
  if (cr && typeof cr === 'object' && typeof (cr as { cr?: string }).cr === 'string') {
    return (cr as { cr: string }).cr
  }
  return '0'
}

export interface ConvertOptions {
  sourceName?: string  // human-readable book name
  defaultTag?: string  // tag added to every imported monster (e.g. 'rotf')
}

export function convertOne(m: Monster5e, opts: ConvertOptions = {}): Monster {
  const { type, subtype } = mapType(m.type)
  const cr = crToString(m.cr)
  const xp = XP_BY_CR[cr] ?? 0

  const traits = mapFeatures(m.trait)
  const actions = mapFeatures(m.action)
  const bonusActions = mapFeatures(m.bonus)
  const reactions = mapFeatures(m.reaction)
  const legendaryOpts = mapFeatures(m.legendary)

  const legendaryHeaderText = m.legendaryHeader ? flattenEntries(m.legendaryHeader) : undefined
  const headerCountMatch = legendaryHeaderText?.match(/take (\d+) legendary actions?/i)
  const actionsPerRound = m.legendaryActions ?? (headerCountMatch ? parseInt(headerCountMatch[1], 10) : 3)

  const spellcasting = mapSpellcasting(m.spellcasting)
  const alignment = mapAlignment(m.alignment)

  const monster: Monster = {
    slug: slugify(m.name),
    name: m.name,
    size: mapSize(m.size),
    type,
    armorClass: mapAC(m.ac),
    hitPoints: {
      average: m.hp?.average ?? 1,
      formula: m.hp?.formula ?? (m.hp?.special ?? '1d1'),
    },
    speed: mapSpeed(m.speed),
    abilityScores: {
      str: m.str ?? 10, dex: m.dex ?? 10, con: m.con ?? 10,
      int: m.int ?? 10, wis: m.wis ?? 10, cha: m.cha ?? 10,
    } satisfies AbilityScores,
    senses: mapSenses(m.senses, m.passive),
    languages: mapLanguages(m.languages),
    challengeRating: cr,
    xp,
    traits,
    actions,
    source: {
      sourceId: m.source ?? 'UNKNOWN',
      sourceName: opts.sourceName ?? m.source ?? 'Private import',
      sourceType: 'PRIVATE_IMPORT',
      isRedistributable: false,
    },
  }

  if (subtype) monster.subtype = subtype
  if (alignment) monster.alignment = alignment

  const saves = mapSaves(m.save); if (saves) monster.savingThrows = saves
  const skills = mapSkills(m.skill); if (skills) monster.skills = skills

  const vuln = flattenDamageList(m.vulnerable); if (vuln.length) monster.damageVulnerabilities = vuln
  const resist = flattenDamageList(m.resist); if (resist.length) monster.damageResistances = resist
  const imm = flattenDamageList(m.immune); if (imm.length) monster.damageImmunities = imm
  const cimm = flattenDamageList(m.conditionImmune); if (cimm.length) monster.conditionImmunities = cimm

  if (bonusActions.length) monster.bonusActions = bonusActions
  if (reactions.length) monster.reactions = reactions
  if (legendaryOpts.length) {
    monster.legendaryActions = {
      actionsPerRound,
      options: legendaryOpts,
    }
    if (legendaryHeaderText) monster.legendaryActions.description = legendaryHeaderText
  }
  if (spellcasting) monster.spellcasting = spellcasting

  const tags: string[] = []
  if (m.isNpc) tags.push('npc')
  if (opts.defaultTag) tags.push(opts.defaultTag)
  if (tags.length) monster.tags = tags
  if (m.page) monster.description = `Source page: ${m.page}.`

  return monster
}

export interface ConvertResult {
  converted: Monster[]
  skipped: Array<{ name: string; page?: number; reason: string }>
}

// ── format detection + bulk conversion ───────────────────────────────

export function looksLike5eToolsBestiary(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false
  const obj = parsed as Record<string, unknown>
  if (Array.isArray(obj.monster)) return true
  if (Array.isArray(parsed)) {
    const first = (parsed as unknown[])[0] as Record<string, unknown> | undefined
    if (first && typeof first === 'object') {
      // 5etools entries use `trait`/`action`/`_copy`; Combatr uses `traits`/`actions`/`slug`.
      if ('_copy' in first) return true
      if (('trait' in first || 'action' in first) && !('traits' in first) && !('actions' in first) && !('slug' in first)) {
        return true
      }
    }
  }
  return false
}

export function convertBestiary(parsed: unknown, opts: ConvertOptions = {}): ConvertResult {
  const list: Monster5e[] = Array.isArray(parsed)
    ? (parsed as Monster5e[])
    : Array.isArray((parsed as { monster?: unknown }).monster)
      ? ((parsed as { monster: Monster5e[] }).monster)
      : []

  const converted: Monster[] = []
  const skipped: ConvertResult['skipped'] = []
  for (const m of list) {
    if (!m || !m.name) continue
    if (m._copy) {
      const base = m._copy as { name?: string; source?: string }
      skipped.push({
        name: m.name,
        page: m.page,
        reason: `_copy of "${base.name ?? '?'}" from ${base.source ?? '?'}`,
      })
      continue
    }
    try { converted.push(convertOne(m, opts)) }
    catch (err) {
      skipped.push({ name: m.name, page: m.page, reason: (err as Error).message })
    }
  }
  return { converted, skipped }
}
