// Validate monsters-manual.json against the Monster schema.
// Run: npx tsx scripts/validate-mm.ts

import { readFileSync } from 'fs'

const REQUIRED = [
  'slug', 'name', 'size', 'type',
  'armorClass', 'hitPoints', 'speed', 'abilityScores',
  'senses', 'languages', 'challengeRating', 'xp',
  'traits', 'actions', 'source',
] as const

const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const SIZES = new Set(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'])
const SENSE_TYPES = new Set(['darkvision', 'blindsight', 'truesight', 'tremorsense', 'passivePerception'])

interface Issue { slug: string; field: string; problem: string; sample?: unknown }

function isObj(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function validate(m: Record<string, unknown>, idx: number): Issue[] {
  const issues: Issue[] = []
  const slug = typeof m.slug === 'string' ? m.slug : `<#${idx}>`
  const push = (field: string, problem: string, sample?: unknown) =>
    issues.push({ slug, field, problem, sample })

  for (const r of REQUIRED) {
    if (!(r in m)) push(r, 'missing')
  }
  if (typeof m.slug !== 'string' || !/^[a-z0-9-]+$/.test(m.slug ?? '')) push('slug', 'not lowercase-hyphenated', m.slug)
  if (typeof m.name !== 'string' || !m.name) push('name', 'missing or non-string')
  if (typeof m.size === 'string' && !SIZES.has(m.size)) push('size', 'not in enum', m.size)

  // Ability scores must be nested under abilityScores
  if ('str' in m && !('abilityScores' in m)) {
    push('abilityScores', 'ability scores at top level instead of nested', { str: m.str })
  }
  if (isObj(m.abilityScores)) {
    for (const a of ABILS) {
      if (typeof (m.abilityScores as Record<string, unknown>)[a] !== 'number')
        push(`abilityScores.${a}`, 'missing or non-number')
    }
  } else if ('abilityScores' in m) {
    push('abilityScores', 'not an object')
  }

  // armorClass: array of { value, type? }
  if (Array.isArray(m.armorClass)) {
    m.armorClass.forEach((ac, i) => {
      if (!isObj(ac) || typeof ac.value !== 'number')
        push(`armorClass[${i}]`, 'value missing or non-number', ac)
    })
  } else if ('armorClass' in m) {
    push('armorClass', 'not an array')
  }

  // hitPoints
  if (isObj(m.hitPoints)) {
    if (typeof m.hitPoints.average !== 'number') push('hitPoints.average', 'missing/non-number')
    if (typeof m.hitPoints.formula !== 'string') push('hitPoints.formula', 'missing/non-string')
  }

  // speed
  if (isObj(m.speed)) {
    for (const k of Object.keys(m.speed)) {
      if (!['walk','fly','swim','climb','burrow'].includes(k))
        push(`speed.${k}`, 'unknown movement mode', m.speed[k])
      else if (typeof (m.speed as Record<string, unknown>)[k] !== 'number')
        push(`speed.${k}`, 'non-number', (m.speed as Record<string, unknown>)[k])
    }
  }

  // senses
  if (Array.isArray(m.senses)) {
    m.senses.forEach((s, i) => {
      if (!isObj(s) || typeof s.type !== 'string' || typeof s.value !== 'number')
        push(`senses[${i}]`, 'bad shape', s)
      else if (!SENSE_TYPES.has(s.type))
        push(`senses[${i}].type`, 'unknown sense type', s.type)
    })
  }

  // languages: string[]
  if (!Array.isArray(m.languages)) push('languages', 'not an array')

  // CR / XP
  if (typeof m.challengeRating !== 'string') push('challengeRating', 'must be string')
  if (typeof m.xp !== 'number') push('xp', 'missing or non-number')

  // traits / actions: arrays of features
  for (const k of ['traits','actions','bonusActions','reactions'] as const) {
    if (k in m && !Array.isArray(m[k])) push(k, 'not an array')
    if (Array.isArray(m[k])) {
      ;(m[k] as unknown[]).forEach((f, i) => {
        if (!isObj(f) || typeof f.name !== 'string' || typeof f.description !== 'string')
          push(`${k}[${i}]`, 'missing name/description', f)
        if (isObj(f) && Array.isArray(f.damageParts)) {
          (f.damageParts as unknown[]).forEach((p, pi) => {
            if (!isObj(p) || typeof p.formula !== 'string' || typeof p.damageType !== 'string')
              push(`${k}[${i}].damageParts[${pi}]`, 'bad shape', p)
          })
        }
      })
    }
  }

  // Flag unknown top-level fields (schema drift)
  const KNOWN = new Set([
    ...REQUIRED,
    'subtype', 'alignment', 'savingThrows', 'skills',
    'damageVulnerabilities', 'damageResistances', 'damageImmunities', 'conditionImmunities',
    'bonusActions', 'reactions', 'legendaryActions', 'mythicActions',
    'lair', 'spellcasting', 'gear', 'role', 'tags', 'description',
  ])
  for (const k of Object.keys(m)) if (!KNOWN.has(k)) push(k, 'unknown field (not in schema)', m[k])

  return issues
}

const inputPath = process.argv[2] ?? 'monsters-mm.json'
const raw = readFileSync(inputPath, 'utf-8')
const data = JSON.parse(raw) as unknown
if (!Array.isArray(data)) { console.error('Top-level is not an array.'); process.exit(1) }

const monsters = data as Record<string, unknown>[]
console.log(`Loaded ${monsters.length} entries.\n`)

const byField = new Map<string, number>()
const examples = new Map<string, Issue>()
const allIssues: Issue[] = []

for (let i = 0; i < monsters.length; i++) {
  const issues = validate(monsters[i], i)
  for (const iss of issues) {
    byField.set(iss.field, (byField.get(iss.field) ?? 0) + 1)
    if (!examples.has(iss.field)) examples.set(iss.field, iss)
    allIssues.push(iss)
  }
}

console.log(`Total issues: ${allIssues.length}`)
console.log(`Monsters with at least one issue: ${new Set(allIssues.map(i => i.slug)).size}/${monsters.length}\n`)

const sorted = [...byField.entries()].sort((a, b) => b[1] - a[1])
console.log('Issue counts by field:')
for (const [field, count] of sorted) {
  const ex = examples.get(field)!
  const sample = ex.sample !== undefined ? `  e.g. ${ex.slug}: ${JSON.stringify(ex.sample).slice(0, 120)}` : `  e.g. ${ex.slug}`
  console.log(`  ${count.toString().padStart(4)} × ${field.padEnd(28)} — ${ex.problem}`)
  console.log(sample)
}

// Sample first entry to show shape drift
console.log('\nFirst entry top-level keys:')
console.log('  ' + Object.keys(monsters[0]).join(', '))
