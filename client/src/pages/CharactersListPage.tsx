import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { SRD_RULE_ELEMENTS } from '@/data/rules'
import { deriveCharacter } from '@/rules/deriveCharacter'
import { createCharacter } from '@/rules/characterFactory'
import { Surface, Button } from '@/components/ui'

export default function CharactersListPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { characters, campaigns, customRuleElements, upsertCharacter, deleteCharacter } = useCombat()
  const rules = [...Object.values(customRuleElements), ...SRD_RULE_ELEMENTS]
  const list = Object.values(characters).sort((a, b) => a.name.localeCompare(b.name))

  const create = async () => {
    const c = createCharacter('', rules)
    await upsertCharacter(c)
    navigate(`/characters/${c.id}`)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Characters</h1>
          <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>
            Player characters use stored choices and derived sheet values.
          </p>
        </div>
        <Button variant="primary" onClick={create}>Create character</Button>
      </div>

      <div className="mb-5 rounded-lg px-4 py-3"
        style={{ background: '#fee2e2', border: '1px solid #dc2626', color: '#7f1d1d' }}>
        <div className="text-sm font-extrabold uppercase tracking-wide">Character builder is not fully functional</div>
        <div className="text-xs mt-1">
          This is an active prototype. Derived values, imported rule handling, class features, choices, spells, equipment, and level-up automation may be incomplete or wrong. Verify sheets manually before using them in play.
        </div>
      </div>

      <Surface className="p-6">
        {list.length === 0 ? (
          <p className="text-sm" style={{ color: theme.text2 }}>No characters yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map(c => {
              const d = deriveCharacter(c, rules)
              const campaign = campaigns[c.campaignId]
              return (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg flex-wrap"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="w-12 h-14 rounded-md overflow-hidden flex items-center justify-center text-[10px] shrink-0"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text2 }}>
                    {c.portraitUrl ? (
                      <img src={c.portraitUrl} alt={`${c.name} portrait`} className="w-full h-full object-cover" />
                    ) : (
                      <span>PC</span>
                    )}
                  </div>
                  <Link to={`/characters/${c.id}`} className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                    <div className="text-sm font-semibold" style={{ color: theme.text }}>{c.name}</div>
                    <div className="text-[11px]" style={{ color: theme.text2 }}>
                      Level {d.level} · AC {d.armorClass} · HP {d.currentHp}/{d.maxHp}
                      {campaign ? ` · ${campaign.name}` : ''}
                      {d.unresolvedChoices.length > 0 ? ` · ${d.unresolvedChoices.length} unresolved choice${d.unresolvedChoices.length === 1 ? '' : 's'}` : ''}
                    </div>
                  </Link>
                  <Link to={`/characters/${c.id}/print`} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, textDecoration: 'none' }}>
                    Print
                  </Link>
                  <Button variant="danger" size="sm" onClick={() => deleteCharacter(c.id)}>Delete</Button>
                </div>
              )
            })}
          </div>
        )}
      </Surface>
    </div>
  )
}
