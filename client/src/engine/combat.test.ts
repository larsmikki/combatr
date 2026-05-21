import { describe, it, expect } from 'vitest'
import {
  addCondition, applyDamage, applyHealing, applyTempHp,
  buildSessionFromEncounter, nextTurn, previousTurn, removeCondition,
  sortCombatants, startRunning,
} from './combat'
import type { Combatant, CombatSession, Encounter, Party } from '@/types'

const baseParty: Party = { generic: [], characters: [] }
const baseEncounter = (slug: string, qty: number, mode: 'grouped' | 'individual' = 'grouped'): Encounter => ({
  id: 'e1',
  campaignId: 'c1',
  name: 'test',
  groups: [{
    id: 'g1', monsterSlug: slug, monsterName: slug, cr: '1/4', xp: 50,
    quantity: qty, initiativeMode: mode, hpMode: 'average',
    startingHidden: false, startingDisposition: 'enemy',
  }],
  manualEntries: [],
  status: 'draft',
  createdAt: 'x', updatedAt: 'x',
})

function mkCombatant(o: Partial<Combatant>): Combatant {
  return {
    id: o.id ?? 'c',
    type: o.type ?? 'monster',
    displayName: o.displayName ?? 'c',
    initiative: o.initiative ?? null,
    initiativeBonus: o.initiativeBonus ?? 0,
    initiativeRoll: null,
    armorClass: o.armorClass ?? 10,
    maxHp: o.maxHp ?? 20,
    currentHp: o.currentHp ?? 20,
    tempHp: o.tempHp ?? 0,
    isVisibleToPlayers: true,
    isDefeated: false,
    disposition: o.disposition ?? 'enemy',
    conditions: o.conditions ?? [],
    deathSaves: null,
    ...o,
  }
}

function mkSession(combatants: Combatant[]): CombatSession {
  return {
    id: 's1', encounterId: 'e1', encounterName: 'test',
    status: 'running', roundNumber: 1, activeTurnIndex: 0,
    combatants, eventLog: [], selectedCombatantId: null,
    startedAt: 'x', updatedAt: 'x',
  }
}

// ── builder ──────────────────────────────────────────────────────────────────

describe('buildSessionFromEncounter', () => {
  it('expands a quantity-3 group with A/B/C labels', () => {
    const s = buildSessionFromEncounter(baseEncounter('goblin', 3), baseParty)
    expect(s.combatants).toHaveLength(3)
    expect(s.combatants.map(c => c.displayName)).toEqual(['Goblin A', 'Goblin B', 'Goblin C'])
  })

  it('shares initiative across a grouped party', () => {
    const s = buildSessionFromEncounter(baseEncounter('goblin', 4, 'grouped'), baseParty)
    const inits = s.combatants.map(c => c.initiative)
    expect(new Set(inits).size).toBe(1)
  })

  it('rolls individual initiative for individual mode', () => {
    // Not deterministic but very rarely all four match — repeat until distinct.
    let foundDistinct = false
    for (let i = 0; i < 10 && !foundDistinct; i++) {
      const s = buildSessionFromEncounter(baseEncounter('goblin', 4, 'individual'), baseParty)
      if (new Set(s.combatants.map(c => c.initiative)).size > 1) foundDistinct = true
    }
    expect(foundDistinct).toBe(true)
  })

  it('expands generic party into PC combatants', () => {
    const e = baseEncounter('goblin', 1)
    const s = buildSessionFromEncounter(e, { generic: [{ level: 3, count: 2 }], characters: [] })
    const pcs = s.combatants.filter(c => c.type === 'character')
    expect(pcs).toHaveLength(2)
    expect(pcs.every(c => c.maxHp! > 0)).toBe(true)
  })
})

// ── initiative ordering ──────────────────────────────────────────────────────

describe('sortCombatants', () => {
  it('sorts highest initiative first', () => {
    const s = mkSession([
      mkCombatant({ id: 'a', initiative: 5 }),
      mkCombatant({ id: 'b', initiative: 17 }),
      mkCombatant({ id: 'c', initiative: 10 }),
    ])
    sortCombatants(s)
    expect(s.combatants.map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks ties by initiative bonus, then by character > monster', () => {
    const s = mkSession([
      mkCombatant({ id: 'monster-hi-bonus', initiative: 12, initiativeBonus: 4, type: 'monster' }),
      mkCombatant({ id: 'char-low-bonus',   initiative: 12, initiativeBonus: 2, type: 'character' }),
      mkCombatant({ id: 'char-same-bonus',  initiative: 12, initiativeBonus: 4, type: 'character' }),
    ])
    sortCombatants(s)
    // Same init+bonus: character wins over monster, then monster, then lower-bonus character.
    expect(s.combatants.map(c => c.id)).toEqual(['char-same-bonus', 'monster-hi-bonus', 'char-low-bonus'])
  })
})

// ── HP rules ─────────────────────────────────────────────────────────────────

describe('applyDamage', () => {
  it('reduces current HP', () => {
    const s = mkSession([mkCombatant({ currentHp: 20, maxHp: 20 })])
    applyDamage(s, s.combatants[0], 7)
    expect(s.combatants[0].currentHp).toBe(13)
  })

  it('consumes temp HP first', () => {
    const s = mkSession([mkCombatant({ currentHp: 20, maxHp: 20, tempHp: 5 })])
    applyDamage(s, s.combatants[0], 7)
    expect(s.combatants[0].tempHp).toBe(0)
    expect(s.combatants[0].currentHp).toBe(18)
  })

  it('does not let temp HP go negative', () => {
    const s = mkSession([mkCombatant({ currentHp: 20, maxHp: 20, tempHp: 10 })])
    applyDamage(s, s.combatants[0], 4)
    expect(s.combatants[0].tempHp).toBe(6)
    expect(s.combatants[0].currentHp).toBe(20)
  })

  it('marks a monster defeated at 0 HP', () => {
    const s = mkSession([mkCombatant({ type: 'monster', currentHp: 5, maxHp: 5 })])
    applyDamage(s, s.combatants[0], 9)
    expect(s.combatants[0].currentHp).toBe(0)
    expect(s.combatants[0].isDefeated).toBe(true)
  })

  it('starts death saves on a PC reduced to 0', () => {
    const s = mkSession([mkCombatant({ type: 'character', currentHp: 4, maxHp: 20 })])
    applyDamage(s, s.combatants[0], 9)
    expect(s.combatants[0].currentHp).toBe(0)
    expect(s.combatants[0].deathSaves).toEqual({ successes: 0, failures: 1 })
    expect(s.combatants[0].isDefeated).toBe(false)
  })

  it('logs damage_applied event', () => {
    const s = mkSession([mkCombatant({ currentHp: 20, maxHp: 20 })])
    applyDamage(s, s.combatants[0], 3)
    expect(s.eventLog[0]).toMatchObject({ type: 'damage_applied', payload: { amount: 3, remaining: 17 } })
  })

  it('transforms a multi-phase combatant instead of defeating it', () => {
    // aboleth → acolyte is a bogus boss chain, but slug resolution is all we
    // need — the engine just re-stats the combatant from the next form's monster.
    const s = mkSession([mkCombatant({
      type: 'monster', currentHp: 5, maxHp: 5, monsterSlug: 'aboleth',
      formChain: [
        { monsterSlug: 'aboleth', monsterName: 'Aboleth', cr: '10', xp: 5900 },
        { monsterSlug: 'acolyte', monsterName: 'Acolyte', cr: '1/4', xp: 50 },
      ],
      currentFormIndex: 0,
      hpMode: 'average',
    })])
    applyDamage(s, s.combatants[0], 999)
    const c = s.combatants[0]
    expect(c.isDefeated).toBe(false)
    expect(c.currentFormIndex).toBe(1)
    expect(c.monsterSlug).toBe('acolyte')
    expect(c.currentHp).toBeGreaterThan(0)
    expect(s.eventLog.find(e => e.type === 'combatant_transformed')).toBeTruthy()
  })

  it('defeats normally after the final form drops', () => {
    const s = mkSession([mkCombatant({
      type: 'monster', currentHp: 3, maxHp: 3, monsterSlug: 'acolyte',
      formChain: [
        { monsterSlug: 'aboleth', monsterName: 'Aboleth', cr: '10', xp: 5900 },
        { monsterSlug: 'acolyte', monsterName: 'Acolyte', cr: '1/4', xp: 50 },
      ],
      currentFormIndex: 1,  // already on last form
      hpMode: 'average',
    })])
    applyDamage(s, s.combatants[0], 999)
    expect(s.combatants[0].isDefeated).toBe(true)
    expect(s.eventLog.find(e => e.type === 'combatant_defeated')).toBeTruthy()
  })
})

describe('applyHealing', () => {
  it('does not exceed max HP', () => {
    const s = mkSession([mkCombatant({ currentHp: 18, maxHp: 20 })])
    applyHealing(s, s.combatants[0], 99)
    expect(s.combatants[0].currentHp).toBe(20)
  })

  it('clears death saves on a downed PC', () => {
    const s = mkSession([mkCombatant({ type: 'character', currentHp: 0, maxHp: 20, deathSaves: { successes: 1, failures: 2 } })])
    applyHealing(s, s.combatants[0], 5)
    expect(s.combatants[0].currentHp).toBe(5)
    expect(s.combatants[0].deathSaves).toBeNull()
  })
})

describe('applyTempHp', () => {
  it('takes the max, does not stack', () => {
    const s = mkSession([mkCombatant({ tempHp: 5 })])
    applyTempHp(s, s.combatants[0], 3)
    expect(s.combatants[0].tempHp).toBe(5)
    applyTempHp(s, s.combatants[0], 8)
    expect(s.combatants[0].tempHp).toBe(8)
  })
})

// ── Conditions ───────────────────────────────────────────────────────────────

describe('addCondition / removeCondition', () => {
  it('adds a condition and logs it', () => {
    const s = mkSession([mkCombatant({ id: 'a' })])
    addCondition(s, s.combatants[0], 'prone')
    expect(s.combatants[0].conditions).toHaveLength(1)
    expect(s.combatants[0].conditions[0].conditionType).toBe('prone')
    expect(s.eventLog[0].type).toBe('condition_added')
  })

  it('does not stack duplicate conditions', () => {
    const s = mkSession([mkCombatant({})])
    addCondition(s, s.combatants[0], 'prone')
    addCondition(s, s.combatants[0], 'prone')
    expect(s.combatants[0].conditions).toHaveLength(1)
  })

  it('removes by id', () => {
    const s = mkSession([mkCombatant({})])
    addCondition(s, s.combatants[0], 'stunned')
    const condId = s.combatants[0].conditions[0].id
    removeCondition(s, s.combatants[0], condId)
    expect(s.combatants[0].conditions).toHaveLength(0)
  })
})

// ── Turn / round advancement ─────────────────────────────────────────────────

describe('turn advancement', () => {
  it('wraps to round 2 after the last turn', () => {
    const s = mkSession([
      mkCombatant({ id: 'a', initiative: 20 }),
      mkCombatant({ id: 'b', initiative: 15 }),
    ])
    s.activeTurnIndex = 1 // last
    nextTurn(s)
    expect(s.activeTurnIndex).toBe(0)
    expect(s.roundNumber).toBe(2)
    expect(s.eventLog.find(e => e.type === 'round_started')).toBeDefined()
  })

  it('previousTurn rewinds across round boundary', () => {
    const s = mkSession([mkCombatant({ id: 'a' }), mkCombatant({ id: 'b' })])
    s.roundNumber = 2
    s.activeTurnIndex = 0
    previousTurn(s)
    expect(s.roundNumber).toBe(1)
    expect(s.activeTurnIndex).toBe(1)
  })

  it('startRunning sorts, initialises, and logs', () => {
    const s = mkSession([
      mkCombatant({ id: 'a', initiative: 5 }),
      mkCombatant({ id: 'b', initiative: 18 }),
    ])
    s.status = 'initiative_setup'
    startRunning(s)
    expect(s.status).toBe('running')
    expect(s.combatants[0].id).toBe('b')
    expect(s.roundNumber).toBe(1)
    expect(s.eventLog.find(e => e.type === 'combat_started')).toBeDefined()
  })
})
