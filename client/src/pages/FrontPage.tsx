import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { MONSTERS } from '@/data/monsters'
import { SPELLS } from '@/data/spells'
import { buildSessionFromEncounter } from '@/engine/combat'
import { Surface, Button } from '@/components/ui'

const RECENT_ENCOUNTERS = 3
const RECENT_SESSIONS = 3

export default function FrontPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const {
    campaigns, activeCampaignId, activeCampaign,
    party, encounters, sessions, activeSessionId,
    customMonsters, customSpells,
    upsertEncounter, upsertSession, setActiveSessionId,
  } = useCombat()

  const activeSessionRaw = activeSessionId ? sessions[activeSessionId] : null
  const activeSession = activeSessionRaw && activeSessionRaw.status !== 'completed' ? activeSessionRaw : null

  // Scope encounters and recent encounters to the active campaign.
  const campaignEncounters = useMemo(
    () => activeCampaignId
      ? Object.values(encounters).filter(e => e.campaignId === activeCampaignId)
      : [],
    [encounters, activeCampaignId],
  )
  const recentEncounters = useMemo(
    () => [...campaignEncounters]
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      .slice(0, RECENT_ENCOUNTERS),
    [campaignEncounters],
  )
  const recentSessions = useMemo(
    () => Object.values(sessions)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      .slice(0, RECENT_SESSIONS),
    [sessions],
  )

  const totalCharacters = party.characters.length
  const totalGeneric = party.generic.reduce((a, g) => a + g.count, 0)
  const partyConfigured = totalCharacters > 0 || totalGeneric > 0

  const importedMonsterCount = Object.keys(customMonsters).length
  const importedSpellCount = Object.keys(customSpells).length
  const encounterCount = campaignEncounters.length
  const sessionCount = Object.keys(sessions).length
  const campaignCount = Object.keys(campaigns).length

  const runEncounter = async (e: typeof recentEncounters[number]) => {
    const e2 = { ...e, partySnapshot: party, updatedAt: new Date().toISOString() }
    await upsertEncounter(e2)
    const session = buildSessionFromEncounter(e2, party, customMonsters)
    await upsertSession(session)
    setActiveSessionId(session.id)
    navigate('/combat')
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>
            The setup flow: pick content, build a party, prep encounters, run combat.
          </p>
        </div>
        {activeCampaign && (
          <Link to={`/campaigns/${activeCampaign.id}`}
            className="text-xs px-3 py-1.5 rounded-lg hover:opacity-90"
            style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.accent}`, textDecoration: 'none' }}>
            <span className="font-bold" style={{ color: theme.accent }}>Campaign:</span> {activeCampaign.name}
          </Link>
        )}
      </div>

      {/* Active combat hero — only when something's running */}
      {activeSession && (
        <div className="rounded-2xl p-5 mb-5"
          style={{ background: theme.gradient, color: 'white', boxShadow: `0 6px 20px ${theme.accent}30` }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider opacity-80">Combat in progress</div>
              <div className="text-lg font-bold">{activeSession.encounterName}</div>
              <div className="text-xs opacity-90">
                {activeSession.status} · round {activeSession.roundNumber} · {activeSession.combatants.length} combatants
              </div>
            </div>
            <Link to="/combat"
              className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.2)', color: 'white', textDecoration: 'none' }}>
              Resume →
            </Link>
          </div>
        </div>
      )}

      <StepCard
        n={1}
        title="Campaign"
        status={activeCampaign ? 'ready' : 'todo'}
        summary={activeCampaign
          ? `Active: ${activeCampaign.name}${partyConfigured
              ? ` · ${totalCharacters} named${totalGeneric > 0 ? ` · ${totalGeneric} generic` : ''}`
              : ' · no party yet'}`
          : 'No active campaign'}
        extra={activeCampaign
          ? `${campaignCount} campaign${campaignCount === 1 ? '' : 's'} total${activeCampaign.notes ? ' · has notes' : ''}`
          : 'Pick or create one to scope party, encounters, and notes.'}
        actions={activeCampaign
          ? [
              { to: `/campaigns/${activeCampaign.id}`, label: partyConfigured ? 'Open campaign' : 'Set up party', kind: partyConfigured ? 'secondary' : 'primary' },
            ]
          : [{ to: '/campaigns', label: 'Manage campaigns', kind: 'primary' }]}
      />

      <StepCard
        n={2}
        title="Compendium"
        status="ready"
        summary={`${MONSTERS.length} monsters · ${SPELLS.length} spells bundled (SRD 5.1)`}
        extra={(importedMonsterCount > 0 || importedSpellCount > 0)
          ? `${importedMonsterCount} imported monster${importedMonsterCount === 1 ? '' : 's'} · ${importedSpellCount} imported spell${importedSpellCount === 1 ? '' : 's'}`
          : 'No imports yet — bring in book-specific content from 5e.tools'}
        actions={[
          { to: '/compendium', label: 'Browse', kind: 'secondary' },
        ]}
      />

      <StepCard
        n={3}
        title="Encounters"
        status={encounterCount > 0 ? 'ready' : 'todo'}
        summary={encounterCount > 0
          ? `${encounterCount} encounter${encounterCount === 1 ? '' : 's'} in this campaign`
          : 'No encounters in this campaign yet'}
        actions={[
          { to: '/encounters/new', label: '+ New encounter', kind: 'primary' },
        ]}
      >
        {recentEncounters.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {recentEncounters.map(e => {
              const monCt = e.groups.reduce((a, g) => a + g.quantity, 0)
              return (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg flex-wrap"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <Link to={`/encounters/${e.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                    <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                      {e.name}
                      {e.difficulty && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
                          style={{ background: theme.accent }}>{e.difficulty.difficulty}</span>
                      )}
                      {e.status === 'completed' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: '#9ca3af22', color: '#6b7280' }}>completed</span>
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>
                      {monCt} monster{monCt === 1 ? '' : 's'} · {e.environment || 'no environment'}
                      {e.updatedAt ? ` · ${new Date(e.updatedAt).toLocaleDateString()}` : ''}
                    </div>
                  </Link>
                  {e.status !== 'completed' && (
                    <Button variant="primary" size="sm" onClick={() => runEncounter(e)}>Start combat</Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </StepCard>

      <StepCard
        n={4}
        title="Combat"
        status={activeSession ? 'active' : sessionCount > 0 ? 'ready' : 'todo'}
        summary={activeSession
          ? `In progress — ${activeSession.encounterName}, round ${activeSession.roundNumber}`
          : sessionCount > 0
            ? `${sessionCount} past session${sessionCount === 1 ? '' : 's'}`
            : 'No combat yet — run an encounter to start one'}
        actions={activeSession
          ? [{ to: '/combat', label: 'Open combat →', kind: 'primary' }]
          : sessionCount > 0
            ? [{ to: '/combat', label: 'Recent sessions →', kind: 'secondary' }]
            : []}
      >
        {!activeSession && recentSessions.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {recentSessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg flex-wrap"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: theme.text }}>{s.encounterName ?? 'Untitled'}</div>
                  <div className="text-[11px]" style={{ color: theme.text2 }}>
                    {s.status} · round {s.roundNumber} · {s.combatants.length} combatants
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={() => { setActiveSessionId(s.id); navigate('/combat') }}>
                  {s.status === 'completed' ? 'View' : 'Resume'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </StepCard>
    </div>
  )
}

// ── StepCard ────────────────────────────────────────────────────────────

type StepStatus = 'ready' | 'todo' | 'active'
type ActionKind = 'primary' | 'secondary' | 'link'
interface StepAction { to: string; label: string; kind: ActionKind }

function StepCard(props: {
  n: number
  title: string
  status: StepStatus
  summary: string
  extra?: string
  actions: StepAction[]
  children?: ReactNode
}) {
  const { theme } = useTheme()
  const { n, title, status, summary, extra, actions, children } = props

  const statusStyles: Record<StepStatus, { bg: string; color: string; label: string }> = {
    ready:  { bg: '#22c55e22', color: '#16a34a', label: 'Ready' },
    todo:   { bg: `${theme.text2}22`, color: theme.text2, label: 'To do' },
    active: { bg: `${theme.accent}22`, color: theme.accent, label: 'Active' },
  }
  const s = statusStyles[status]

  return (
    <Surface className="p-5 mb-3 flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
        style={{ background: theme.surface2, color: theme.text2, border: `1px solid ${theme.border}` }}>
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold" style={{ color: theme.text }}>{title}</h2>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: s.bg, color: s.color }}>{s.label}</span>
        </div>
        <p className="text-sm mt-1" style={{ color: theme.text }}>{summary}</p>
        {extra && <p className="text-xs mt-0.5" style={{ color: theme.text2 }}>{extra}</p>}
        {actions.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            {actions.map(a => (
              <Link key={a.to + a.label} to={a.to}
                className={
                  a.kind === 'primary'
                    ? 'text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90'
                    : a.kind === 'secondary'
                      ? 'text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80'
                      : 'text-xs font-semibold hover:underline'
                }
                style={
                  a.kind === 'primary'
                    ? { background: theme.gradient, textDecoration: 'none' }
                    : a.kind === 'secondary'
                      ? { background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, textDecoration: 'none' }
                      : { color: theme.accent }
                }>
                {a.label}
              </Link>
            ))}
          </div>
        )}
        {children}
      </div>
    </Surface>
  )
}
