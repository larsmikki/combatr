import type { AbilityScores, CharacterSheet, RuleElement } from '@/types'

const uid = () => Math.random().toString(36).slice(2, 10)

export const STANDARD_ARRAY: AbilityScores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
export const POINT_BUY_21_ARRAY: AbilityScores = { str: 13, dex: 12, con: 12, int: 12, wis: 10, cha: 10 }

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2)
}

function averageHp(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1
}

export function createCharacter(campaignId: string, rules: RuleElement[]): CharacterSheet {
  const firstClass = rules.find(r => r.kind === 'class' && r.name === 'Fighter') ?? rules.find(r => r.kind === 'class')
  const firstRace = rules.find(r => r.kind === 'race')
  const firstBackground = rules.find(r => r.kind === 'background')
  const hitDie = firstClass?.hitDie ?? 10
  const conBonus = firstRace?.grants
    ?.reduce((sum, g) => g.type === 'ability' && g.ability === 'con' ? sum + g.value : sum, 0) ?? 0
  const startingHp = hitDie + abilityMod(POINT_BUY_21_ARRAY.con + conBonus)
  const now = new Date().toISOString()
  return {
    id: uid(),
    campaignId,
    name: 'New Character',
    ancestrySlug: firstRace?.slug,
    backgroundSlug: firstBackground?.slug,
    classes: firstClass ? [{ classSlug: firstClass.slug, levels: 1 }] : [],
    levelHistory: firstClass ? [{ id: uid(), classSlug: firstClass.slug, level: 1, hpMode: 'average', hpValue: hitDie }] : [],
    abilityScoreMode: 'point-buy',
    abilityIncreaseMode: 'fixed',
    abilityScores: { ...POINT_BUY_21_ARRAY },
    flexibleAbilityBonuses: {},
    choices: [],
    inventory: [],
    knownSpells: [],
    preparedSpells: [],
    currentHp: startingHp,
    tempHp: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function addClassLevel(sheet: CharacterSheet, classSlug: string, rules: RuleElement[]): CharacterSheet {
  const currentLevel = sheet.levelHistory.length + 1
  const cls = rules.find(r => r.slug === classSlug)
  const hitDie = cls?.hitDie ?? 8
  const hpValue = currentLevel === 1 ? hitDie : averageHp(hitDie)
  const now = new Date().toISOString()
  const levelHistory = [
    ...sheet.levelHistory,
    { id: uid(), classSlug, level: currentLevel, hpMode: 'average' as const, hpValue },
  ]
  const classes = [...sheet.classes]
  const existing = classes.find(c => c.classSlug === classSlug)
  if (existing) existing.levels += 1
  else classes.push({ classSlug, levels: 1 })
  return { ...sheet, levelHistory, classes, updatedAt: now }
}
