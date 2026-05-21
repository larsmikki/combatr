import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { buildSessionFromEncounter } from '@/engine/combat'
import type { Encounter } from '@/types'
import { useConfirm } from '@/components/ConfirmDialog'
import { Surface, Button } from '@/components/ui'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function EncountersListPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const {
    encounters, party, customMonsters,
    activeCampaignId, activeCampaign,
    upsertEncounter, deleteEncounter,
    upsertSession, setActiveSessionId,
  } = useCombat()
  const confirm = useConfirm()

  const list = useMemo(
    () => Object.values(encounters)
      .filter(e => !activeCampaignId || e.campaignId === activeCampaignId)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [encounters, activeCampaignId],
  )

  const duplicateEncounter = async (e: Encounter) => {
    const copy: Encounter = {
      ...e,
      id: uid(),
      campaignId: activeCampaignId ?? e.campaignId,
      name: e.name + ' (copy)',
      status: 'draft',
      updatedAt: new Date().toISOString(),
    }
    await upsertEncounter(copy)
    navigate(`/encounters/${copy.id}`)
  }

  const runEncounter = async (e: Encounter) => {
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
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Encounters</h1>
          <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>
            {activeCampaign
              ? <>Encounters in <Link to={`/campaigns/${activeCampaign.id}`} className="hover:underline" style={{ color: theme.accent }}>{activeCampaign.name}</Link>. Edit, duplicate, or run.</>
              : 'Pick a campaign to scope encounters.'}
          </p>
        </div>
        <Link to="/encounters/new"
          className="inline-flex items-center justify-center gap-1.5 font-semibold transition-opacity hover:opacity-90 px-3 py-1.5 text-xs rounded-lg text-white"
          style={{ background: 'var(--brand-gradient)', textDecoration: 'none' }}>
          + New encounter
        </Link>
      </div>

      <Surface className="p-6">
        {list.length === 0 ? (
          <p className="text-xs" style={{ color: theme.text2 }}>
            No saved encounters yet. Start one with <Link to="/encounters/new" className="hover:underline" style={{ color: theme.accent }}>+ New encounter</Link>.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map(e => {
              const monCt = e.groups.reduce((a, g) => a + g.quantity, 0)
              return (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <Link to={`/encounters/${e.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                    <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                      {e.name}
                      {e.difficulty && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
                          style={{ background: theme.accent }}>{e.difficulty.difficulty}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: theme.surface, color: theme.text2, border: `1px solid ${theme.border}` }}>
                        {e.status}
                      </span>
                    </div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>
                      {monCt} monster{monCt === 1 ? '' : 's'} · {e.environment || 'no environment'}
                      {e.updatedAt ? ` · ${new Date(e.updatedAt).toLocaleString()}` : ''}
                    </div>
                  </Link>
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" onClick={() => duplicateEncounter(e)}>Duplicate</Button>
                    {e.status !== 'completed' && (
                      <Button variant="primary" size="sm" onClick={() => runEncounter(e)}>Start combat</Button>
                    )}
                    <Button variant="danger" size="sm" onClick={async () => { if (await confirm({ title: 'Delete encounter', message: `Delete "${e.name}"? This cannot be undone.`, confirmLabel: 'Delete', destructive: true })) deleteEncounter(e.id) }}>Delete</Button>
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
