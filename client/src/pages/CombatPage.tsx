import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { MONSTERS } from '@/data/monsters'
import { CONDITIONS } from '@/data/conditions'
import {
  addCondition, applyDamage, applyHealing, applyTempHp,
  endCombat, nextTurn, previousTurn, removeCondition,
  rollAllMissingInitiative, rollDeathSave, rollInitiativeFor,
  sortCombatants, startRunning, pushEvent,
} from '@/engine/combat'
import { rollExpr } from '@/engine/dice'
import { useConfirm } from '@/components/ConfirmDialog'
import StatBlock from '@/components/StatBlock'
import type { Combatant, CombatSession } from '@/types'
import { Surface, Modal, Button, Input, Textarea } from '@/components/ui'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function CombatPage() {
  const { theme } = useTheme()
  const { sessions, activeSessionId, setActiveSessionId, upsertSession, deleteSession, customMonsters, encounters, upsertEncounter, activeCampaign, upsertCampaign } = useCombat()
  const navigate = useNavigate()
  const confirm = useConfirm()
  // Collision policy: custom overrides bundled, dedupe by slug, custom-first.
  const allMonsters = useMemo(() => {
    const out = Object.values(customMonsters)
    const seen = new Set(out.map(m => m.slug))
    for (const m of MONSTERS) if (!seen.has(m.slug)) out.push(m)
    return out
  }, [customMonsters])
  const session = activeSessionId ? sessions[activeSessionId] : null

  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')

  // Spacebar advances the turn. Listener lives at the top level so hook order
  // stays stable across the various early returns below.
  const sessionRef = useRef(session)
  sessionRef.current = session
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (e.repeat) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const cur = sessionRef.current
      if (!cur || cur.status !== 'running') return
      e.preventDefault()
      const next: CombatSession = JSON.parse(JSON.stringify(cur))
      nextTurn(next)
      next.updatedAt = new Date().toISOString()
      upsertSession(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [upsertSession])

  const sortedForDisplay = useMemo(() => {
    if (!session) return []
    const list = [...session.combatants]
    if (session.status !== 'initiative_setup') {
      list.sort((a, b) => {
        const ia = a.initiative ?? -99, ib = b.initiative ?? -99
        if (ib !== ia) return ib - ia
        if (b.initiativeBonus !== a.initiativeBonus) return b.initiativeBonus - a.initiativeBonus
        if (a.type === 'character' && b.type !== 'character') return -1
        if (b.type === 'character' && a.type !== 'character') return 1
        return 0
      })
    }
    return list
  }, [session])

  // ── No active session: show recent sessions + CTA ──
  if (!session) {
    const recent = Object.values(sessions).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Combat</h1>
          <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>No combat running right now.</p>
        </div>

        <Surface className="p-8 text-center mb-5">
          <p className="text-sm" style={{ color: theme.text2 }}>
            Pick a saved encounter from{' '}
            <Link to="/encounters" className="underline" style={{ color: theme.accent }}>Encounters</Link>{' '}
            and hit Run, or resume a session below.
          </p>
        </Surface>

        {recent.length > 0 && (
          <Surface className="p-6">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Recent sessions</h2>
            <div className="space-y-2">
              {recent.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: theme.text }}>{s.encounterName ?? 'Untitled'}</div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>
                      {s.status} · round {s.roundNumber} · {s.combatants.length} combatants
                      {s.startedAt ? ` · started ${new Date(s.startedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="primary" size="sm" onClick={() => { setActiveSessionId(s.id); navigate('/combat') }}>
                      {s.status === 'completed' ? 'View' : 'Resume'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={async () => { if (await confirm({ title: 'Delete session', message: 'Delete this session? This cannot be undone.', confirmLabel: 'Delete', destructive: true })) deleteSession(s.id) }}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        )}
      </div>
    )
  }

  // Helpers that mutate then persist
  const mutate = (fn: (draft: CombatSession) => void) => {
    const next: CombatSession = JSON.parse(JSON.stringify(session))
    fn(next)
    next.updatedAt = new Date().toISOString()
    upsertSession(next)
  }

  const selected = session.combatants.find(c => c.id === session.selectedCombatantId) ?? null
  const monster = selected?.monsterSlug ? allMonsters.find(m => m.slug === selected.monsterSlug) ?? null : null

  const setSelected = (id: string) => mutate(s => { s.selectedCombatantId = id })

  // Completed sessions render as a read-only summary, not the running UI.
  if (session.status === 'completed') {
    const survivors = session.combatants.filter(c => !c.isDefeated)
    const defeated  = session.combatants.filter(c =>  c.isDefeated)
    return (
      <div>
        <Surface className="p-5 mb-5 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: theme.text2 }}>Combat ended</div>
            <div className="text-lg font-bold" style={{ color: theme.text }}>{session.encounterName}</div>
            <div className="text-xs" style={{ color: theme.text2 }}>
              {session.roundNumber} round{session.roundNumber === 1 ? '' : 's'} · {session.combatants.length} combatants
              {session.completedAt && ` · ended ${new Date(session.completedAt).toLocaleString()}`}
            </div>
          </div>
          <Button size="sm" onClick={() => setActiveSessionId(null)}>Back to sessions</Button>
          <Button variant="danger" size="sm" onClick={async () => {
              if (!await confirm({ title: 'Delete session', message: 'Delete this completed session?', confirmLabel: 'Delete', destructive: true })) return
              await deleteSession(session.id)
              setActiveSessionId(null)
            }}>
            Delete
          </Button>
        </Surface>

        <div className="grid md:grid-cols-2 gap-4">
          <Surface className="p-4">
            <h3 className="text-sm font-bold mb-2" style={{ color: theme.text }}>Survivors ({survivors.length})</h3>
            <div className="space-y-1">
              {survivors.map(c => (
                <div key={c.id} className="text-xs flex justify-between" style={{ color: theme.text }}>
                  <span>{c.displayName}</span>
                  <span style={{ color: theme.text2 }}>
                    {c.currentHp ?? '—'}/{c.maxHp ?? '—'} HP
                  </span>
                </div>
              ))}
              {survivors.length === 0 && <p className="text-xs" style={{ color: theme.text2 }}>None.</p>}
            </div>
          </Surface>
          <Surface className="p-4">
            <h3 className="text-sm font-bold mb-2" style={{ color: theme.text }}>Defeated ({defeated.length})</h3>
            <div className="space-y-1">
              {defeated.map(c => (
                <div key={c.id} className="text-xs" style={{ color: theme.text2 }}>{c.displayName}</div>
              ))}
              {defeated.length === 0 && <p className="text-xs" style={{ color: theme.text2 }}>None.</p>}
            </div>
          </Surface>
        </div>

        <Surface className="p-4 mt-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: theme.text }}>Event log</h3>
          <div className="space-y-1 text-xs max-h-[40vh] overflow-auto" style={{ color: theme.text2 }}>
            {session.eventLog.map(ev => {
              const name = ev.combatantId ? session.combatants.find(c => c.id === ev.combatantId)?.displayName ?? '?' : ''
              return <div key={ev.id}>{describeEvent(ev, name)}</div>
            })}
          </div>
        </Surface>
      </div>
    )
  }

  return (
    <div>
      {/* Combat header */}
      <Surface className="flex items-center justify-between flex-wrap gap-3 mb-5 p-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: theme.text2 }}>Round</div>
            <div className="text-2xl font-bold" style={{ color: theme.accent }}>{session.roundNumber}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: theme.text2 }}>Active</div>
            <div className="text-base font-bold" style={{ color: theme.accent }}>
              {session.status === 'initiative_setup'
                ? '(setup)'
                : session.combatants[session.activeTurnIndex]?.displayName ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: theme.text2 }}>Encounter</div>
            <div className="text-sm font-semibold" style={{ color: theme.text }}>{session.encounterName}</div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold"
            style={{ background: theme.surface2, color: theme.text2 }}>{session.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => mutate(previousTurn)} disabled={session.status !== 'running'}>◀ Prev</Button>
          <Button variant="primary" size="sm" onClick={() => mutate(nextTurn)} disabled={session.status !== 'running'}>Next ▶</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add</Button>
          <Button size="sm" onClick={() => mutate(s => { s.status = s.status === 'paused' ? 'running' : 'paused' })}
            disabled={session.status !== 'running' && session.status !== 'paused'}>
            {session.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="danger" size="sm" onClick={async () => {
              if (!await confirm({ title: 'End combat', message: 'End this combat session? Results will be saved to the timeline.', confirmLabel: 'End combat', destructive: true })) return
              mutate(endCombat)
              const enc = encounters[session.encounterId]
              if (enc && enc.status !== 'completed') {
                await upsertEncounter({ ...enc, status: 'completed', updatedAt: new Date().toISOString() })
              }
              setActiveSessionId(null)
            }}>
            End
          </Button>
        </div>
      </Surface>

      <div className="grid lg:grid-cols-[320px_1fr_280px] gap-5">
        {/* ── Initiative panel ── */}
        <Surface className="p-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: theme.text }}>Initiative</h3>

          {session.status === 'initiative_setup' ? (
            <div>
              <p className="text-xs mb-3" style={{ color: theme.text2 }}>
                Enter or roll initiative for each combatant, then start combat.
              </p>
              <div className="space-y-1.5">
                {session.combatants.map(c => (
                  <div key={c.id} className="grid grid-cols-[8px_1fr_60px_50px] gap-2 items-center px-2 py-1.5 rounded-md"
                    style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                    <DispoBar disp={c.disposition} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: theme.text }}>{c.displayName}</div>
                      <div className="text-[11px]" style={{ color: theme.text2 }}>init {c.initiativeBonus >= 0 ? '+' : ''}{c.initiativeBonus}</div>
                    </div>
                    <input type="number" value={c.initiative ?? ''} placeholder="—"
                      onChange={e => mutate(s => {
                        const x = s.combatants.find(cc => cc.id === c.id)!
                        x.initiative = e.target.value === '' ? null : +e.target.value
                      })}
                      className="px-2 py-1 text-sm text-center" style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: '6px' }} />
                    <button onClick={() => mutate(s => { rollInitiativeFor(s.combatants.find(cc => cc.id === c.id)!) })}
                      className="text-[10px] font-semibold px-1.5 py-1 rounded-md hover:opacity-80"
                      style={{ background: `${theme.accent}18`, color: theme.accent }}>Roll</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => mutate(rollAllMissingInitiative)}>Roll all missing</Button>
                <Button variant="primary" size="sm" onClick={() => mutate(startRunning)}>Start combat ▶</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedForDisplay.map((c) => {
                const realIdx = session.combatants.findIndex(x => x.id === c.id)
                const isActive = realIdx === session.activeTurnIndex
                const isSelected = c.id === session.selectedCombatantId
                const ratio = c.maxHp ? (c.currentHp ?? 0) / c.maxHp : 1
                const hpColor = c.currentHp == null ? theme.text : (c.currentHp <= 0 ? '#d2484a' : ratio < 0.35 ? '#e0a64a' : theme.text)
                return (
                  <button key={c.id} onClick={() => setSelected(c.id)}
                    className="w-full text-left grid grid-cols-[34px_8px_1fr_auto] gap-2 items-center px-2 py-2 rounded-md"
                    style={{
                      background: isActive ? `${theme.accent}15` : theme.surface2,
                      border: `1px solid ${isActive ? theme.accent : isSelected ? theme.accent : theme.border}`,
                      opacity: c.isDefeated ? 0.5 : 1,
                    }}>
                    <span className="text-base font-bold text-center" style={{ color: theme.accent }}>
                      {c.initiative ?? '—'}
                    </span>
                    <DispoBar disp={c.disposition} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate flex items-center gap-1" style={{ color: theme.text }}>
                        {c.displayName}
                        {c.formChain && c.formChain.length > 1 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded"
                            style={{ background: `${theme.accent}22`, color: theme.accent }}>
                            Form {(c.currentFormIndex ?? 0) + 1}/{c.formChain.length}
                          </span>
                        )}
                        {!c.isVisibleToPlayers && <span className="text-[10px] italic" style={{ color: theme.text2 }}>(hidden)</span>}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: theme.text2 }}>
                        {c.conditions.length ? c.conditions.map(x => x.conditionType).join(', ') : c.type}
                      </div>
                    </div>
                    <span className="text-sm font-bold" style={{ color: hpColor }}>
                      {c.currentHp == null ? '' : `${c.currentHp}/${c.maxHp}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Surface>

        {/* ── Detail panel ── */}
        <Surface className="p-5">
          {!selected ? (
            <p className="text-sm py-10 text-center" style={{ color: theme.text2 }}>
              Select a combatant on the left to see HP, conditions, and stat block.
            </p>
          ) : (
            <>
              <CombatantDetail combatant={selected} session={session} mutate={mutate} extraMonsters={customMonsters} />
              {selected.monsterSlug && activeCampaign && (
                <CampaignMonsterNote
                  slug={selected.monsterSlug}
                  note={activeCampaign.monsterNotes?.[selected.monsterSlug] ?? ''}
                  onChange={v => {
                    const next = { ...(activeCampaign.monsterNotes ?? {}) }
                    if (!v.trim()) delete next[selected.monsterSlug!]
                    else next[selected.monsterSlug!] = v
                    upsertCampaign({ ...activeCampaign, monsterNotes: next, updatedAt: new Date().toISOString() })
                  }}
                />
              )}
            </>
          )}
          {monster && selected && (
            <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${theme.border}` }}>
              <StatBlock monster={monster} onRollDamage={(f, formula, dt) => {
                const r = rollExpr(formula)
                mutate(s => pushEvent(s, { type: 'dice_rolled', combatantId: selected.id, payload: { label: `${f.name} (${dt})`, expr: formula, total: r.total } }))
              }} />
            </div>
          )}
        </Surface>

        {/* ── Log panel ── */}
        <Surface className="p-4 overflow-auto">
          <h3 className="text-sm font-bold mb-2" style={{ color: theme.text }}>Event log</h3>
          <div className="space-y-1" style={{ maxHeight: '60vh' }}>
            {session.eventLog.map(ev => {
              const c = session.combatants.find(x => x.id === ev.combatantId)
              const ts = new Date(ev.createdAt).toLocaleTimeString()
              return (
                <div key={ev.id} className="text-xs leading-snug py-1" style={{ borderBottom: `1px dashed ${theme.border}` }}>
                  <span className="text-[10px]" style={{ color: theme.text2 }}>{ts}</span>
                  <div style={{ color: theme.text }}>{describeEvent(ev, c?.displayName ?? '')}</div>
                </div>
              )
            })}
            {session.eventLog.length === 0 && <p className="text-xs" style={{ color: theme.text2 }}>No events yet.</p>}
          </div>
        </Surface>
      </div>

      {/* Add combatant modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add combatant" maxWidth="540px">
        <Input value={addQuery} onChange={e => setAddQuery(e.target.value)} placeholder="Search monsters…"
          className="mb-3" autoFocus />
        <div className="space-y-1.5 overflow-auto" style={{ maxHeight: '45vh' }}>
          {allMonsters.filter(m => !addQuery || m.name.toLowerCase().includes(addQuery.toLowerCase())).slice(0, 30).map(m => (
            <div key={m.slug} className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: theme.text }}>{m.name}</div>
                <div className="text-[11px]" style={{ color: theme.text2 }}>CR {m.challengeRating} · AC {m.armorClass[0].value} · HP {m.hitPoints.average}</div>
              </div>
              <Button variant="primary" size="sm" onClick={() => {
                const initBonus = Math.floor((m.abilityScores.dex - 10) / 2)
                const r = rollExpr(`1d20+${initBonus}`)
                mutate(s => {
                  const c: Combatant = {
                    id: uid(), type: 'monster', sourceEntityId: m.slug, monsterSlug: m.slug,
                    displayName: m.name, initiative: r.total, initiativeBonus: initBonus, initiativeRoll: r,
                    armorClass: m.armorClass[0].value, maxHp: m.hitPoints.average, currentHp: m.hitPoints.average,
                    tempHp: 0, isVisibleToPlayers: true, isDefeated: false, disposition: 'enemy',
                    conditions: [], deathSaves: null,
                  }
                  s.combatants.push(c)
                  sortCombatants(s)
                  pushEvent(s, { type: 'combatant_added', combatantId: c.id, payload: { name: c.displayName } })
                })
                setAddOpen(false); setAddQuery('')
              }}>+ Add</Button>
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-3" onClick={() => {
          const name = window.prompt('Custom combatant name'); if (!name) return
          const initStr = window.prompt('Initiative (number, blank to roll d20)')
          const init = initStr === null ? null : (initStr === '' ? rollExpr('1d20').total : (+initStr || 10))
          const hp = +(window.prompt('Max HP (0 for none)') || 0) || null
          const ac = +(window.prompt('AC (0 for none)') || 0) || null
          mutate(s => {
            const c: Combatant = {
              id: uid(), type: 'npc', displayName: name,
              initiative: init ?? 10, initiativeBonus: 0, initiativeRoll: null,
              armorClass: ac, maxHp: hp, currentHp: hp, tempHp: 0,
              isVisibleToPlayers: true, isDefeated: false, disposition: 'neutral',
              conditions: [], deathSaves: null,
            }
            s.combatants.push(c)
            sortCombatants(s)
            pushEvent(s, { type: 'combatant_added', combatantId: c.id, payload: { name } })
          })
          setAddOpen(false)
        }}>+ Manual combatant</Button>
      </Modal>
    </div>
  )
}

// Campaign-scoped notes for a creature slug, surfaced during combat so the DM
// can reference (and amend) prep notes without leaving the tracker.
function CampaignMonsterNote({ slug, note, onChange }: { slug: string; note: string; onChange: (v: string) => void }) {
  const { theme } = useTheme()
  const [draft, setDraft] = useState(note)
  // Resync when slug or upstream note changes (e.g. selecting a different combatant).
  useEffect(() => { setDraft(note) }, [slug, note])
  return (
    <div className="mt-4 pt-4" style={{ borderTop: `1px dashed ${theme.border}` }}>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.text2 }}>Campaign notes</h4>
        {draft !== note && (
          <button onClick={() => onChange(draft)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded hover:opacity-90 text-white"
            style={{ background: theme.accent }}>Save</button>
        )}
      </div>
      <Textarea value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== note) onChange(draft) }}
        rows={3}
        placeholder="Notes for this creature in this campaign…"
        className="font-mono leading-relaxed" />
    </div>
  )
}

function DispoBar({ disp }: { disp: 'enemy' | 'ally' | 'neutral' }) {
  const color = disp === 'enemy' ? '#d2484a' : disp === 'ally' ? '#4a8cd2' : '#8a93a3'
  return <div style={{ width: 6, height: 28, background: color, borderRadius: 2 }} />
}

function describeEvent(ev: { type: string; payload: Record<string, unknown>; round?: number }, name: string): string {
  switch (ev.type) {
    case 'combat_started':   return `Combat started (round ${ev.round ?? 1}).`
    case 'round_started':    return `Round ${ev.round} begins.`
    case 'turn_started':     return `${name}'s turn.`
    case 'damage_applied':   return `${name} takes ${ev.payload.amount} damage (now ${ev.payload.remaining} HP).`
    case 'healing_applied':  return `${name} heals ${ev.payload.amount} (now ${ev.payload.remaining} HP).`
    case 'temp_hp_applied':  return `${name} gains ${ev.payload.amount} temp HP.`
    case 'condition_added':  return `${name} gains ${ev.payload.condition}.`
    case 'condition_removed':return `${name} loses ${ev.payload.condition}.`
    case 'combatant_defeated': return `${name} is defeated.`
    case 'combatant_transformed': return `${name} transforms: ${ev.payload.from} → ${ev.payload.to} (phase ${ev.payload.phase}/${ev.payload.of}).`
    case 'combatant_added':  return `${ev.payload.name} joins combat.`
    case 'dice_rolled':      return `Rolled ${ev.payload.label ?? ''}: ${ev.payload.total}`
    case 'combat_ended':     return 'Combat ended.'
    default:                 return ev.type
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Combatant detail sub-component
// ──────────────────────────────────────────────────────────────────────────
function CombatantDetail({
  combatant, mutate, extraMonsters,
}: {
  combatant: Combatant
  session: CombatSession
  mutate: (fn: (draft: CombatSession) => void) => void
  extraMonsters: Record<string, import('@/types').Monster>
}) {
  const { theme } = useTheme()
  const confirm = useConfirm()
  const [dmg, setDmg] = useState('')
  const [heal, setHeal] = useState('')
  const [temp, setTemp] = useState('')
  const [condChoice, setCondChoice] = useState('')
  const dmgRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    dmgRef.current?.focus()
    dmgRef.current?.select()
  }, [combatant.id])

  const target = (s: CombatSession) => s.combatants.find(c => c.id === combatant.id)!

  const inputStyle = { background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: '6px' }
  const btn = { background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-xl font-bold flex items-center gap-2 flex-wrap" style={{ color: theme.accent }}>
            {combatant.displayName}
            {combatant.formChain && combatant.formChain.length > 1 && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: `${theme.accent}22`, color: theme.accent }}>
                Form {(combatant.currentFormIndex ?? 0) + 1}/{combatant.formChain.length}
              </span>
            )}
          </div>
          <div className="text-xs" style={{ color: theme.text2 }}>
            {combatant.type}
            {combatant.armorClass != null && ` · AC ${combatant.armorClass}`}
            {` · init ${combatant.initiativeBonus >= 0 ? '+' : ''}${combatant.initiativeBonus}`}
            {combatant.initiative != null && ` · rolled ${combatant.initiative}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => mutate(s => { target(s).isVisibleToPlayers = !target(s).isVisibleToPlayers })}
            className="text-xs px-2 py-1 rounded-md hover:opacity-80" style={btn}>
            {combatant.isVisibleToPlayers ? 'Hide' : 'Reveal'}
          </button>
          <button onClick={() => mutate(s => { target(s).isDefeated = !target(s).isDefeated })}
            className="text-xs px-2 py-1 rounded-md hover:opacity-80" style={btn}>
            {combatant.isDefeated ? 'Revive' : 'Mark defeated'}
          </button>
          <button onClick={async () => {
            if (!await confirm({ title: 'Remove combatant', message: `Remove ${combatant.displayName} from combat?`, confirmLabel: 'Remove', destructive: true })) return
            mutate(s => {
              s.combatants = s.combatants.filter(c => c.id !== combatant.id)
              if (s.activeTurnIndex >= s.combatants.length) s.activeTurnIndex = 0
              if (s.selectedCombatantId === combatant.id) s.selectedCombatantId = null
            })
          }} className="text-xs px-2 py-1 rounded-md hover:opacity-80"
            style={{ background: 'transparent', color: '#d2484a', border: `1px solid ${theme.border}` }}>
            Remove
          </button>
        </div>
      </div>

      {combatant.maxHp != null && (
        <div className="rounded-xl p-3 mb-3" style={{ background: theme.surface2 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold" style={{ color: theme.accent }}>
              {combatant.currentHp}/{combatant.maxHp}
              {combatant.tempHp > 0 && <span className="text-xs ml-1.5" style={{ color: theme.text2 }}>+{combatant.tempHp} temp</span>}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <div className="flex gap-1">
              <input ref={dmgRef} value={dmg} onChange={e => setDmg(e.target.value)} placeholder="dmg" type="number" min={0}
                onKeyDown={e => { if (e.key === 'Enter') { mutate(s => applyDamage(s, target(s), +dmg || 0, extraMonsters)); setDmg('') } }}
                className="px-2 py-1 flex-1 min-w-0" style={inputStyle} />
              <button onClick={() => { mutate(s => applyDamage(s, target(s), +dmg || 0, extraMonsters)); setDmg('') }}
                className="px-2 py-1 rounded-md hover:opacity-80" style={btn}>Dmg</button>
            </div>
            <div className="flex gap-1">
              <input value={heal} onChange={e => setHeal(e.target.value)} placeholder="heal" type="number" min={0}
                className="px-2 py-1 flex-1 min-w-0" style={inputStyle} />
              <button onClick={() => { mutate(s => applyHealing(s, target(s), +heal || 0)); setHeal('') }}
                className="px-2 py-1 rounded-md hover:opacity-80" style={btn}>Heal</button>
            </div>
            <div className="flex gap-1">
              <input value={temp} onChange={e => setTemp(e.target.value)} placeholder="temp" type="number" min={0}
                className="px-2 py-1 flex-1 min-w-0" style={inputStyle} />
              <button onClick={() => { mutate(s => applyTempHp(s, target(s), +temp || 0)); setTemp('') }}
                className="px-2 py-1 rounded-md hover:opacity-80" style={btn}>Temp</button>
            </div>
          </div>
        </div>
      )}

      {/* Conditions */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.text2 }}>Conditions</h4>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {combatant.conditions.map(cd => (
            <span key={cd.id} className="px-2 py-0.5 rounded-full text-xs font-medium text-white cursor-pointer hover:opacity-80"
              style={{ background: theme.accent }}
              onClick={() => mutate(s => removeCondition(s, target(s), cd.id))}>
              {cd.conditionType} ✕
            </span>
          ))}
          {combatant.conditions.length === 0 && <span className="text-xs" style={{ color: theme.text2 }}>none</span>}
        </div>
        <select value={condChoice} onChange={e => {
          if (!e.target.value) return
          const v = e.target.value
          mutate(s => addCondition(s, target(s), v))
          setCondChoice('')
        }} className="px-2 py-1 text-xs" style={inputStyle}>
          <option value="">+ Add condition…</option>
          {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Death saves */}
      {combatant.type === 'character' && combatant.currentHp != null && combatant.currentHp <= 0 && (
        <div className="mt-3 p-3 rounded-xl" style={{ background: theme.surface2 }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: theme.text2 }}>Death saves</h4>
          <div className="text-sm mb-2" style={{ color: theme.text }}>
            Successes {combatant.deathSaves?.successes ?? 0}/3 · Failures {combatant.deathSaves?.failures ?? 0}/3
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => mutate(s => { const t = target(s); if (!t.deathSaves) t.deathSaves = { successes: 0, failures: 0 }; t.deathSaves.successes = Math.min(3, t.deathSaves.successes + 1) })}
              className="text-xs px-2 py-1 rounded-md hover:opacity-80" style={btn}>+ success</button>
            <button onClick={() => mutate(s => { const t = target(s); if (!t.deathSaves) t.deathSaves = { successes: 0, failures: 0 }; t.deathSaves.failures = Math.min(3, t.deathSaves.failures + 1) })}
              className="text-xs px-2 py-1 rounded-md hover:opacity-80" style={btn}>+ failure</button>
            <button onClick={() => mutate(s => rollDeathSave(s, target(s)))}
              className="text-xs px-2 py-1 rounded-md text-white hover:opacity-90" style={{ background: theme.gradient }}>Roll d20</button>
          </div>
        </div>
      )}
    </div>
  )
}
