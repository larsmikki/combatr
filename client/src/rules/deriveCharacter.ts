import type {
  Ability, AbilityScores, CharacterAttack, CharacterSheet, CharacterSpellcasting,
  DerivedCharacter, Grant, MovementSpeeds, RuleChoice, RuleElement,
} from '@/types'
import { ITEMS } from '@/data/items'

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SKILL_ABILITIES: Record<string, Ability> = {
  acrobatics: 'dex',
  'animal handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight of hand': 'dex',
  stealth: 'dex',
  survival: 'wis',
}

const FULL_CASTER = new Set(['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard'])
const HALF_CASTER = new Set(['Paladin', 'Ranger'])

const FULL_CASTER_SLOTS: number[][] = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

function emptyScores(n = 0): AbilityScores {
  return { str: n, dex: n, con: n, int: n, wis: n, cha: n }
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function proficiencyBonus(level: number): number {
  return Math.max(2, Math.ceil(Math.max(1, level) / 4) + 1)
}

function applyGrant(
  grant: Grant,
  scores: AbilityScores,
  proficiencies: { saves: Set<Ability>; skills: Set<string>; expertise: Set<string> },
  speed: MovementSpeeds,
): void {
  if (grant.type === 'ability') scores[grant.ability] += grant.value
  else if (grant.type === 'speed') speed[grant.mode] = grant.value
  else if (grant.type === 'proficiency' && grant.target === 'save' && ABILITIES.includes(grant.value as Ability)) {
    proficiencies.saves.add(grant.value as Ability)
  } else if (grant.type === 'proficiency' && grant.target === 'skill') {
    proficiencies.skills.add(grant.value.toLowerCase())
  } else if (grant.type === 'expertise') {
    proficiencies.skills.add(grant.skill.toLowerCase())
    proficiencies.expertise.add(grant.skill.toLowerCase())
  }
}

function selectedChoiceGrants(sheet: CharacterSheet, choices: RuleChoice[]): Grant[] {
  const grants: Grant[] = []
  for (const choice of choices) {
    const selected = sheet.choices.find(c => c.choiceId === choice.id)
    if (!selected) continue
    for (const optionId of selected.selectedOptionIds) {
      const option = choice.options.find(o => o.id === optionId)
      if (option?.grants) grants.push(...option.grants)
    }
  }
  return grants
}

function classLevel(sheet: CharacterSheet, classSlug: string): number {
  return sheet.levelHistory.filter(l => l.classSlug === classSlug).length
}

function averageHpForLevel(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1
}

function deriveMaxHp(sheet: CharacterSheet, ruleBySlug: Record<string, RuleElement>, conMod: number, warnings: string[]): number {
  let total = 0
  for (const entry of sheet.levelHistory) {
    const cls = ruleBySlug[entry.classSlug]
    const hitDie = cls?.hitDie ?? 8
    if (!cls) warnings.push(`Missing class rule for ${entry.classSlug}; using d8 hit die.`)
    const base = entry.level === 1 ? hitDie : entry.hpMode === 'average' ? averageHpForLevel(hitDie) : entry.hpValue
    total += Math.max(1, base + conMod)
  }
  return Math.max(1, total)
}

function deriveArmorClass(sheet: CharacterSheet, dexMod: number): number {
  const equipped = sheet.inventory.filter(i => i.equipped)
  const armor = equipped
    .map(i => i.itemSlug ? ITEMS.find(item => item.slug === i.itemSlug) : null)
    .find(i => i && /armor/i.test(i.type) && /AC:/i.test(i.description))
  const shieldCount = equipped.filter(i => /shield/i.test(i.name)).length
  let ac = 10 + dexMod
  if (armor) {
    const line = armor.description.match(/AC:\s*([^\n]+)/i)?.[1] ?? ''
    const n = line.match(/\d+/)
    if (n) {
      ac = parseInt(n[0], 10)
      if (/dex/i.test(line) || /modifier/i.test(line)) {
        ac += /max 2/i.test(line) ? Math.min(2, dexMod) : dexMod
      }
    }
  }
  return ac + shieldCount * 2
}

function deriveSpellcasting(
  sheet: CharacterSheet,
  ruleBySlug: Record<string, RuleElement>,
  mods: AbilityScores,
  prof: number,
): CharacterSpellcasting[] {
  let casterLevel = 0
  const blocks: CharacterSpellcasting[] = []
  for (const c of sheet.classes) {
    const rule = ruleBySlug[c.classSlug]
    if (!rule?.spellcastingAbility) continue
    if (FULL_CASTER.has(rule.name)) casterLevel += c.levels
    else if (HALF_CASTER.has(rule.name)) casterLevel += Math.floor(c.levels / 2)
    const ability = rule.spellcastingAbility
    blocks.push({
      classSlug: c.classSlug,
      ability,
      saveDc: 8 + prof + mods[ability],
      attackBonus: prof + mods[ability],
      slots: [],
    })
  }
  const slots = FULL_CASTER_SLOTS[Math.max(0, Math.min(20, casterLevel))] ?? []
  return blocks.map(block => ({
    ...block,
    slots: slots.map((max, i) => ({ level: i + 1, max, used: 0 })),
  }))
}

function deriveAttacks(sheet: CharacterSheet, mods: AbilityScores, prof: number): CharacterAttack[] {
  return sheet.inventory
    .filter(i => i.equipped && !/armor|shield/i.test(i.name))
    .slice(0, 6)
    .map(i => ({
      name: i.name,
      attackBonus: prof + Math.max(mods.str, mods.dex),
      damage: `1d6+${Math.max(mods.str, mods.dex)}`,
      notes: i.notes,
    }))
}

export function normalizeCharacterClasses(sheet: CharacterSheet): CharacterSheet['classes'] {
  const byClass = new Map<string, CharacterSheet['classes'][number]>()
  for (const entry of sheet.levelHistory) {
    const existing = byClass.get(entry.classSlug)
    if (existing) existing.levels++
    else byClass.set(entry.classSlug, { classSlug: entry.classSlug, levels: 1 })
  }
  for (const cls of sheet.classes) {
    const existing = byClass.get(cls.classSlug)
    if (existing) existing.subclassSlug = cls.subclassSlug
  }
  return [...byClass.values()]
}

export function deriveCharacter(sheet: CharacterSheet, ruleElements: RuleElement[]): DerivedCharacter {
  const warnings: string[] = []
  const ruleBySlug = Object.fromEntries(ruleElements.map(r => [r.slug, r]))
  const classes = normalizeCharacterClasses(sheet)
  const level = sheet.levelHistory.length || classes.reduce((a, c) => a + c.levels, 0) || 1
  const prof = proficiencyBonus(level)

  const scores = { ...sheet.abilityScores }
  const proficiencies = { saves: new Set<Ability>(), skills: new Set<string>(), expertise: new Set<string>() }
  const speed: MovementSpeeds = { walk: 30 }
  const featureRules: RuleElement[] = []
  const allChoices: RuleChoice[] = []

  const ancestry = sheet.ancestrySlug ? ruleBySlug[sheet.ancestrySlug] : undefined
  const background = sheet.backgroundSlug ? ruleBySlug[sheet.backgroundSlug] : undefined
  for (const element of [ancestry, background].filter(Boolean) as RuleElement[]) {
    element.grants?.forEach(g => {
      if (element === ancestry && sheet.abilityIncreaseMode === 'flexible' && g.type === 'ability') return
      applyGrant(g, scores, proficiencies, speed)
    })
    if (element.choices) allChoices.push(...element.choices)
  }
  if (sheet.abilityIncreaseMode === 'flexible') {
    for (const ability of ABILITIES) {
      scores[ability] += sheet.flexibleAbilityBonuses?.[ability] ?? 0
    }
  }

  for (const c of classes) {
    const cls = ruleBySlug[c.classSlug]
    if (!cls) { warnings.push(`Missing class rule for ${c.classSlug}.`); continue }
    cls.grants?.forEach(g => applyGrant(g, scores, proficiencies, speed))
    const className = cls.name
    featureRules.push(...ruleElements.filter(r =>
      r.kind === 'classFeature' && r.className === className && (r.level ?? 99) <= c.levels))
    const subclassUnlockLevel = cls.subclassLevel ?? 3
    if (c.subclassSlug && c.levels >= subclassUnlockLevel) {
      const subclass = ruleBySlug[c.subclassSlug]
      if (subclass) {
        featureRules.push(subclass)
        featureRules.push(...ruleElements.filter(r =>
          r.kind === 'subclassFeature' && r.className === className && r.subclassName === subclass.name && (r.level ?? 99) <= c.levels))
      } else warnings.push(`Missing subclass rule for ${c.subclassSlug}.`)
    } else if (c.subclassSlug && c.levels < subclassUnlockLevel) {
      warnings.push(`${cls.name} subclass unlocks at class level ${subclassUnlockLevel}.`)
    } else if (c.levels >= subclassUnlockLevel) {
      warnings.push(`${cls.name} needs a subclass selection.`)
    }
  }

  for (const f of featureRules) {
    f.grants?.forEach(g => applyGrant(g, scores, proficiencies, speed))
    if (f.choices) allChoices.push(...f.choices)
  }
  for (const grant of selectedChoiceGrants(sheet, allChoices)) applyGrant(grant, scores, proficiencies, speed)

  const mods = emptyScores()
  for (const ability of ABILITIES) mods[ability] = abilityMod(scores[ability])
  const maxHp = deriveMaxHp({ ...sheet, classes }, ruleBySlug, mods.con, warnings)
  const saves: Partial<Record<Ability, number>> = {}
  for (const ability of ABILITIES) saves[ability] = mods[ability] + (proficiencies.saves.has(ability) ? prof : 0)
  const skills: Record<string, number> = {}
  for (const [skill, ability] of Object.entries(SKILL_ABILITIES)) {
    const p = proficiencies.skills.has(skill) ? prof : 0
    const e = proficiencies.expertise.has(skill) ? prof : 0
    skills[skill] = mods[ability] + p + e
  }

  const unresolvedChoices = allChoices.filter(choice => {
    const selected = sheet.choices.find(c => c.choiceId === choice.id)
    return !selected || selected.selectedOptionIds.length < choice.choose
  })

  for (const c of classes) {
    const current = classLevel({ ...sheet, classes }, c.classSlug)
    if (current !== c.levels) warnings.push(`Class level mismatch for ${c.classSlug}; level history is authoritative.`)
  }

  return {
    id: sheet.id,
    name: sheet.name,
    level,
    proficiencyBonus: prof,
    abilityMods: mods,
    maxHp,
    currentHp: Math.min(sheet.currentHp || maxHp, maxHp),
    tempHp: sheet.tempHp,
    armorClass: deriveArmorClass(sheet, mods.dex),
    initiativeBonus: mods.dex,
    speed,
    savingThrows: saves,
    skills,
    passivePerception: 10 + (skills.perception ?? mods.wis),
    attacks: deriveAttacks(sheet, mods, prof),
    spellcasting: deriveSpellcasting({ ...sheet, classes }, ruleBySlug, mods, prof),
    features: featureRules,
    unresolvedChoices,
    warnings,
  }
}
