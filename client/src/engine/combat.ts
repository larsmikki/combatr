import type { Combatant, CombatEvent, CombatEventType, CombatSession, Encounter, Monster, Party } from '@/types'
import { MONSTERS } from '@/data/monsters'
import { rollExpr } from './dice'

const uid = () => Math.random().toString(36).slice(2, 10)

function makeCombatant(o: Partial<Combatant> & Pick<Combatant, 'type' | 'displayName'>): Combatant {
  return {
    id: uid(),
    type: o.type,
    sourceEntityId: o.sourceEntityId,
    monsterSlug: o.monsterSlug,
    displayName: o.displayName,
    initiative: o.initiative ?? null,
    initiativeBonus: o.initiativeBonus ?? 0,
    initiativeRoll: o.initiativeRoll ?? null,
    armorClass: o.armorClass ?? null,
    maxHp: o.maxHp ?? null,
    currentHp: o.currentHp ?? null,
    tempHp: o.tempHp ?? 0,
    isVisibleToPlayers: o.isVisibleToPlayers ?? true,
    isDefeated: o.isDefeated ?? false,
    disposition: o.disposition ?? 'neutral',
    conditions: o.conditions ?? [],
    deathSaves: o.deathSaves ?? null,
    notes: o.notes ?? '',
    formChain: o.formChain,
    currentFormIndex: o.currentFormIndex,
    hpMode: o.hpMode,
  }
}

// Re-stat a combatant into its next form. Called by applyDamage when an HP
// drop would kill a form-bearing combatant but more forms remain. Initiative
// carries over; conditions and temp HP are cleared (new form, new immunities).
// Returns true if the transformation happened, false if no next form exists.
function transformCombatant(
  s: CombatSession,
  c: Combatant,
  extraMonsters: Record<string, Monster>,
): boolean {
  const chain = c.formChain
  if (!chain || chain.length < 2) return false
  const nextIdx = (c.currentFormIndex ?? 0) + 1
  if (nextIdx >= chain.length) return false
  const fromName = chain[c.currentFormIndex ?? 0].monsterName
  const next = chain[nextIdx]
  const monster = extraMonsters[next.monsterSlug] ?? MONSTERS.find(m => m.slug === next.monsterSlug)
  if (!monster) return false  // missing stat block — fall through to defeat

  let hp = monster.hitPoints.average
  if (c.hpMode === 'rolled') {
    const rolled = rollExpr(monster.hitPoints.formula).total
    if (rolled > 0) hp = rolled
  }
  // Preserve the original combatant's index/label suffix (e.g., " A", " B") so
  // multi-instance bosses stay distinguishable across phases.
  const baseLabel = (c.displayName.match(/ [A-Z]$/)?.[0]) ?? ''
  c.monsterSlug = monster.slug
  c.sourceEntityId = monster.slug
  c.displayName = (next.displayName ?? monster.name) + baseLabel
  c.armorClass = monster.armorClass[0].value
  c.maxHp = hp
  c.currentHp = hp
  c.tempHp = 0
  c.conditions = []
  c.currentFormIndex = nextIdx

  pushEvent(s, {
    type: 'combatant_transformed',
    combatantId: c.id,
    payload: { from: fromName, to: monster.name, phase: nextIdx + 1, of: chain.length },
  })
  return true
}

export function buildSessionFromEncounter(
  encounter: Encounter,
  party: Party,
  extraMonsters: Record<string, Monster> = {},
): CombatSession {
  // Collision policy: custom overrides bundled.
  const monsterBySlug = (slug: string) => extraMonsters[slug] ?? MONSTERS.find(x => x.slug === slug)
  const combatants: Combatant[] = []

  // Named characters
  for (const c of party.characters) {
    combatants.push(makeCombatant({
      type: 'character', sourceEntityId: c.id, displayName: c.name,
      initiativeBonus: c.initiativeBonus, armorClass: c.armorClass,
      maxHp: c.maxHp, currentHp: c.currentHp,
      disposition: 'ally',
    }))
  }

  // Generic party placeholders
  let gIdx = 1
  for (const g of party.generic) {
    for (let i = 0; i < g.count; i++) {
      combatants.push(makeCombatant({
        type: 'character', displayName: `PC ${gIdx++} (lv ${g.level})`,
        initiativeBonus: 2, armorClass: 13,
        maxHp: 8 + g.level * 6, currentHp: 8 + g.level * 6,
        disposition: 'ally',
      }))
    }
  }

  // Monsters
  for (const grp of encounter.groups) {
    const m = monsterBySlug(grp.monsterSlug)
    if (!m) continue
    const initBonus = Math.floor((m.abilityScores.dex - 10) / 2)
    const hasForms = (grp.forms?.length ?? 0) > 1
    for (let i = 0; i < grp.quantity; i++) {
      const label = grp.quantity > 1 ? ' ' + String.fromCharCode(65 + i) : ''
      let hp = m.hitPoints.average
      if (grp.hpMode === 'rolled') {
        const rolled = rollExpr(m.hitPoints.formula).total
        if (rolled > 0) hp = rolled
      }
      const c = makeCombatant({
        type: 'monster', sourceEntityId: m.slug, monsterSlug: m.slug,
        displayName: (grp.customName ?? m.name) + label,
        initiativeBonus: initBonus, armorClass: m.armorClass[0].value,
        maxHp: hp, currentHp: hp,
        disposition: grp.startingDisposition,
        isVisibleToPlayers: !grp.startingHidden,
        formChain: hasForms ? grp.forms : undefined,
        currentFormIndex: hasForms ? 0 : undefined,
        hpMode: hasForms ? grp.hpMode : undefined,
      })
      // grouped init: share the first rolled value among the group
      if (grp.initiativeMode === 'grouped' && i === 0) {
        const r = rollExpr(`1d20+${initBonus}`)
        c.initiative = r.total; c.initiativeRoll = r
      } else if (grp.initiativeMode === 'individual') {
        const r = rollExpr(`1d20+${initBonus}`)
        c.initiative = r.total; c.initiativeRoll = r
      }
      combatants.push(c)
    }
    if (grp.initiativeMode === 'grouped') {
      // copy init from the first member to siblings
      const groupMembers = combatants.filter(c => c.sourceEntityId === m.slug && c.disposition === grp.startingDisposition)
      const first = groupMembers[groupMembers.length - grp.quantity]
      for (let i = 0; i < grp.quantity; i++) {
        const c = groupMembers[groupMembers.length - grp.quantity + i]
        c.initiative = first.initiative
        c.initiativeRoll = first.initiativeRoll
      }
    }
  }

  // Manual entries
  for (const m of encounter.manualEntries) {
    combatants.push(makeCombatant({
      type: 'manual', displayName: m.name,
      initiative: m.initiative ?? 20, initiativeBonus: 0,
      disposition: 'neutral', isVisibleToPlayers: m.visibleToPlayers,
    }))
  }

  return {
    id: uid(),
    encounterId: encounter.id,
    encounterName: encounter.name,
    status: 'initiative_setup',
    roundNumber: 1,
    activeTurnIndex: 0,
    combatants,
    eventLog: [],
    selectedCombatantId: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function sortCombatants(s: CombatSession): void {
  s.combatants.sort((a, b) => {
    const ia = a.initiative ?? -99
    const ib = b.initiative ?? -99
    if (ib !== ia) return ib - ia
    if (b.initiativeBonus !== a.initiativeBonus) return b.initiativeBonus - a.initiativeBonus
    if (a.type === 'character' && b.type !== 'character') return -1
    if (b.type === 'character' && a.type !== 'character') return 1
    return 0
  })
}

export function pushEvent(s: CombatSession, ev: Omit<CombatEvent, 'id' | 'createdAt'>): void {
  s.eventLog.unshift({ id: uid(), createdAt: new Date().toISOString(), ...ev })
  if (s.eventLog.length > 200) s.eventLog.length = 200
}

// ── Mutators (operate on a draft) ────────────────────────────────────────────

export function rollInitiativeFor(c: Combatant): void {
  const r = rollExpr(`1d20+${c.initiativeBonus}`)
  c.initiative = r.total
  c.initiativeRoll = r
}

export function rollAllMissingInitiative(s: CombatSession): void {
  for (const c of s.combatants) if (c.initiative == null) rollInitiativeFor(c)
}

export function startRunning(s: CombatSession): void {
  rollAllMissingInitiative(s)
  sortCombatants(s)
  s.status = 'running'
  s.roundNumber = 1
  s.activeTurnIndex = 0
  pushEvent(s, { type: 'combat_started', round: 1, payload: {} })
  const first = s.combatants[0]
  if (first) pushEvent(s, { type: 'turn_started', combatantId: first.id, round: 1, payload: {} })
}

export function nextTurn(s: CombatSession): void {
  if (s.status !== 'running') return
  const skip = (c: Combatant) => c.isDefeated && c.type === 'monster'
  for (let i = 0; i < s.combatants.length; i++) {
    s.activeTurnIndex++
    if (s.activeTurnIndex >= s.combatants.length) {
      s.activeTurnIndex = 0
      s.roundNumber++
      pushEvent(s, { type: 'round_started', round: s.roundNumber, payload: {} })
    }
    if (!skip(s.combatants[s.activeTurnIndex])) break
  }
  const cur = s.combatants[s.activeTurnIndex]
  if (cur) pushEvent(s, { type: 'turn_started', combatantId: cur.id, round: s.roundNumber, payload: {} })
}

export function previousTurn(s: CombatSession): void {
  if (s.status !== 'running') return
  s.activeTurnIndex--
  if (s.activeTurnIndex < 0) {
    if (s.roundNumber > 1) { s.roundNumber--; s.activeTurnIndex = s.combatants.length - 1 }
    else s.activeTurnIndex = 0
  }
}

export function applyDamage(
  s: CombatSession,
  c: Combatant,
  amount: number,
  extraMonsters: Record<string, Monster> = {},
): void {
  if (!amount || c.maxHp == null || c.currentHp == null) return
  let remaining = amount
  if (c.tempHp > 0) {
    const used = Math.min(c.tempHp, remaining)
    c.tempHp -= used
    remaining -= used
  }
  c.currentHp -= remaining
  if (c.type === 'character' && c.currentHp <= 0) {
    c.currentHp = 0
    if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 }
    c.deathSaves.failures = Math.min(3, c.deathSaves.failures + 1)
  } else if (c.type !== 'character' && c.currentHp <= 0) {
    // Multi-phase: try to transform first; fall through to defeat only if
    // there's no next form or its monster slug can't be resolved.
    if (transformCombatant(s, c, extraMonsters)) {
      pushEvent(s, { type: 'damage_applied', combatantId: c.id, payload: { amount, remaining: c.currentHp } })
      return
    }
    c.currentHp = 0
    c.isDefeated = true
    pushEvent(s, { type: 'combatant_defeated', combatantId: c.id, payload: {} })
  }
  pushEvent(s, { type: 'damage_applied', combatantId: c.id, payload: { amount, remaining: c.currentHp } })
}

export function applyHealing(s: CombatSession, c: Combatant, amount: number): void {
  if (!amount || c.maxHp == null || c.currentHp == null) return
  if (c.currentHp <= 0 && c.type === 'character') c.deathSaves = null
  c.currentHp = Math.min(c.maxHp, c.currentHp + amount)
  pushEvent(s, { type: 'healing_applied', combatantId: c.id, payload: { amount, remaining: c.currentHp } })
}

export function applyTempHp(s: CombatSession, c: Combatant, amount: number): void {
  if (!amount) return
  c.tempHp = Math.max(c.tempHp, amount)
  pushEvent(s, { type: 'temp_hp_applied', combatantId: c.id, payload: { amount } })
}

export function addCondition(s: CombatSession, c: Combatant, condition: string): void {
  if (c.conditions.some(x => x.conditionType === condition)) return
  c.conditions.push({ id: uid(), conditionType: condition, appliedAtRound: s.roundNumber })
  pushEvent(s, { type: 'condition_added', combatantId: c.id, payload: { condition } })
}

export function removeCondition(s: CombatSession, c: Combatant, conditionId: string): void {
  const before = c.conditions.find(x => x.id === conditionId)
  if (!before) return
  c.conditions = c.conditions.filter(x => x.id !== conditionId)
  pushEvent(s, { type: 'condition_removed', combatantId: c.id, payload: { condition: before.conditionType } })
}

export function rollDeathSave(s: CombatSession, c: Combatant): void {
  if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 }
  const r = rollExpr('1d20')
  pushEvent(s, { type: 'dice_rolled', combatantId: c.id, payload: { label: 'Death save', total: r.total } })
  if (r.total === 20) { c.currentHp = 1; c.deathSaves = null }
  else if (r.total === 1) c.deathSaves.failures = Math.min(3, c.deathSaves.failures + 2)
  else if (r.total >= 10) c.deathSaves.successes = Math.min(3, c.deathSaves.successes + 1)
  else c.deathSaves.failures = Math.min(3, c.deathSaves.failures + 1)
}

export function endCombat(s: CombatSession): void {
  s.status = 'completed'
  s.completedAt = new Date().toISOString()
  pushEvent(s, { type: 'combat_ended', payload: {} })
}

export function eventLabel(type: CombatEventType): string {
  return type.replace(/_/g, ' ')
}
