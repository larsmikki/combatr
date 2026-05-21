import type { EncounterDifficultyResult, EncounterMonsterGroup, Party, Difficulty } from '@/types'
import { XP_THRESHOLDS } from '@/data/thresholds'

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)) }

export function partyXpThresholds(party: Party): EncounterDifficultyResult['partyThresholds'] {
  const total = { easy: 0, medium: 0, hard: 0, deadly: 0 }
  const apply = (level: number, count: number) => {
    const t = XP_THRESHOLDS[clamp(level, 1, 20)]
    total.easy   += t.easy   * count
    total.medium += t.medium * count
    total.hard   += t.hard   * count
    total.deadly += t.deadly * count
  }
  for (const g of party.generic) apply(g.level, g.count)
  for (const c of party.characters) apply(c.level || 1, 1)
  return total
}

export function partySize(party: Party): number {
  return party.generic.reduce((a, g) => a + g.count, 0) + party.characters.length
}

export function monsterCountMultiplier(n: number): number {
  if (n <= 0) return 0
  if (n === 1) return 1
  if (n === 2) return 1.5
  if (n <= 6) return 2
  if (n <= 10) return 2.5
  if (n <= 14) return 3
  return 4
}

function partySizeAdjustment(size: number): string {
  if (size <= 2) return '+1 step (small party)'
  if (size >= 6) return '−1 step (large party)'
  return 'none'
}

const STEPS: Difficulty[] = ['trivial', 'easy', 'medium', 'hard', 'deadly', 'absurd']

export function calculateDifficulty(party: Party, groups: EncounterMonsterGroup[]): EncounterDifficultyResult {
  // Only hostile groups contribute to the XP budget — allies/neutrals don't
  // make an encounter harder for the party.
  const hostile = groups.filter(g => g.startingDisposition === 'enemy')
  const monsterCount = hostile.reduce((a, g) => a + g.quantity, 0)
  const totalMonsterXp = hostile.reduce((a, g) => a + g.xp * g.quantity, 0)
  const mult = monsterCountMultiplier(monsterCount)
  const adjustedXp = Math.round(totalMonsterXp * mult)
  const thresholds = partyXpThresholds(party)
  const size = partySize(party)

  let base: Difficulty = 'trivial'
  if (adjustedXp >= thresholds.deadly * 1.5) base = 'absurd'
  else if (adjustedXp >= thresholds.deadly) base = 'deadly'
  else if (adjustedXp >= thresholds.hard)   base = 'hard'
  else if (adjustedXp >= thresholds.medium) base = 'medium'
  else if (adjustedXp >= thresholds.easy)   base = 'easy'

  const shift = size <= 2 ? +1 : size >= 6 ? -1 : 0
  const idx = clamp(STEPS.indexOf(base) + shift, 0, STEPS.length - 1)

  return {
    totalMonsterXp,
    adjustedXp,
    monsterCountMultiplier: mult,
    partyThresholds: thresholds,
    difficulty: STEPS[idx],
    partySizeAdjustment: partySizeAdjustment(size),
  }
}
