import type { Monster, StatBlockFeature } from '@/types'

const mod = (v: number) => { const x = Math.floor((v - 10) / 2); return (x >= 0 ? '+' : '') + x }

const statTheme = {
  bg: '#fbf6ea',
  surface2: '#efe5cf',
  border: 'rgba(80,45,15,0.18)',
  text: '#2a1a0c',
  text2: '#7a5a36',
  accent: '#e11d48',
}

function speedText(s: Monster['speed']) {
  return Object.entries(s)
    .map(([k, v]) => k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`)
    .join(', ')
}
function sensesText(senses: Monster['senses']) {
  return senses.map(s => s.type === 'passivePerception' ? `passive Perception ${s.value}` : `${s.type} ${s.value} ft.`).join(', ')
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm py-0.5">
      <span style={{ color: statTheme.text2 }}>{label}:</span>{' '}
      <span style={{ color: statTheme.text }}>{value}</span>
    </div>
  )
}

function FeatureSection({
  title, features, onRollDamage,
}: {
  title: string
  features: StatBlockFeature[]
  onRollDamage?: (f: StatBlockFeature, formula: string, damageType: string) => void
}) {
  return (
    <div className="mt-3">
      <h4 className="text-sm font-bold pb-1 mb-1.5 font-display" style={{ color: statTheme.accent, borderBottom: `1px solid ${statTheme.border}` }}>
        {title}
      </h4>
      {features.map((f, i) => (
        <div key={i} className="text-sm mb-1.5 leading-snug">
          <span className="italic font-semibold" style={{ color: statTheme.text }}>{f.name}.</span>{' '}
          <span style={{ color: statTheme.text2 }}>{f.description}</span>
          {onRollDamage && f.damageParts?.map((p, pi) => (
            <button
              key={pi}
              onClick={() => onRollDamage(f, p.formula, p.damageType)}
              className="ml-1.5 px-1.5 py-0.5 rounded-md text-xs font-mono"
              style={{ background: `${statTheme.accent}18`, color: statTheme.accent, border: `1px solid ${statTheme.accent}30` }}
            >
              🎲 {p.formula}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

interface Props {
  monster: Monster
  onRollDamage?: (f: StatBlockFeature, formula: string, damageType: string) => void
}

export default function StatBlock({ monster: m, onRollDamage }: Props) {
  const abilities: [string, number][] = [
    ['STR', m.abilityScores.str], ['DEX', m.abilityScores.dex], ['CON', m.abilityScores.con],
    ['INT', m.abilityScores.int], ['WIS', m.abilityScores.wis], ['CHA', m.abilityScores.cha],
  ]
  return (
    <div className="rounded-xl p-4" style={{ background: statTheme.bg, border: `1px solid ${statTheme.border}` }}>
      <div className="mb-2">
        <div className="text-xl font-bold font-display" style={{ color: statTheme.accent }}>{m.name}</div>
        <div className="text-xs italic" style={{ color: statTheme.text2 }}>
          {m.size} {m.type}{m.subtype ? ` (${m.subtype})` : ''}{m.alignment ? `, ${m.alignment}` : ''}
        </div>
        {m.role && (
          <div className="text-[11px] mt-0.5" style={{ color: statTheme.text2 }}>Role: <span style={{ color: statTheme.text }}>{m.role}</span></div>
        )}
        {m.description && (
          <p className="text-xs mt-2" style={{ color: statTheme.text2 }}>{m.description}</p>
        )}
      </div>

      <div className="grid grid-cols-6 gap-2 my-3 p-3 rounded-xl" style={{ background: statTheme.surface2 }}>
        {abilities.map(([k, v]) => (
          <div key={k} className="text-center">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: statTheme.text2 }}>{k}</div>
            <div className="font-bold font-display" style={{ color: statTheme.accent }}>{v} ({mod(v)})</div>
          </div>
        ))}
      </div>

      <StatLine label="Armor Class" value={`${m.armorClass[0].value}${m.armorClass[0].type ? ` (${m.armorClass[0].type})` : ''}`} />
      <StatLine label="Hit Points"  value={`${m.hitPoints.average} (${m.hitPoints.formula})`} />
      <StatLine label="Speed"       value={speedText(m.speed)} />
      {m.savingThrows && Object.keys(m.savingThrows).length > 0 && (
        <StatLine label="Saving Throws" value={Object.entries(m.savingThrows).map(([k, v]) => `${k.toUpperCase()} ${(v ?? 0) >= 0 ? '+' : ''}${v}`).join(', ')} />
      )}
      {m.skills && Object.keys(m.skills).length > 0 && (
        <StatLine label="Skills" value={Object.entries(m.skills).map(([k, v]) => `${k} ${(v ?? 0) >= 0 ? '+' : ''}${v}`).join(', ')} />
      )}
      {m.damageVulnerabilities?.length ? <StatLine label="Damage Vulnerabilities" value={m.damageVulnerabilities.join(', ')} /> : null}
      {m.damageResistances?.length    ? <StatLine label="Damage Resistances"    value={m.damageResistances.join(', ')} /> : null}
      {m.damageImmunities?.length     ? <StatLine label="Damage Immunities"     value={m.damageImmunities.join(', ')} /> : null}
      {m.conditionImmunities?.length  ? <StatLine label="Condition Immunities"  value={m.conditionImmunities.join(', ')} /> : null}
      <StatLine label="Senses"    value={sensesText(m.senses)} />
      <StatLine label="Languages" value={m.languages.length ? m.languages.join(', ') : '—'} />
      <StatLine label="Challenge" value={`${m.challengeRating} (${m.xp.toLocaleString()} XP)`} />

      {m.spellcasting && (
        <div className="mt-3">
          <h4 className="text-sm font-bold pb-1 mb-1.5 font-display" style={{ color: statTheme.accent, borderBottom: `1px solid ${statTheme.border}` }}>
            Spellcasting
          </h4>
          <div className="text-xs leading-snug" style={{ color: statTheme.text2 }}>
            {m.spellcasting.className && <div>{m.spellcasting.className}{m.spellcasting.level ? `, ${m.spellcasting.level}th level` : ''}</div>}
            <div>
              Ability: <span style={{ color: statTheme.text }}>{m.spellcasting.ability.toUpperCase()}</span>
              {typeof m.spellcasting.saveDc === 'number' && <> · Save DC <span style={{ color: statTheme.text }}>{m.spellcasting.saveDc}</span></>}
              {typeof m.spellcasting.attackBonus === 'number' && <> · Attack <span style={{ color: statTheme.text }}>+{m.spellcasting.attackBonus}</span></>}
            </div>
            {m.spellcasting.description && <p className="mt-1">{m.spellcasting.description}</p>}
            {m.spellcasting.atWill?.length ? <div className="mt-1"><em>At will:</em> {m.spellcasting.atWill.join(', ')}</div> : null}
            {m.spellcasting.perDay?.map((p, i) => (
              <div key={`pd${i}`}><em>{p.slots}/day each:</em> {p.spells.join(', ')}</div>
            ))}
            {m.spellcasting.spellSlots?.map((s, i) => (
              <div key={`sl${i}`}><em>Level {s.level} ({s.slots} slot{s.slots === 1 ? '' : 's'}):</em> {s.spells.join(', ')}</div>
            ))}
          </div>
        </div>
      )}

      {m.gear?.length ? (
        <div className="mt-3">
          <h4 className="text-sm font-bold pb-1 mb-1.5 font-display" style={{ color: statTheme.accent, borderBottom: `1px solid ${statTheme.border}` }}>
            Gear
          </h4>
          <ul className="text-xs leading-snug list-disc ml-5" style={{ color: statTheme.text2 }}>
            {m.gear.map((g, i) => (
              <li key={i}>
                <span style={{ color: statTheme.text }}>{g.name}</span>
                {g.attuned ? ' (attuned)' : ''}
                {g.notes ? ` — ${g.notes}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {m.traits.length > 0      && <FeatureSection title="Traits"          features={m.traits} />}
      {m.actions.length > 0     && <FeatureSection title="Actions"         features={m.actions}     onRollDamage={onRollDamage} />}
      {m.bonusActions?.length   && <FeatureSection title="Bonus Actions"   features={m.bonusActions} onRollDamage={onRollDamage} />}
      {m.reactions?.length      && <FeatureSection title="Reactions"       features={m.reactions}    onRollDamage={onRollDamage} />}
      {m.legendaryActions && (
        <>
          {m.legendaryActions.description && (
            <p className="text-xs mt-3 mb-1" style={{ color: statTheme.text2 }}>{m.legendaryActions.description}</p>
          )}
          <FeatureSection title={`Legendary Actions (${m.legendaryActions.actionsPerRound}/round)`} features={m.legendaryActions.options} onRollDamage={onRollDamage} />
        </>
      )}
      {m.mythicActions?.options.length ? (
        <>
          {m.mythicActions.description && (
            <p className="text-xs mt-3 mb-1" style={{ color: statTheme.text2 }}>{m.mythicActions.description}</p>
          )}
          <FeatureSection title="Mythic Actions" features={m.mythicActions.options} onRollDamage={onRollDamage} />
        </>
      ) : null}

      {m.lair && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${statTheme.border}` }}>
          {m.lair.description && (
            <p className="text-xs mb-2" style={{ color: statTheme.text2 }}>{m.lair.description}</p>
          )}
          {m.lair.actions?.length ? (
            <FeatureSection
              title={`Lair Actions${typeof m.lair.initiative === 'number' ? ` (initiative ${m.lair.initiative})` : ''}`}
              features={m.lair.actions} onRollDamage={onRollDamage}
            />
          ) : null}
          {m.lair.regionalEffects?.length ? (
            <FeatureSection title="Regional Effects" features={m.lair.regionalEffects} />
          ) : null}
          {m.lair.regionalEffectsEndText && (
            <p className="text-xs mt-1 italic" style={{ color: statTheme.text2 }}>{m.lair.regionalEffectsEndText}</p>
          )}
        </div>
      )}

      {m.tags?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {m.tags.map(t => (
            <span key={t} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: statTheme.surface2, color: statTheme.text2, border: `1px solid ${statTheme.border}` }}>{t}</span>
          ))}
        </div>
      ) : null}

      <p className="text-[11px] mt-4 pt-3" style={{ color: statTheme.text2, borderTop: `1px solid ${statTheme.border}` }}>
        {m.source.sourceType === 'SRD_5_1_CC' || m.source.sourceType === 'SRD_5_2_CC'
          ? `Source: ${m.source.sourceName}, Wizards of the Coast LLC · ${m.source.licenseName ?? 'CC BY 4.0'}.`
          : `Source: ${m.source.sourceName}${m.source.attributionText ? ` — ${m.source.attributionText}` : ''}`}
      </p>
    </div>
  )
}
