import { Navigate, useParams } from 'react-router-dom'
import { useCombat } from '@/contexts/CombatContext'
import { SRD_RULE_ELEMENTS } from '@/data/rules'
import { SPELLS } from '@/data/spells'
import { deriveCharacter } from '@/rules/deriveCharacter'
import type { Ability, RuleElement, Spell } from '@/types'

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SKILL_ABILITIES: Record<string, Ability> = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis',
}

function formatMod(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function cleanRuleText(text: string | undefined): string {
  if (!text) return ''
  return text.replace(/\n?\s*Referenced progression\s*\n(?:.+\|.+\n?)+(?:\.\.\.and \d+ more)?/gi, '').trim()
}

function excerpt(text: string | undefined, max = 420): string {
  const clean = cleanRuleText(text).replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean
}

function byLevelThenName(a: Spell, b: Spell): number {
  return a.level - b.level || a.name.localeCompare(b.name)
}

function classSummary(classes: string[]): string {
  return classes.length ? classes.join(' / ') : 'No class selected'
}

function featureTypeLabel(feature: RuleElement): string {
  if (feature.kind === 'race') return 'Race / species'
  if (feature.kind === 'background') return 'Background'
  if (feature.kind === 'classFeature') return feature.className ? `${feature.className} feature` : 'Class feature'
  if (feature.kind === 'subclassFeature') return feature.subclassName ? `${feature.subclassName} feature` : 'Subclass feature'
  return titleCase(feature.kind)
}

export default function CharacterPrintPage() {
  const { id } = useParams<{ id: string }>()
  const { characters, customRuleElements, customSpells } = useCombat()
  const sheet = id ? characters[id] : null
  if (id && !sheet && Object.keys(characters).length > 0) return <Navigate to="/characters" replace />
  if (!sheet) return <div>Loading...</div>

  const rules = [...Object.values(customRuleElements), ...SRD_RULE_ELEMENTS]
  const d = deriveCharacter(sheet, rules)
  const spellList = [...Object.values(customSpells), ...SPELLS]
  const spells = spellList
    .filter(s => sheet.knownSpells.includes(s.slug) || sheet.preparedSpells.includes(s.slug))
    .sort(byLevelThenName)
  const spellsByLevel = new Map<number, Spell[]>()
  for (const spell of spells) {
    const group = spellsByLevel.get(spell.level) ?? []
    group.push(spell)
    spellsByLevel.set(spell.level, group)
  }

  const selectedRace = sheet.ancestrySlug ? rules.find(r => r.slug === sheet.ancestrySlug) : undefined
  const selectedBackground = sheet.backgroundSlug ? rules.find(r => r.slug === sheet.backgroundSlug) : undefined
  const classNames = sheet.classes.map(c => {
    const cls = rules.find(r => r.slug === c.classSlug)
    const subclass = c.subclassSlug ? rules.find(r => r.slug === c.subclassSlug) : undefined
    return `${cls?.name ?? c.classSlug}${subclass ? ` (${subclass.name})` : ''} ${c.levels}`
  })
  const languages = new Set<string>()
  const tools = new Set<string>()
  const armor = new Set<string>()
  const weapons = new Set<string>()
  for (const feature of d.features) {
    for (const grant of feature.grants ?? []) {
      if (grant.type === 'language') languages.add(grant.value)
      if (grant.type === 'proficiency' && grant.target === 'tool') tools.add(grant.value)
      if (grant.type === 'proficiency' && grant.target === 'armor') armor.add(grant.value)
      if (grant.type === 'proficiency' && grant.target === 'weapon') weapons.add(grant.value)
    }
  }
  const resources = d.features.flatMap(feature => (feature.grants ?? [])
    .filter(grant => grant.type === 'resource')
    .map(grant => {
      const used = sheet.resources?.find(r => r.resourceId === grant.resourceId)?.used ?? 0
      return { ...grant, used, source: feature.name }
    }))

  return (
    <div className="print-sheet">
      <style>{`
        @media print {
          header, footer { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          body { background: #fff !important; color: #111 !important; }
          .print-sheet button { display: none; }
          .print-sheet { padding: 0 !important; }
        }
        .print-sheet { background: white; color: #111; padding: 24px; border-radius: 8px; font-size: 12px; }
        .sheet-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
        .three-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .six-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; }
        .box { border: 1px solid #999; border-radius: 5px; padding: 9px; break-inside: avoid; background: #fff; }
        .label { font-size: 9px; text-transform: uppercase; color: #555; letter-spacing: .04em; }
        .line { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e5e5e5; padding: 2px 0; }
        .section-title { font-weight: 800; font-size: 13px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .03em; }
        .page-break { break-before: page; }
        @media (max-width: 900px) { .sheet-grid, .three-grid { grid-template-columns: 1fr; } .six-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
      <button onClick={() => window.print()} className="mb-4 px-4 py-2 rounded bg-black text-white">Print</button>

      <header className="mb-3 border-b border-zinc-400 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            {sheet.portraitUrl && (
              <img src={sheet.portraitUrl} alt={`${sheet.name} portrait`}
                className="w-28 h-36 object-cover rounded border border-zinc-400" />
            )}
            <div>
            <h1 className="text-3xl font-bold">{sheet.name}</h1>
            <div className="text-sm text-zinc-700">
              Level {d.level} - {classSummary(classNames)}
            </div>
            <div className="text-xs text-zinc-600">
              {selectedRace?.name ?? 'No race/species'} - {selectedBackground?.name ?? 'No background'} - Proficiency {formatMod(d.proficiencyBonus)}
            </div>
            {sheet.gender && <div className="text-xs text-zinc-600 capitalize">Gender: {sheet.gender}</div>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center min-w-[320px]">
            <div className="box"><div className="label">AC</div><div className="text-2xl font-bold">{d.armorClass}</div></div>
            <div className="box"><div className="label">HP</div><div className="text-2xl font-bold">{d.currentHp}/{d.maxHp}</div></div>
            <div className="box"><div className="label">Init</div><div className="text-2xl font-bold">{formatMod(d.initiativeBonus)}</div></div>
            <div className="box"><div className="label">Speed</div><div className="text-2xl font-bold">{d.speed.walk ?? 30}</div></div>
          </div>
        </div>
      </header>

      <div className="sheet-grid">
        <div className="space-y-3">
          <section className="box">
            <div className="section-title">Ability Scores</div>
            <div className="six-grid">
              {ABILITIES.map(ability => (
                <div key={ability} className="text-center border border-zinc-300 rounded p-2">
                  <div className="label">{ability.toUpperCase()}</div>
                  <div className="text-2xl font-bold">{sheet.abilityScores[ability]}</div>
                  <div>{formatMod(d.abilityMods[ability])}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="box">
            <div className="section-title">Saving Throws</div>
            <div className="grid grid-cols-2 gap-x-4">
              {ABILITIES.map(ability => (
                <div key={ability} className="line">
                  <span>{ability.toUpperCase()}</span>
                  <strong>{formatMod(d.savingThrows[ability] ?? d.abilityMods[ability])}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="box">
            <div className="section-title">Skills</div>
            <div className="grid grid-cols-2 gap-x-4">
              {Object.entries(SKILL_ABILITIES).map(([skill, ability]) => (
                <div key={skill} className="line">
                  <span>{titleCase(skill)} <span className="text-zinc-500">({ability.toUpperCase()})</span></span>
                  <strong>{formatMod(d.skills[skill] ?? d.abilityMods[ability])}</strong>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm"><strong>Passive Perception:</strong> {d.passivePerception}</div>
          </section>

          <section className="box">
            <div className="section-title">Proficiencies & Languages</div>
            <div className="space-y-1">
              <div><strong>Armor:</strong> {Array.from(armor).join(', ') || 'None recorded'}</div>
              <div><strong>Weapons:</strong> {Array.from(weapons).join(', ') || 'None recorded'}</div>
              <div><strong>Tools:</strong> {Array.from(tools).join(', ') || 'None recorded'}</div>
              <div><strong>Languages:</strong> {Array.from(languages).join(', ') || 'None recorded'}</div>
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <section className="box">
            <div className="section-title">Combat</div>
            <div className="three-grid text-center mb-2">
              <div><div className="label">Armor Class</div><div className="text-xl font-bold">{d.armorClass}</div></div>
              <div><div className="label">Hit Points</div><div className="text-xl font-bold">{d.currentHp}/{d.maxHp}</div></div>
              <div><div className="label">Temp HP</div><div className="text-xl font-bold">{d.tempHp}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="line"><span>Initiative</span><strong>{formatMod(d.initiativeBonus)}</strong></div>
              <div className="line"><span>Walk speed</span><strong>{d.speed.walk ?? 30} ft.</strong></div>
              <div className="line"><span>Hit dice</span><strong>{sheet.levelHistory.map(l => `d${rules.find(r => r.slug === l.classSlug)?.hitDie ?? l.hpValue}`).join(', ') || '-'}</strong></div>
              <div className="line"><span>Death saves</span><strong>{sheet.deathSaves ? `${sheet.deathSaves.successes}S/${sheet.deathSaves.failures}F` : '-/-'}</strong></div>
            </div>
          </section>

          <section className="box">
            <div className="section-title">Attacks</div>
            {d.attacks.length === 0 ? <div>No equipped attacks recorded.</div> : d.attacks.map(a => (
              <div key={a.name} className="line">
                <span>{a.name}{a.notes ? ` - ${a.notes}` : ''}</span>
                <strong>{formatMod(a.attackBonus)} - {a.damage}</strong>
              </div>
            ))}
          </section>

          <section className="box">
            <div className="section-title">Resources</div>
            {resources.length === 0 ? <div>No tracked resources recorded.</div> : resources.map(r => (
              <div key={`${r.resourceId}-${r.source}`} className="line">
                <span>{r.name} <span className="text-zinc-500">({r.reset})</span></span>
                <strong>{r.used}/{r.maxFormula}</strong>
              </div>
            ))}
          </section>

          <section className="box">
            <div className="section-title">Inventory & Gear</div>
            {sheet.inventory.length === 0 ? <div>No gear recorded.</div> : (
              <div className="space-y-1">
                {sheet.inventory.map(i => (
                  <div key={i.id} className="line">
                    <span>{i.quantity}x {i.name}{i.equipped ? ' (equipped)' : ''}{i.attuned ? ' (attuned)' : ''}</span>
                    <span>{i.notes}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="box mt-3">
        <div className="section-title">Features, Traits & Abilities</div>
        {d.features.length === 0 ? <div>No features recorded.</div> : (
          <div className="grid grid-cols-2 gap-3">
            {d.features.map(feature => (
              <div key={feature.slug} className="break-inside-avoid">
                <div className="font-bold">{feature.name}</div>
                <div className="label">{featureTypeLabel(feature)}{feature.level ? ` - Level ${feature.level}` : ''}</div>
                <div className="mt-1 whitespace-pre-wrap">{excerpt(feature.entries)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="box mt-3">
        <div className="section-title">Spells</div>
        {d.spellcasting.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {d.spellcasting.map(block => (
              <div key={block.classSlug} className="border border-zinc-300 rounded p-2">
                <div className="label">{rules.find(r => r.slug === block.classSlug)?.name ?? block.classSlug}</div>
                <div>Ability {block.ability.toUpperCase()}</div>
                <div>Save DC {block.saveDc} - Attack {formatMod(block.attackBonus)}</div>
                {block.slots.length > 0 && <div>Slots: {block.slots.map(s => `L${s.level} ${s.used}/${s.max}`).join(', ')}</div>}
              </div>
            ))}
          </div>
        )}
        {spells.length === 0 ? <div>No spells recorded.</div> : (
          <div className="space-y-3">
            {Array.from(spellsByLevel.entries()).map(([level, group]) => (
              <div key={level}>
                <div className="font-bold mb-1">{level === 0 ? 'Cantrips' : `Level ${level}`}</div>
                <div className="grid grid-cols-2 gap-3">
                  {group.map(spell => (
                    <div key={spell.slug} className="break-inside-avoid border border-zinc-200 rounded p-2">
                      <div className="font-bold">{spell.name}</div>
                      <div className="label">
                        {spell.school}{spell.ritual ? ' ritual' : ''}{spell.concentration ? ' - concentration' : ''}
                      </div>
                      <div className="text-xs mt-1">
                        <strong>Cast:</strong> {spell.castingTime} - <strong>Range:</strong> {spell.range} - <strong>Duration:</strong> {spell.duration}
                      </div>
                      <div className="text-xs"><strong>Components:</strong> {spell.components}{spell.material ? ` (${spell.material})` : ''}</div>
                      <div className="mt-1 whitespace-pre-wrap">{excerpt(spell.description, 520)}</div>
                      {spell.higherLevel && <div className="mt-1"><strong>Higher levels:</strong> {excerpt(spell.higherLevel, 260)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {sheet.notes && (
        <section className="box mt-3">
          <div className="section-title">Notes</div>
          <div className="whitespace-pre-wrap">{sheet.notes}</div>
        </section>
      )}

      {d.warnings.length > 0 && (
        <section className="box mt-3">
          <div className="section-title">Warnings</div>
          <ul className="list-disc pl-5">
            {d.warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
