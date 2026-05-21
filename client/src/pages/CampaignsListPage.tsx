import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { useConfirm } from '@/components/ConfirmDialog'
import type { Campaign } from '@/types'
import { Surface, Button } from '@/components/ui'

const uid = () => Math.random().toString(36).slice(2, 10)

export default function CampaignsListPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { campaigns, activeCampaignId, setActiveCampaignId, upsertCampaign, deleteCampaign, encounters } = useCombat()
  const confirm = useConfirm()

  const list = useMemo(
    () => Object.values(campaigns).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [campaigns],
  )

  const newCampaign = async () => {
    const now = new Date().toISOString()
    const c: Campaign = {
      id: uid(),
      name: 'New Campaign',
      description: '',
      notes: '',
      party: { generic: [{ level: 3, count: 4 }], characters: [] },
      monsterNotes: {},
      createdAt: now,
      updatedAt: now,
    }
    await upsertCampaign(c)
    setActiveCampaignId(c.id)
    navigate(`/campaigns/${c.id}`)
  }

  const onDelete = async (c: Campaign) => {
    if (list.length <= 1) return
    if (!await confirm({
      title: 'Delete campaign',
      message: `Delete "${c.name}"? All encounters in this campaign will be removed too. This cannot be undone.`,
      confirmLabel: 'Delete', destructive: true,
    })) return
    const r = await deleteCampaign(c.id)
    if (!r.ok && r.reason) alert(r.reason)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Campaigns</h1>
          <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>
            A campaign owns its party, encounters, and notes. Pick one as active to scope the rest of the app to it.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={newCampaign}>+ New campaign</Button>
      </div>

      <Surface className="p-6">
        {list.length === 0 ? (
          <p className="text-xs" style={{ color: theme.text2 }}>No campaigns yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map(c => {
              const isActive = c.id === activeCampaignId
              const encCount = Object.values(encounters).filter(e => e.campaignId === c.id).length
              const partySize = c.party.characters.length + c.party.generic.reduce((a, g) => a + g.count, 0)
              return (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap"
                  style={{ background: theme.surface2, border: `1px solid ${isActive ? theme.accent : theme.border}` }}>
                  <Link to={`/campaigns/${c.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                    <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                      {c.name}
                      {isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
                          style={{ background: theme.accent }}>active</span>
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>
                      {partySize} party · {encCount} encounter{encCount === 1 ? '' : 's'}
                      {c.notes && ' · has notes'}
                      {c.updatedAt ? ` · updated ${new Date(c.updatedAt).toLocaleDateString()}` : ''}
                    </div>
                  </Link>
                  <div className="flex gap-1.5 flex-wrap">
                    {!isActive && (
                      <Button size="sm" onClick={() => setActiveCampaignId(c.id)}>Set active</Button>
                    )}
                    <Link to={`/campaigns/${c.id}`}
                      className="inline-flex items-center justify-center gap-1.5 font-semibold transition-opacity hover:opacity-90 px-3 py-1.5 text-xs rounded-lg text-white"
                      style={{ background: 'var(--brand-gradient)', textDecoration: 'none' }}>
                      Open →
                    </Link>
                    {list.length > 1 && (
                      <Button variant="danger" size="sm" onClick={() => onDelete(c)}>Delete</Button>
                    )}
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
