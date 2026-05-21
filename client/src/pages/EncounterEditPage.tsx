import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { MONSTERS } from '@/data/monsters'
import { crToNum } from '@/data/thresholds'
import { calculateDifficulty, partyXpThresholds } from '@/engine/difficulty'
import { buildSessionFromEncounter } from '@/engine/combat'
import StatBlock from '@/components/StatBlock'
import type { Difficulty, EncounterMonsterGroup, FormRef, ManualEncounterEntry, Monster } from '@/types'
import { Surface, Modal, Button, Textarea, useToast } from '@/components/ui'

const uid = () => Math.random().toString(36).slice(2, 10)

const DIFF_COLOR: Record<Difficulty, string> = {
  trivial: '#6b7280',
  easy:    '#5fbf6b',
  medium:  '#e0a64a',
  hard:    '#d97706',
  deadly:  '#d2484a',
  absurd:  '#9f7aea',
}

export default function EncounterEditPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const {
    party, encounters, encounterDraft, setEncounterDraft,
    upsertEncounter, resetDraft,
    upsertSession, setActiveSessionId, customMonsters,
    activeCampaignId, activeCampaign, campaigns,
  } = useCombat()

  // Hydrate draft from route. 'new' starts a fresh draft; any other id loads
  // the matching encounter. Unknown id redirects to the list.
  useEffect(() => {
    if (!routeId || routeId === 'new') {
      // Always reset when entering /new from a stale draft, OR when the
      // draft's campaignId doesn't match the current active campaign (e.g.
      // user switched campaigns since last visit).
      const stale = encounterDraft.groups.length || encounterDraft.manualEntries.length || encounterDraft.status !== 'draft'
      const wrongCampaign = encounterDraft.campaignId !== (activeCampaignId ?? '')
      if (stale || wrongCampaign) resetDraft(activeCampaignId ?? undefined)
      return
    }
    const found = encounters[routeId]
    if (!found) {
      navigate('/encounters', { replace: true })
      return
    }
    if (encounterDraft.id !== found.id) {
      setEncounterDraft({ ...found })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, encounters])

  const allMonsters = useMemo(() => {
    const out = Object.values(customMonsters)
    const seen = new Set(out.map(m => m.slug))
    for (const m of MONSTERS) if (!seen.has(m.slug)) out.push(m)
    return out
  }, [customMonsters])

  const thresholds = useMemo(() => partyXpThresholds(party), [party])
  const difficulty = useMemo(
    () => encounterDraft.groups.length ? calculateDifficulty(party, encounterDraft.groups) : null,
    [party, encounterDraft.groups],
  )

  const [statBlockMonster, setStatBlockMonster] = useState<Monster | null>(null)
  const [query, setQuery] = useState('')
  const [crFilter, setCrFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')

  const crOptions = useMemo(() => [...new Set(allMonsters.map(m => m.challengeRating))].sort((a, b) => crToNum(a) - crToNum(b)), [allMonsters])
  const typeOptions = useMemo(() => [...new Set(allMonsters.map(m => m.type))].sort(), [allMonsters])

  const filteredMonsters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allMonsters.filter(m =>
      (!q || m.name.toLowerCase().includes(q)) &&
      (!crFilter || m.challengeRating === crFilter) &&
      (!typeFilter || m.type === typeFilter) &&
      (!sizeFilter || m.size === sizeFilter),
    ).sort((a, b) => crToNum(a.challengeRating) - crToNum(b.challengeRating))
  }, [allMonsters, query, crFilter, typeFilter, sizeFilter])

  const addMonster = (m: Monster) => {
    const existing = encounterDraft.groups.find(g => g.monsterSlug === m.slug)
    if (existing) {
      setEncounterDraft({ ...encounterDraft, groups: encounterDraft.groups.map(g => g.id === existing.id ? { ...g, quantity: g.quantity + 1 } : g) })
    } else {
      const g: EncounterMonsterGroup = {
        id: uid(), monsterSlug: m.slug, monsterName: m.name,
        cr: m.challengeRating, xp: m.xp, quantity: 1,
        initiativeMode: 'grouped', hpMode: 'average',
        startingHidden: false, startingDisposition: 'enemy',
      }
      setEncounterDraft({ ...encounterDraft, groups: [...encounterDraft.groups, g] })
    }
  }
  const updateGroup = (id: string, patch: Partial<EncounterMonsterGroup>) =>
    setEncounterDraft({ ...encounterDraft, groups: encounterDraft.groups.map(g => g.id === id ? { ...g, ...patch } : g) })
  const removeGroup = (id: string) =>
    setEncounterDraft({ ...encounterDraft, groups: encounterDraft.groups.filter(g => g.id !== id) })

  const addManualEntry = () => {
    const name = window.prompt('Manual entry name (e.g. Lair Action, Trap)')
    if (!name) return
    const m: ManualEncounterEntry = { id: uid(), name, initiative: 20, recurring: true, visibleToPlayers: true }
    setEncounterDraft({ ...encounterDraft, manualEntries: [...encounterDraft.manualEntries, m] })
  }
  const removeManual = (id: string) =>
    setEncounterDraft({ ...encounterDraft, manualEntries: encounterDraft.manualEntries.filter(m => m.id !== id) })
  const updateManual = (id: string, patch: Partial<ManualEncounterEntry>) =>
    setEncounterDraft({ ...encounterDraft, manualEntries: encounterDraft.manualEntries.map(m => m.id === id ? { ...m, ...patch } : m) })

  // ── save / run ──
  const { addToast } = useToast()

  const hasContent = encounterDraft.groups.length > 0 || encounterDraft.manualEntries.length > 0
  const isReady = encounterDraft.status === 'ready'
  const isCompleted = encounterDraft.status === 'completed'
  const isNewRoute = !routeId || routeId === 'new'

  const handleSave = async () => {
    if (!hasContent) {
      addToast('Encounter is empty — add a monster or manual entry first.', 'error')
      return
    }
    if (!encounterDraft.campaignId && !activeCampaignId) {
      addToast('No campaign selected — pick one from Campaigns first.', 'error')
      return
    }
    const e = {
      ...encounterDraft,
      campaignId: encounterDraft.campaignId || activeCampaignId!,
      partySnapshot: party,
      difficulty: difficulty ?? null,
      // Preserve 'completed' (and 'archived') across saves; only drafts get
      // promoted to ready. Otherwise editing notes on a finished encounter
      // would resurrect it as runnable.
      status: encounterDraft.status === 'draft' ? 'ready' : encounterDraft.status,
      updatedAt: new Date().toISOString(),
    }
    try {
      await upsertEncounter(e)
      setEncounterDraft(e)
      addToast(`Saved "${e.name}".`, 'success')
      if (isNewRoute) navigate(`/encounters/${e.id}`, { replace: true })
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error')
    }
  }

  const handleRun = async () => {
    if (!hasContent || !isReady) return
    const e = { ...encounterDraft, partySnapshot: party, updatedAt: new Date().toISOString() }
    await upsertEncounter(e)
    const session = buildSessionFromEncounter(e, party, customMonsters)
    await upsertSession(session)
    setActiveSessionId(session.id)
    navigate('/combat')
  }

  const inputStyle = {
    background: theme.surface2,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: '8px',
  }

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5 backdrop-blur-md"
        style={{ background: `${theme.bg}cc`, borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-3 flex-wrap">
          <input value={encounterDraft.name}
            onChange={e => setEncounterDraft({ ...encounterDraft, name: e.target.value })}
            className="flex-1 min-w-[200px] px-2 py-1 text-lg font-extrabold tracking-tight bg-transparent"
            style={{ color: theme.text, border: 'none', outline: 'none' }} />
          {difficulty && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: DIFF_COLOR[difficulty.difficulty] }}>
              {difficulty.difficulty}
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider"
            style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border}` }}>
            {encounterDraft.status}
          </span>
          {(() => {
            const camp = encounterDraft.campaignId ? campaigns[encounterDraft.campaignId] : activeCampaign
            return camp ? (
              <Link to={`/campaigns/${camp.id}`}
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded hover:opacity-80"
                style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border}`, textDecoration: 'none' }}>
                {camp.name}
              </Link>
            ) : null
          })()}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="primary" onClick={handleSave} disabled={!hasContent}>Save</Button>
            {!isCompleted && (
              <Button onClick={handleRun} disabled={!isReady || !hasContent}
                title={!isReady ? 'Save first to run' : !hasContent ? 'Add a monster or manual entry first' : undefined}>
                Start combat
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Metadata + party summary */}
      <Surface className="p-6 mb-5">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Link to={activeCampaign ? `/campaigns/${activeCampaign.id}` : '/campaigns'}
            className="px-3 py-2 text-sm rounded-lg flex items-center justify-between hover:opacity-90"
            style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, textDecoration: 'none' }}>
            <span>
              Party: {party.characters.length} named · {party.generic.reduce((a, g) => a + g.count, 0)} generic
            </span>
            <span style={{ color: theme.accent }}>Edit →</span>
          </Link>
          <input value={encounterDraft.environment ?? ''}
            onChange={e => setEncounterDraft({ ...encounterDraft, environment: e.target.value })}
            placeholder="Environment (optional)" className="px-3 py-2 text-sm" style={inputStyle} />
        </div>
        <Textarea value={encounterDraft.dmNotes ?? ''}
          onChange={e => setEncounterDraft({ ...encounterDraft, dmNotes: e.target.value })}
          placeholder="DM notes (private)" rows={2} />
      </Surface>

      {/* Builder */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Surface className="p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Browse monsters</h2>
          <p className="text-xs mb-3" style={{ color: theme.text2 }}>
            {MONSTERS.length} SRD bundled
            {Object.keys(customMonsters).length > 0 && ` · ${Object.keys(customMonsters).length} imported`}.
          </p>

          <div className="flex flex-col gap-2 mb-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name…"
              className="px-3 py-2 text-sm w-full" style={inputStyle} />
            <div className="grid grid-cols-3 gap-2 min-w-0">
              <select value={crFilter} onChange={e => setCrFilter(e.target.value)} className="px-2 py-2 text-sm min-w-0 w-full" style={inputStyle}>
                <option value="">Any CR</option>
                {crOptions.map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 py-2 text-sm min-w-0 w-full" style={inputStyle}>
                <option value="">Any type</option>
                {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="px-2 py-2 text-sm min-w-0 w-full" style={inputStyle}>
                <option value="">Any size</option>
                {['Tiny','Small','Medium','Large','Huge','Gargantuan'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5 overflow-auto" style={{ maxHeight: '52vh' }}>
            {filteredMonsters.map(m => (
              <div key={m.slug} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                    {m.name}
                    <button onClick={() => setStatBlockMonster(m)} className="text-[10px] px-1 py-px rounded hover:opacity-80"
                      style={{ background: `${theme.accent}18`, color: theme.accent }}>info</button>
                  </div>
                  <div className="text-[11px] truncate" style={{ color: theme.text2 }}>
                    {m.size} {m.type} · CR {m.challengeRating} ({m.xp} XP) · AC {m.armorClass[0].value} · HP {m.hitPoints.average}
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={() => addMonster(m)}>+ Add</Button>
              </div>
            ))}
            {filteredMonsters.length === 0 && (
              <p className="text-xs" style={{ color: theme.text2 }}>No monsters match those filters.</p>
            )}
          </div>
        </Surface>

        <Surface className="p-6">
          <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Current encounter</h2>
          <p className="text-xs mb-3" style={{ color: theme.text2 }}>
            Adjust quantity, initiative mode, and HP rolling per group.
          </p>

          {!hasContent && (
            <p className="text-sm py-6 text-center" style={{ color: theme.text2 }}>
              Empty. Add monsters from the left, or a manual entry like a lair action.
            </p>
          )}

          <div className="space-y-1.5">
            {encounterDraft.groups.map(g => (
              <div key={g.id} className="px-3 py-2.5 rounded-lg"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: theme.text }}>
                      {g.monsterName}
                      {g.startingDisposition !== 'enemy' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-px rounded"
                          style={{
                            background: g.startingDisposition === 'ally' ? '#22c55e22' : '#9ca3af22',
                            color:      g.startingDisposition === 'ally' ? '#22c55e' : '#9ca3af',
                          }}>
                          {g.startingDisposition}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>CR {g.cr} · {g.xp} XP</div>
                  </div>
                  <button onClick={() => removeGroup(g.id)} aria-label="Remove group"
                    className="text-sm leading-none px-1.5 py-1 rounded hover:opacity-70" style={{ color: theme.text2 }}>✕</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.text2 }}>Qty</span>
                    <input type="number" min={1} max={50} value={g.quantity} onChange={e => updateGroup(g.id, { quantity: +e.target.value || 1 })}
                      className="px-2 py-1 text-sm w-full" style={inputStyle} />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.text2 }}>Side</span>
                    <select value={g.startingDisposition} onChange={e => updateGroup(g.id, { startingDisposition: e.target.value as 'enemy' | 'ally' | 'neutral' })}
                      title="Side in combat — allies/neutrals don't count toward difficulty"
                      className="px-2 py-1 text-xs w-full" style={inputStyle}>
                      <option value="enemy">Enemy</option>
                      <option value="ally">Ally</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.text2 }}>Initiative</span>
                    <select value={g.initiativeMode} onChange={e => updateGroup(g.id, { initiativeMode: e.target.value as 'grouped' | 'individual' })}
                      className="px-2 py-1 text-xs w-full" style={inputStyle}>
                      <option value="grouped">Grouped</option>
                      <option value="individual">Individual</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: theme.text2 }}>HP</span>
                    <select value={g.hpMode} onChange={e => updateGroup(g.id, { hpMode: e.target.value as 'average' | 'rolled' })}
                      className="px-2 py-1 text-xs w-full" style={inputStyle}>
                      <option value="average">Average</option>
                      <option value="rolled">Rolled</option>
                    </select>
                  </label>
                </div>
                <FormsEditor group={g} allMonsters={allMonsters} updateGroup={patch => updateGroup(g.id, patch)} />
              </div>
            ))}
            {encounterDraft.manualEntries.map(m => (
              <div key={m.id} className="grid grid-cols-[1fr_80px_28px] gap-2 items-center px-3 py-2 rounded-lg"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <div>
                  <div className="text-sm font-semibold" style={{ color: theme.text }}>{m.name}</div>
                  <div className="text-[11px]" style={{ color: theme.text2 }}>manual entry</div>
                </div>
                <input type="number" value={m.initiative ?? 20}
                  onChange={e => updateManual(m.id, { initiative: +e.target.value || 0 })}
                  className="px-2 py-1 text-sm" style={inputStyle} />
                <button onClick={() => removeManual(m.id)} className="text-xs hover:opacity-70" style={{ color: theme.text2 }}>✕</button>
              </div>
            ))}
          </div>

          <Button size="sm" className="mt-3" onClick={addManualEntry}>+ Manual entry</Button>

          {difficulty && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider text-white"
                  style={{ background: DIFF_COLOR[difficulty.difficulty] }}>
                  {difficulty.difficulty}
                </span>
                <span className="text-xs" style={{ color: theme.text2 }}>
                  Total XP {difficulty.totalMonsterXp.toLocaleString()} · Adjusted (×{difficulty.monsterCountMultiplier}) {difficulty.adjustedXp.toLocaleString()} · Size adj: {difficulty.partySizeAdjustment}
                </span>
              </div>
              <div className="text-xs mt-1.5" style={{ color: theme.text2 }}>
                Easy {thresholds.easy} · Medium {thresholds.medium} · Hard {thresholds.hard} · Deadly {thresholds.deadly}
              </div>
            </div>
          )}
        </Surface>
      </div>

      <Modal open={!!statBlockMonster} onClose={() => setStatBlockMonster(null)} maxWidth="720px">
        {statBlockMonster && <StatBlock monster={statBlockMonster} />}
      </Modal>

    </div>
  )
}

// Multi-phase boss editor — appears under each monster group. The group's
// monsterSlug is always Phase 1; additional phases (forms[1..N]) trigger
// in-combat transformation when each previous phase drops to 0 HP. group.xp
// is kept in sync with the sum of all phase XPs so difficulty math reflects
// the full HP-pool the party has to grind through.
function FormsEditor({
  group, allMonsters, updateGroup,
}: {
  group: EncounterMonsterGroup
  allMonsters: Monster[]
  updateGroup: (patch: Partial<EncounterMonsterGroup>) => void
}) {
  const { theme } = useTheme()
  const extraForms = group.forms && group.forms.length > 1 ? group.forms.slice(1) : []
  const [open, setOpen] = useState(extraForms.length > 0)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')

  // Phases are a boss feature — hide them entirely for trivial creatures.
  // Threshold is CR 5 (gates only the picker; existing phases still render so
  // the user can remove them if they swap a high-CR primary for a low-CR one).
  if (crToNum(group.cr) < 5 && extraForms.length === 0) return null

  const primaryForm: FormRef = {
    monsterSlug: group.monsterSlug,
    monsterName: group.monsterName,
    cr: group.cr,
    xp: allMonsters.find(m => m.slug === group.monsterSlug)?.xp ?? group.xp,
  }

  const writeForms = (next: FormRef[]) => {
    if (next.length <= 1) {
      updateGroup({ forms: undefined, xp: primaryForm.xp })
      return
    }
    const xp = next.reduce((a, f) => a + f.xp, 0)
    updateGroup({ forms: next, xp })
  }

  const addForm = (m: Monster) => {
    const current: FormRef[] = group.forms?.length ? [...group.forms] : [primaryForm]
    current.push({ monsterSlug: m.slug, monsterName: m.name, cr: m.challengeRating, xp: m.xp })
    writeForms(current)
    setPicking(false); setQuery('')
  }
  const removeFormAt = (idx: number) => {
    // idx is 1-based into group.forms (Phase 1 is primary, can't be removed here)
    const current: FormRef[] = group.forms?.length ? [...group.forms] : [primaryForm]
    current.splice(idx, 1)
    writeForms(current)
  }
  const moveForm = (idx: number, dir: -1 | 1) => {
    const current: FormRef[] = group.forms?.length ? [...group.forms] : [primaryForm]
    const target = idx + dir
    if (target < 1 || target >= current.length) return  // primary is locked at idx 0
    ;[current[idx], current[target]] = [current[target], current[idx]]
    writeForms(current)
  }

  const pickerResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allMonsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [allMonsters, query])

  const totalXp = (group.forms && group.forms.length > 1)
    ? group.forms.reduce((a, f) => a + f.xp, 0)
    : null

  return (
    <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${theme.border}` }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 text-left hover:opacity-90"
        style={{ background: 'transparent', border: 'none', color: 'inherit' }}>
        <span className="text-xs font-mono w-3 shrink-0" style={{ color: theme.text2 }}>
          {open ? '▾' : '▸'}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.text2 }}>
          Phases
        </span>
        <span className="text-[11px] ml-1" style={{ color: theme.text2 }}>
          {extraForms.length === 0 ? 'single form' : `${extraForms.length + 1} phases · ${totalXp?.toLocaleString()} XP total`}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {/* Primary (Phase 1) — locked, mirrors group.monsterSlug */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
            style={{ background: theme.surface, border: `1px dashed ${theme.border}` }}>
            <span className="font-bold w-12 shrink-0" style={{ color: theme.text2 }}>Phase 1</span>
            <span className="flex-1 min-w-0 truncate" style={{ color: theme.text }}>{primaryForm.monsterName}</span>
            <span style={{ color: theme.text2 }}>CR {primaryForm.cr} · {primaryForm.xp} XP</span>
          </div>

          {/* Subsequent phases */}
          {(group.forms ?? []).slice(1).map((f, i) => {
            const realIdx = i + 1  // index into group.forms
            return (
              <div key={realIdx} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                <span className="font-bold w-12 shrink-0" style={{ color: theme.accent }}>Phase {realIdx + 1}</span>
                <span className="flex-1 min-w-0 truncate" style={{ color: theme.text }}>{f.monsterName}</span>
                <span style={{ color: theme.text2 }}>CR {f.cr} · {f.xp} XP</span>
                <button type="button" onClick={() => moveForm(realIdx, -1)}
                  disabled={realIdx <= 1}
                  className="px-1 hover:opacity-70 disabled:opacity-30"
                  style={{ color: theme.text2 }}>↑</button>
                <button type="button" onClick={() => moveForm(realIdx, +1)}
                  disabled={realIdx >= (group.forms?.length ?? 1) - 1}
                  className="px-1 hover:opacity-70 disabled:opacity-30"
                  style={{ color: theme.text2 }}>↓</button>
                <button type="button" onClick={() => removeFormAt(realIdx)}
                  className="px-1 hover:opacity-70"
                  style={{ color: theme.text2 }}>✕</button>
              </div>
            )
          })}

          {/* Add-next-phase picker */}
          {!picking ? (
            <Button type="button" size="sm" onClick={() => setPicking(true)}>+ Add next phase</Button>
          ) : (
            <div className="relative">
              <input value={query} onChange={e => setQuery(e.target.value)} autoFocus
                placeholder="Search monster for next phase…"
                onKeyDown={e => { if (e.key === 'Escape') { setPicking(false); setQuery('') } }}
                className="w-full px-2 py-1.5 text-xs"
                style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: '6px' }} />
              {pickerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md overflow-hidden"
                  style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  {pickerResults.map(m => (
                    <button key={m.slug} type="button" onClick={() => addForm(m)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:opacity-80"
                      style={{ color: theme.text, background: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
                      {m.name} <span style={{ color: theme.text2 }}>CR {m.challengeRating} · {m.xp} XP</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => { setPicking(false); setQuery('') }}
                className="text-[10px] mt-1 hover:underline" style={{ color: theme.text2 }}>cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
