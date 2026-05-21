// Fetches SRD 5.1 monsters from the Open5e API (document__slug=wotc-srd)
// and regenerates client/src/data/monsters.ts.
//
// Open5e wotc-srd content is SRD 5.1 by Wizards of the Coast LLC, released
// under CC BY 4.0 — redistributable with attribution.
//
// Run: npx tsx scripts/import-srd-monsters.ts

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

interface Open5eAction {
  name: string
  desc: string
  attack_bonus?: number
  damage_dice?: string
  damage_bonus?: number
}

interface Open5eMonster {
  slug: string
  name: string
  size: string
  type: string
  subtype?: string
  group?: string | null
  alignment?: string
  armor_class: number
  armor_desc?: string | null
  hit_points: number
  hit_dice: string
  speed: Record<string, number | boolean>
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  strength_save?: number | null
  dexterity_save?: number | null
  constitution_save?: number | null
  intelligence_save?: number | null
  wisdom_save?: number | null
  charisma_save?: number | null
  skills?: Record<string, number>
  damage_vulnerabilities?: string
  damage_resistances?: string
  damage_immunities?: string
  condition_immunities?: string
  senses?: string
  languages?: string
  challenge_rating: string
  actions?: Open5eAction[] | string
  reactions?: Open5eAction[] | string
  legendary_desc?: string
  legendary_actions?: Open5eAction[] | string
  special_abilities?: Open5eAction[] | string
  document__slug: string
}
interface Open5ePage<T> { count: number; next: string | null; results: T[] }

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
}

const SIZES = new Set(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'])

function csv(s: string | undefined | null): string[] {
  if (!s) return []
  return s.split(/,\s*/).map(x => x.trim()).filter(Boolean)
}

const SENSE_KEYS = ['darkvision', 'blindsight', 'truesight', 'tremorsense'] as const
function parseSenses(s: string | undefined): Array<{ type: string; value: number }> {
  if (!s) return []
  const out: Array<{ type: string; value: number }> = []
  for (const part of s.split(/,\s*/)) {
    const lower = part.toLowerCase()
    const m = lower.match(/(\d+)\s*ft/)
    if (lower.startsWith('passive perception') && m) {
      out.push({ type: 'passivePerception', value: parseInt(m[1], 10) })
      continue
    }
    for (const key of SENSE_KEYS) {
      if (lower.startsWith(key) && m) {
        out.push({ type: key, value: parseInt(m[1], 10) })
        break
      }
    }
  }
  return out
}

function parseSpeed(speed: Record<string, number | boolean> | undefined): Record<string, number> {
  if (!speed) return { walk: 30 }
  const out: Record<string, number> = {}
  for (const k of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
    const v = speed[k]
    if (typeof v === 'number') out[k] = v
  }
  if (Object.keys(out).length === 0) out.walk = 30
  return out
}

function parseFeatures(arr: Open5eAction[] | string | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(arr)) return []
  return arr.map(a => {
    const feat: Record<string, unknown> = {
      name: (a.name ?? '').trim(),
      description: (a.desc ?? '').trim(),
    }
    if (typeof a.attack_bonus === 'number') feat.attackBonus = a.attack_bonus
    // Recharge detection from name suffix like "(Recharge 5-6)" or "(Recharge 6)".
    const rmatch = feat.name && typeof feat.name === 'string'
      ? feat.name.match(/\(Recharge\s+(\d)(?:[–—-](\d))?\)/i)
      : null
    if (rmatch) {
      const lo = parseInt(rmatch[1], 10)
      const hi = rmatch[2] ? parseInt(rmatch[2], 10) : lo
      const values: number[] = []
      for (let v = lo; v <= hi; v++) values.push(v)
      feat.recharge = { type: 'recharge', values }
    }
    return feat
  })
}

function ucFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function convert(m: Open5eMonster): Record<string, unknown> {
  const cr = (m.challenge_rating ?? '0').toString()
  const xp = XP_BY_CR[cr] ?? 0

  const size = ucFirst((m.size ?? 'Medium').trim())
  const safeSize = SIZES.has(size) ? size : 'Medium'

  const out: Record<string, unknown> = {
    slug: m.slug,
    name: m.name,
    size: safeSize,
    type: (m.type ?? '').toLowerCase().trim() || 'humanoid',
    armorClass: [{ value: m.armor_class, type: m.armor_desc ? m.armor_desc.trim() : undefined }],
    hitPoints: { average: m.hit_points, formula: m.hit_dice ?? '' },
    speed: parseSpeed(m.speed),
    abilityScores: {
      str: m.strength, dex: m.dexterity, con: m.constitution,
      int: m.intelligence, wis: m.wisdom, cha: m.charisma,
    },
    senses: parseSenses(m.senses),
    languages: csv(m.languages),
    challengeRating: cr,
    xp,
    traits: parseFeatures(m.special_abilities),
    actions: parseFeatures(m.actions),
  }

  if (m.subtype && m.subtype.trim()) out.subtype = m.subtype.trim()
  if (m.alignment) out.alignment = m.alignment.trim()

  const saves: Record<string, number> = {}
  if (typeof m.strength_save === 'number') saves.str = m.strength_save
  if (typeof m.dexterity_save === 'number') saves.dex = m.dexterity_save
  if (typeof m.constitution_save === 'number') saves.con = m.constitution_save
  if (typeof m.intelligence_save === 'number') saves.int = m.intelligence_save
  if (typeof m.wisdom_save === 'number') saves.wis = m.wisdom_save
  if (typeof m.charisma_save === 'number') saves.cha = m.charisma_save
  if (Object.keys(saves).length) out.savingThrows = saves

  if (m.skills && Object.keys(m.skills).length) {
    const skills: Record<string, number> = {}
    for (const [k, v] of Object.entries(m.skills)) {
      if (typeof v === 'number') skills[k.toLowerCase()] = v
    }
    out.skills = skills
  }

  const vuln = csv(m.damage_vulnerabilities); if (vuln.length) out.damageVulnerabilities = vuln
  const resist = csv(m.damage_resistances); if (resist.length) out.damageResistances = resist
  const imm = csv(m.damage_immunities); if (imm.length) out.damageImmunities = imm
  const cimm = csv(m.condition_immunities); if (cimm.length) out.conditionImmunities = cimm

  const reactions = parseFeatures(m.reactions); if (reactions.length) out.reactions = reactions
  const legendaryOpts = parseFeatures(m.legendary_actions)
  if (legendaryOpts.length) {
    const legendary: Record<string, unknown> = { actionsPerRound: 3, options: legendaryOpts }
    if (m.legendary_desc) legendary.description = m.legendary_desc.trim()
    out.legendaryActions = legendary
  }

  return out
}

// Strip the `source` field — it's re-attached at module load — to keep the
// generated file compact.
function stripSource(o: Record<string, unknown>): Record<string, unknown> {
  // No source field added in convert(); this is a no-op stub for symmetry
  // with the spell/item generators.
  return o
}

async function fetchAll(): Promise<Open5eMonster[]> {
  const collected: Open5eMonster[] = []
  let url: string | null =
    'https://api.open5e.com/v1/monsters/?document__slug=wotc-srd&limit=200&ordering=slug'
  while (url) {
    process.stdout.write(`  → ${url}\n`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Open5e ${res.status} ${res.statusText}`)
    const page = await res.json() as Open5ePage<Open5eMonster>
    collected.push(...page.results)
    url = page.next
  }
  return collected
}

function emit(monsters: Array<Record<string, unknown>>): string {
  return `// AUTO-GENERATED by scripts/import-srd-monsters.ts — do not edit by hand.
// Source: Open5e (https://api.open5e.com/v1/monsters/?document__slug=wotc-srd).
// Content: System Reference Document 5.1 by Wizards of the Coast LLC,
// released under the Creative Commons Attribution 4.0 International License.
// https://creativecommons.org/licenses/by/4.0/

import type { Monster, SourceMetadata } from '@/types'

export const SRD_SOURCE: SourceMetadata = {
  sourceId: 'SRD_5_1',
  sourceName: 'System Reference Document 5.1',
  sourceType: 'SRD_5_1_CC',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attributionText:
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available under the CC BY 4.0 license.',
  isRedistributable: true,
}

type RawMonster = Omit<Monster, 'source'>

const RAW: RawMonster[] = ${JSON.stringify(monsters, null, 2)}

export const MONSTERS: Monster[] = RAW.map(m => ({ ...m, source: SRD_SOURCE }))
`
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const outPath = join(here, '..', 'client', 'src', 'data', 'monsters.ts')

  console.log('Fetching SRD monsters from Open5e…')
  const raw = await fetchAll()
  console.log(`  ${raw.length} entries received.`)

  const monsters = raw.map(convert).map(stripSource)
    .sort((a, b) => String(a.slug).localeCompare(String(b.slug)))

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, emit(monsters), 'utf-8')
  console.log(`Wrote ${monsters.length} monsters → ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
