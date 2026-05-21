import { Navigate, useParams } from 'react-router-dom'
import { useCombat } from '@/contexts/CombatContext'
import { SRD_RULE_ELEMENTS } from '@/data/rules'
import { SPELLS } from '@/data/spells'
import { deriveCharacter } from '@/rules/deriveCharacter'

export default function CharacterPrintPage() {
  const { id } = useParams<{ id: string }>()
  const { characters, customRuleElements, customSpells } = useCombat()
  const sheet = id ? characters[id] : null
  if (id && !sheet && Object.keys(characters).length > 0) return <Navigate to="/characters" replace />
  if (!sheet) return <div>Loading...</div>

  const rules = [...Object.values(customRuleElements), ...SRD_RULE_ELEMENTS]
  const d = deriveCharacter(sheet, rules)
  const spells = [...Object.values(customSpells), ...SPELLS].filter(s => sheet.knownSpells.includes(s.slug) || sheet.preparedSpells.includes(s.slug))

  return (
    <div className="print-sheet">
      <style>{`
        @media print {
          header, footer { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          body { background: #fff !important; color: #111 !important; }
          .print-sheet button { display: none; }
        }
        .print-sheet { background: white; color: #111; padding: 24px; border-radius: 8px; }
        .sheet-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; }
        .box { border: 1px solid #999; border-radius: 6px; padding: 10px; break-inside: avoid; }
        .label { font-size: 10px; text-transform: uppercase; color: #555; letter-spacing: .04em; }
        .score-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
        .mini-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        @media (max-width: 800px) { .sheet-grid { grid-template-columns: 1fr; } }
      `}</style>
      <button onClick={() => window.print()} className="mb-4 px-4 py-2 rounded bg-black text-white">Print</button>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold">{sheet.name}</h1>
          <div className="text-sm text-zinc-600">Level {d.level} · Proficiency +{d.proficiencyBonus}</div>
        </div>
        <div className="text-right text-sm">
          <div>AC {d.armorClass}</div>
          <div>HP {d.currentHp}/{d.maxHp}</div>
          <div>Initiative {d.initiativeBonus >= 0 ? '+' : ''}{d.initiativeBonus}</div>
        </div>
      </div>

      <div className="sheet-grid">
        <div className="space-y-3">
          <section className="box">
            <div className="label mb-2">Abilities</div>
            <div className="score-grid">
              {Object.entries(sheet.abilityScores).map(([a, score]) => (
                <div key={a} className="text-center">
                  <div className="label">{a}</div>
                  <div className="text-xl font-bold">{score}</div>
                  <div>{d.abilityMods[a as keyof typeof d.abilityMods] >= 0 ? '+' : ''}{d.abilityMods[a as keyof typeof d.abilityMods]}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="box">
            <div className="label mb-2">Skills</div>
            <div className="grid grid-cols-2 gap-x-4 text-sm">
              {Object.entries(d.skills).map(([skill, value]) => (
                <div key={skill} className="flex justify-between"><span className="capitalize">{skill}</span><span>{value >= 0 ? '+' : ''}{value}</span></div>
              ))}
            </div>
          </section>

          <section className="box">
            <div className="label mb-2">Features</div>
            <div className="space-y-2 text-sm">
              {d.features.map(f => (
                <div key={f.slug}>
                  <div className="font-bold">{f.name}</div>
                  <div className="text-xs whitespace-pre-wrap">{f.entries}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <section className="box">
            <div className="label mb-2">Combat</div>
            <div className="mini-grid text-center">
              <div><div className="label">AC</div><div className="text-2xl font-bold">{d.armorClass}</div></div>
              <div><div className="label">HP</div><div className="text-2xl font-bold">{d.maxHp}</div></div>
              <div><div className="label">Speed</div><div className="text-2xl font-bold">{d.speed.walk ?? 30}</div></div>
            </div>
            <div className="mt-3 text-sm">Passive Perception {d.passivePerception}</div>
          </section>

          <section className="box">
            <div className="label mb-2">Attacks</div>
            {d.attacks.length === 0 ? <div className="text-sm">No equipped attacks.</div> : d.attacks.map(a => (
              <div key={a.name} className="text-sm flex justify-between"><span>{a.name}</span><span>+{a.attackBonus} · {a.damage}</span></div>
            ))}
          </section>

          <section className="box">
            <div className="label mb-2">Inventory</div>
            <div className="text-sm space-y-1">
              {sheet.inventory.map(i => <div key={i.id}>{i.quantity}× {i.name}{i.equipped ? ' (equipped)' : ''}</div>)}
            </div>
          </section>

          <section className="box">
            <div className="label mb-2">Spells</div>
            <div className="text-sm space-y-1">
              {spells.map(s => <div key={s.slug}>{s.level === 0 ? 'Cantrip' : `L${s.level}`} · {s.name}</div>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

