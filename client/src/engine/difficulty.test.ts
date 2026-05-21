import { describe, it, expect } from 'vitest'
import { calculateDifficulty, monsterCountMultiplier, partyXpThresholds, partySize } from './difficulty'
import { CR_XP } from '@/data/thresholds'
import type { EncounterMonsterGroup, Party } from '@/types'

const fourLevel5: Party = { generic: [{ level: 5, count: 4 }], characters: [] }
const fourLevel1: Party = { generic: [{ level: 1, count: 4 }], characters: [] }

function group(slug: string, cr: string, quantity: number): EncounterMonsterGroup {
  return {
    id: slug + quantity,
    monsterSlug: slug,
    monsterName: slug,
    cr,
    xp: CR_XP[cr],
    quantity,
    initiativeMode: 'grouped',
    hpMode: 'average',
    startingHidden: false,
    startingDisposition: 'enemy',
  }
}

describe('partySize', () => {
  it('sums generic + named', () => {
    expect(partySize({ generic: [{ level: 1, count: 3 }], characters: [{ id: 'a', name: 'x', level: 1, maxHp: 1, currentHp: 1, armorClass: 10, initiativeBonus: 0 }] })).toBe(4)
  })
})

describe('partyXpThresholds', () => {
  it('matches DMG 2014 numbers for four level-5 PCs', () => {
    const t = partyXpThresholds(fourLevel5)
    expect(t.easy).toBe(1000)    // 250 * 4
    expect(t.medium).toBe(2000)  // 500 * 4
    expect(t.hard).toBe(3000)    // 750 * 4
    expect(t.deadly).toBe(4400)  // 1100 * 4
  })

  it('mixes generic and named at different levels', () => {
    const party: Party = {
      generic: [{ level: 1, count: 2 }],
      characters: [{ id: 'a', name: 'x', level: 3, maxHp: 20, currentHp: 20, armorClass: 14, initiativeBonus: 2 }],
    }
    const t = partyXpThresholds(party)
    // 2 × lv1 easy (25) + 1 × lv3 easy (75) = 125
    expect(t.easy).toBe(125)
  })
})

describe('monsterCountMultiplier', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1.5],
    [3, 2], [6, 2],
    [7, 2.5], [10, 2.5],
    [11, 3], [14, 3],
    [15, 4], [99, 4],
  ])('count %i -> ×%f', (count, mult) => {
    expect(monsterCountMultiplier(count)).toBe(mult)
  })
})

describe('calculateDifficulty', () => {
  it('CR 1/4 vs four level-5 PCs is trivial (per spec test §24)', () => {
    // One CR 1/4 (50 XP) × 1.0 = 50, easy threshold is 1000.
    const r = calculateDifficulty(fourLevel5, [group('goblin', '1/4', 1)])
    expect(r.totalMonsterXp).toBe(50)
    expect(r.adjustedXp).toBe(50)
    expect(r.difficulty).toBe('trivial')
  })

  it('many weak monsters get multiplier bump', () => {
    // 8 × CR 1/4 (50 XP) = 400, ×2.5 multiplier = 1000 → easy for 4 lv5
    const r = calculateDifficulty(fourLevel5, [group('goblin', '1/4', 8)])
    expect(r.totalMonsterXp).toBe(400)
    expect(r.monsterCountMultiplier).toBe(2.5)
    expect(r.adjustedXp).toBe(1000)
    expect(r.difficulty).toBe('easy')
  })

  it('solo boss vs 4 lv1 PCs is deadly or absurd', () => {
    // CR 5 (1800 XP) × 1.0 = 1800. Deadly threshold for 4 lv1 = 400. 1800 > 1.5×400 = 600 → absurd.
    const r = calculateDifficulty(fourLevel1, [group('troll', '5', 1)])
    expect(r.difficulty).toBe('absurd')
  })

  it('small party (2 PCs) shifts up one step', () => {
    const twoLevel5: Party = { generic: [{ level: 5, count: 2 }], characters: [] }
    // CR 3 (700) × 1.0 = 700. Their medium=1000, easy=500. Base = easy. +1 step → medium.
    const r = calculateDifficulty(twoLevel5, [group('owlbear', '3', 1)])
    expect(r.partySizeAdjustment).toMatch(/small/)
    expect(r.difficulty).toBe('medium')
  })

  it('large party (6 PCs) shifts down one step', () => {
    const sixLevel5: Party = { generic: [{ level: 5, count: 6 }], characters: [] }
    // CR 3 (700) × 1 = 700. Their easy=1500, so base=trivial; -1 stays trivial.
    const r = calculateDifficulty(sixLevel5, [group('owlbear', '3', 1)])
    expect(r.partySizeAdjustment).toMatch(/large/)
    expect(r.difficulty).toBe('trivial')
  })
})
