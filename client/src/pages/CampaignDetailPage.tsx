import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { MONSTERS } from '@/data/monsters'
import { SRD_RULE_ELEMENTS } from '@/data/rules'
import { partyXpThresholds } from '@/engine/difficulty'
import { buildSessionFromEncounter } from '@/engine/combat'
import { deriveCharacter } from '@/rules/deriveCharacter'
import { useConfirm } from '@/components/ConfirmDialog'
import type { Campaign, Encounter, NamedCharacter } from '@/types'
import { Surface, Button, Textarea } from '@/components/ui'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function CampaignDetailPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const confirm = useConfirm()
  const {
    campaigns, activeCampaignId, setActiveCampaignId, upsertCampaign,
    encounters, upsertEncounter, deleteEncounter,
    customMonsters, upsertSession, setActiveSessionId,
    characters, customRuleElements, upsertCharacter,
  } = useCombat()

  const campaign = id ? campaigns[id] : null
  if (id && !campaign && Object.keys(campaigns).length > 0) {
    return <Navigate to="/campaigns" replace />
  }
  if (!campaign) {
    return (
      <div className="text-sm" style={{ color: theme.text2 }}>Loading…</div>
    )
  }

  const isActive = campaign.id === activeCampaignId
  const party = campaign.party
  const rules = [...Object.values(customRuleElements), ...SRD_RULE_ELEMENTS]
  const sheetPartyCharacters = Object.values(characters)
    .filter(c => c.campaignId === campaign.id)
    .map(c => {
      const d = deriveCharacter(c, rules)
      return {
        id: c.id,
        name: c.name,
        level: d.level,
        maxHp: d.maxHp,
        currentHp: d.currentHp,
        armorClass: d.armorClass,
        initiativeBonus: d.initiativeBonus,
        notes: c.notes,
      }
    })
    .filter(c => !party.characters.some(existing => existing.id === c.id))
  const assignableCharacters = Object.values(characters)
    .filter(c => c.campaignId !== campaign.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const effectiveParty = { ...party, characters: [...party.characters, ...sheetPartyCharacters] }
  const thresholds = partyXpThresholds(effectiveParty)

  const update = (patch: Partial<Campaign>) => {
    upsertCampaign({ ...campaign, ...patch, updatedAt: new Date().toISOString() })
  }
  const updateParty = (patch: Partial<typeof party>) => {
    update({ party: { ...party, ...patch } })
  }

  const inputStyle = {
    background: theme.surface2,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: '8px',
  }

  // ── Party handlers ──
  const addGenericRow = () => updateParty({ generic: [...party.generic, { level: 3, count: 1 }] })
  const removeGenericRow = (i: number) => updateParty({ generic: party.generic.filter((_, idx) => idx !== i) })
  const setGenericRow = (i: number, patch: Partial<{ level: number; count: number }>) =>
    updateParty({ generic: party.generic.map((g, idx) => idx === i ? { ...g, ...patch } : g) })

  const addCharacter = () => {
    const c: NamedCharacter = { id: uid(), name: 'New Character', level: 3, maxHp: 25, currentHp: 25, armorClass: 14, initiativeBonus: 2 }
    updateParty({ characters: [...party.characters, c] })
  }
  const updateCharacter = (cid: string, patch: Partial<NamedCharacter>) =>
    updateParty({ characters: party.characters.map(c => c.id === cid ? { ...c, ...patch } : c) })
  const removeCharacter = (cid: string) =>
    updateParty({ characters: party.characters.filter(c => c.id !== cid) })
  const assignSheetCharacter = (cid: string) => {
    const c = characters[cid]
    if (!c) return
    upsertCharacter({ ...c, campaignId: campaign.id, updatedAt: new Date().toISOString() })
  }
  const detachSheetCharacter = (cid: string) => {
    const c = characters[cid]
    if (!c) return
    upsertCharacter({ ...c, campaignId: '', updatedAt: new Date().toISOString() })
  }

  // ── Encounters scoped to this campaign ──
  const campaignEncounters = useMemo(
    () => Object.values(encounters)
      .filter(e => e.campaignId === campaign.id)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [encounters, campaign.id],
  )

  const runEncounter = async (e: Encounter) => {
    const e2 = { ...e, partySnapshot: effectiveParty, updatedAt: new Date().toISOString() }
    await upsertEncounter(e2)
    const session = buildSessionFromEncounter(e2, effectiveParty, customMonsters)
    await upsertSession(session)
    setActiveSessionId(session.id)
    setActiveCampaignId(campaign.id)
    navigate('/combat')
  }

  // ── Monster notes: editor with picker ──
  const allMonsters = useMemo(() => {
    const out = Object.values(customMonsters)
    const seen = new Set(out.map(m => m.slug))
    for (const m of MONSTERS) if (!seen.has(m.slug)) out.push(m)
    return out
  }, [customMonsters])

  // Party section is collapsed by default once configured — it's a one-off setup
  // panel that becomes noise on every campaign visit afterwards. Opens
  // automatically only when the party is genuinely empty (no characters and zero
  // generic count), or when the user clicks the header to expand.
  const partyHasContent = party.characters.length > 0 || party.generic.some(g => g.count > 0)
  const [partyOpen, setPartyOpen] = useState(!partyHasContent)

  const [noteQuery, setNoteQuery] = useState('')
  // Per-slug expanded state. Newly-added entries (via picker) auto-open; everything
  // else starts collapsed so a long list stays scannable.
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const toggleExpanded = (slug: string) =>
    setExpandedNotes(prev => ({ ...prev, [slug]: !prev[slug] }))

  // Dated session-log entries — same expand/collapse pattern as creature notes.
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const toggleSession = (id: string) =>
    setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }))
  const sessionLog = campaign.sessionLog ?? []
  const sortedSessions = [...sessionLog].sort((a, b) => b.date.localeCompare(a.date))

  const todayISO = () => new Date().toISOString().slice(0, 10)
  const addSessionEntry = () => {
    const entry = { id: uid(), date: todayISO(), notes: '' }
    update({ sessionLog: [...sessionLog, entry] })
    setExpandedSessions(prev => ({ ...prev, [entry.id]: true }))
  }
  const updateSessionEntry = (id: string, patch: Partial<{ date: string; notes: string }>) => {
    update({ sessionLog: sessionLog.map(s => s.id === id ? { ...s, ...patch } : s) })
  }
  const removeSessionEntry = (id: string) => {
    update({ sessionLog: sessionLog.filter(s => s.id !== id) })
  }
  const notedSlugs = Object.keys(campaign.monsterNotes ?? {})
  // Add via picker — inserts an empty entry so the row appears and can be typed
  // into. Editing then happens directly via `update` on the textarea; the row
  // sticks around even when emptied so a quick clear doesn't tear it off.
  const addMonsterNoteSlug = (slug: string) => {
    if (campaign.monsterNotes?.[slug] == null) {
      update({ monsterNotes: { ...(campaign.monsterNotes ?? {}), [slug]: '' } })
    }
    setExpandedNotes(prev => ({ ...prev, [slug]: true }))
  }
  // Explicit remove — used by the ✕ button so editing a textarea down to empty
  // doesn't accidentally tear off the row mid-edit.
  const removeMonsterNoteSlug = (slug: string) => {
    const next = { ...(campaign.monsterNotes ?? {}) }
    delete next[slug]
    update({ monsterNotes: next })
  }

  const pickerResults = useMemo(() => {
    const q = noteQuery.trim().toLowerCase()
    if (!q) return []
    return allMonsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [allMonsters, noteQuery])

  const slugName = (slug: string) => allMonsters.find(m => m.slug === slug)?.name ?? slug

  return (
    <div>
      <div className="mb-5 flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input value={campaign.name}
            onChange={e => update({ name: e.target.value })}
            className="w-full px-2 py-1 text-2xl font-extrabold tracking-tight bg-transparent"
            style={{ color: theme.text, border: 'none', outline: 'none' }} />
          <input value={campaign.description ?? ''}
            onChange={e => update({ description: e.target.value })}
            placeholder="Short description (optional)"
            className="w-full px-2 py-0.5 text-sm bg-transparent"
            style={{ color: theme.text2, border: 'none', outline: 'none' }} />
        </div>
        {isActive ? (
          <span className="px-2 py-1 text-[10px] uppercase tracking-wider rounded text-white"
            style={{ background: theme.accent }}>active</span>
        ) : (
          <Button size="sm" onClick={() => setActiveCampaignId(campaign.id)}>Set active</Button>
        )}
      </div>

      {/* Party */}
      <Surface className="p-6 mb-5">
        <button type="button" onClick={() => setPartyOpen(o => !o)}
          aria-expanded={partyOpen}
          className="w-full flex items-center gap-2 text-left hover:opacity-90"
          style={{ background: 'transparent', border: 'none', color: 'inherit', marginBottom: partyOpen ? '8px' : '0' }}>
          <span className="text-xs font-mono w-3 shrink-0" style={{ color: theme.text2 }}>
            {partyOpen ? '▾' : '▸'}
          </span>
          <h2 className="text-base font-bold shrink-0" style={{ color: theme.text }}>Party</h2>
          <span className="text-xs ml-auto shrink-0" style={{ color: theme.text2 }}>
            {effectiveParty.characters.length} named · {party.generic.reduce((a, g) => a + g.count, 0)} generic
            {!partyOpen && partyHasContent && (
              <> · M {thresholds.medium.toLocaleString()} · D {thresholds.deadly.toLocaleString()} XP</>
            )}
          </span>
        </button>

        {partyOpen && <>
        <p className="text-xs mb-3 mt-2" style={{ color: theme.text2 }}>
          Generic groups are level × count for difficulty math. Full character sheets assigned to this campaign are included automatically.
        </p>

        {sheetPartyCharacters.length > 0 && (
          <div className="mb-3 rounded-lg p-3" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.text2 }}>Character sheets</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {sheetPartyCharacters.map(c => (
                <div key={c.id} className="text-xs flex items-center gap-2 justify-between" style={{ color: theme.text }}>
                  <span>{c.name} · Level {c.level} · AC {c.armorClass} · HP {c.currentHp}/{c.maxHp}</span>
                  <button type="button" onClick={() => detachSheetCharacter(c.id)}
                    className="text-[11px] hover:opacity-70 shrink-0"
                    style={{ color: theme.text2 }}>
                    detach
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 rounded-lg p-3" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: theme.text2 }}>Assign character sheets</div>
              <div className="text-xs" style={{ color: theme.text2 }}>Attach full character sheets to this campaign party.</div>
            </div>
          </div>
          {assignableCharacters.length === 0 ? (
            <p className="text-xs" style={{ color: theme.text2 }}>No unassigned character sheets available.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {assignableCharacters.map(c => {
                const d = deriveCharacter(c, rules)
                const currentCampaign = c.campaignId ? campaigns[c.campaignId]?.name : null
                return (
                  <div key={c.id} className="flex items-center gap-2 justify-between rounded-md px-2 py-1.5"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: theme.text }}>{c.name}</div>
                      <div className="text-[11px] truncate" style={{ color: theme.text2 }}>
                        Level {d.level}{currentCampaign ? ` · currently in ${currentCampaign}` : ' · unassigned'}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => assignSheetCharacter(c.id)}>Assign</Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 mb-3">
          {party.generic.map((g, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-xs" style={{ color: theme.text2 }}>Level</span>
              <input type="number" min={1} max={20} value={g.level} onChange={e => setGenericRow(i, { level: +e.target.value || 1 })}
                className="px-2 py-1 w-16 text-sm" style={inputStyle} />
              <span className="text-xs" style={{ color: theme.text2 }}>× count</span>
              <input type="number" min={0} max={12} value={g.count} onChange={e => setGenericRow(i, { count: +e.target.value || 0 })}
                className="px-2 py-1 w-16 text-sm" style={inputStyle} />
              <button onClick={() => removeGenericRow(i)} className="text-xs px-2 py-1 rounded-md hover:opacity-70"
                style={{ color: theme.text2 }}>✕</button>
            </div>
          ))}
          <Button size="sm" onClick={addGenericRow}>+ Add level group</Button>
        </div>

        {party.characters.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="grid grid-cols-[1.5fr_60px_70px_60px_70px_28px] gap-2 text-[10px] font-bold uppercase tracking-wider pb-1 border-b" style={{ color: theme.text2, borderColor: theme.border }}>
              <span>Name</span><span>Level</span><span>Max HP</span><span>AC</span><span>Init Bonus</span><span></span>
            </div>
            {party.characters.map(c => (
              <div key={c.id} className="grid grid-cols-[1.5fr_60px_70px_60px_70px_28px] gap-2 items-center text-sm">
                <input value={c.name} onChange={e => updateCharacter(c.id, { name: e.target.value })}
                  className="px-2 py-1 text-sm" style={inputStyle} placeholder="Name" />
                <input type="number" value={c.level} min={1} max={20}
                  onChange={e => updateCharacter(c.id, { level: +e.target.value || 1 })}
                  className="px-2 py-1 text-sm" style={inputStyle} />
                <input type="number" value={c.maxHp} min={1}
                  onChange={e => { const v = +e.target.value || 1; updateCharacter(c.id, { maxHp: v, currentHp: Math.min(c.currentHp, v) }) }}
                  className="px-2 py-1 text-sm" style={inputStyle} />
                <input type="number" value={c.armorClass} min={5} max={30}
                  onChange={e => updateCharacter(c.id, { armorClass: +e.target.value || 10 })}
                  className="px-2 py-1 text-sm" style={inputStyle} />
                <input type="number" value={c.initiativeBonus} min={-5} max={15}
                  onChange={e => updateCharacter(c.id, { initiativeBonus: +e.target.value || 0 })}
                  className="px-2 py-1 text-sm" style={inputStyle} />
                <button onClick={() => removeCharacter(c.id)} className="text-xs hover:opacity-70" style={{ color: theme.text2 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" onClick={addCharacter}>+ Add named character</Button>

        <div className="grid grid-cols-4 gap-2 mt-4">
          {(['easy','medium','hard','deadly'] as const).map(k => (
            <div key={k} className="rounded-lg p-3 text-center" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: theme.text2 }}>{k}</div>
              <div className="text-lg font-bold mt-0.5" style={{ color: theme.accent }}>
                {thresholds[k].toLocaleString()} <span className="text-[10px] font-normal" style={{ color: theme.text2 }}>XP</span>
              </div>
            </div>
          ))}
        </div>
        </>}
      </Surface>

      {/* Notes */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Campaign notes</h2>
        <p className="text-xs mb-2" style={{ color: theme.text2 }}>
          Top textarea is campaign-wide (world, hooks, standing facts). Dated entries below are a session log.
        </p>
        <Textarea value={campaign.notes ?? ''}
          onChange={e => update({ notes: e.target.value })}
          rows={3}
          placeholder="Campaign-wide notes…"
          className="font-mono leading-relaxed" />

        <div className="flex items-center justify-between mt-4 mb-2">
          <h3 className="text-sm font-bold" style={{ color: theme.text }}>Session log</h3>
          <Button size="sm" onClick={addSessionEntry}>+ Add entry</Button>
        </div>

        {sortedSessions.length === 0 ? (
          <p className="text-xs" style={{ color: theme.text2 }}>No dated entries yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedSessions.map(entry => {
              const isOpen = !!expandedSessions[entry.id]
              const firstLine = entry.notes.split('\n')[0].trim()
              const preview = firstLine || <span style={{ color: theme.text2, fontStyle: 'italic' }}>(empty)</span>
              return (
                <div key={entry.id} className="rounded-lg"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => toggleSession(entry.id)}
                      aria-expanded={isOpen}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-90"
                      style={{ background: 'transparent', border: 'none', color: 'inherit' }}>
                      <span className="text-xs font-mono w-3 shrink-0" style={{ color: theme.text2 }}>
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="text-sm font-semibold font-mono shrink-0" style={{ color: theme.text }}>
                        {entry.date}
                      </span>
                      {!isOpen && (
                        <span className="text-xs truncate min-w-0 flex-1" style={{ color: theme.text2 }}>
                          — {preview}
                        </span>
                      )}
                    </button>
                    <button type="button" onClick={() => removeSessionEntry(entry.id)}
                      className="text-xs hover:opacity-70 shrink-0 px-1"
                      style={{ background: 'transparent', border: 'none', color: theme.text2 }}>
                      ✕ remove
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      <input type="date" value={entry.date}
                        onChange={e => updateSessionEntry(entry.id, { date: e.target.value })}
                        className="px-2 py-1 text-xs font-mono"
                        style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: '6px' }} />
                      <Textarea value={entry.notes} autoFocus
                        onChange={e => updateSessionEntry(entry.id, { notes: e.target.value })}
                        rows={10}
                        placeholder="What happened in this session…"
                        className="font-mono leading-relaxed" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Surface>

      {/* Monster / NPC notes */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-2" style={{ color: theme.text }}>Creature notes</h2>
        <p className="text-xs mb-3" style={{ color: theme.text2 }}>
          Notes attached to a specific monster/NPC by slug. Shown in the combat tracker when that combatant is selected.
        </p>

        <div className="relative mb-3">
          <input value={noteQuery} onChange={e => setNoteQuery(e.target.value)}
            placeholder="Search a monster to add notes for…"
            className="w-full px-3 py-2 text-sm" style={inputStyle} />
          {pickerResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden"
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              {pickerResults.map(m => (
                <button key={m.slug}
                  onClick={() => { addMonsterNoteSlug(m.slug); setNoteQuery('') }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80"
                  style={{ color: theme.text, background: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
                  {m.name} <span className="text-[11px]" style={{ color: theme.text2 }}>CR {m.challengeRating}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {notedSlugs.length === 0 ? (
          <p className="text-xs" style={{ color: theme.text2 }}>No creature notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notedSlugs.map(slug => {
              const note = campaign.monsterNotes?.[slug] ?? ''
              const isOpen = !!expandedNotes[slug]
              const firstLine = note.split('\n')[0].trim()
              const preview = firstLine || <span style={{ color: theme.text2, fontStyle: 'italic' }}>(empty)</span>
              return (
                <div key={slug} className="rounded-lg"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => toggleExpanded(slug)}
                      aria-expanded={isOpen}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-90"
                      style={{ background: 'transparent', border: 'none', color: 'inherit' }}>
                      <span className="text-xs font-mono w-3 shrink-0" style={{ color: theme.text2 }}>
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className="text-sm font-semibold shrink-0" style={{ color: theme.text }}>{slugName(slug)}</span>
                      {!isOpen && (
                        <span className="text-xs truncate min-w-0 flex-1" style={{ color: theme.text2 }}>
                          — {preview}
                        </span>
                      )}
                    </button>
                    <button type="button" onClick={() => removeMonsterNoteSlug(slug)}
                      className="text-xs hover:opacity-70 shrink-0 px-1"
                      style={{ background: 'transparent', border: 'none', color: theme.text2 }}>
                      ✕ remove
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3">
                      <Textarea value={note} autoFocus
                        onChange={e => update({ monsterNotes: { ...(campaign.monsterNotes ?? {}), [slug]: e.target.value } })}
                        rows={10}
                        placeholder="Notes…"
                        className="font-mono leading-relaxed" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Surface>

      {/* Encounters in this campaign */}
      <Surface className="p-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-base font-bold" style={{ color: theme.text }}>Encounters</h2>
          <Link to="/encounters/new"
            onClick={() => { if (!isActive) setActiveCampaignId(campaign.id) }}
            className="inline-flex items-center justify-center gap-1.5 font-semibold transition-opacity hover:opacity-90 px-3 py-1.5 text-xs rounded-lg text-white"
            style={{ background: 'var(--brand-gradient)', textDecoration: 'none' }}>
            + New encounter
          </Link>
        </div>
        {campaignEncounters.length === 0 ? (
          <p className="text-xs" style={{ color: theme.text2 }}>No encounters in this campaign yet.</p>
        ) : (
          <div className="space-y-1.5">
            {campaignEncounters.map(e => {
              const monCt = e.groups.reduce((a, g) => a + g.quantity, 0)
              return (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg flex-wrap"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <Link to={`/encounters/${e.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                    <div className="text-sm font-semibold" style={{ color: theme.text }}>{e.name}</div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>
                      {monCt} monster{monCt === 1 ? '' : 's'} · {e.status}
                      {e.environment ? ` · ${e.environment}` : ''}
                    </div>
                  </Link>
                  <div className="flex gap-1.5">
                    {e.status !== 'completed' && (
                      <Button variant="primary" size="sm" onClick={() => runEncounter(e)}>Start combat</Button>
                    )}
                    <Button variant="danger" size="sm" onClick={async () => { if (await confirm({ title: 'Delete encounter', message: `Delete "${e.name}"?`, confirmLabel: 'Delete', destructive: true })) deleteEncounter(e.id) }}>Delete</Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Surface>
    </div>
  )
}
