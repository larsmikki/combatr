import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { MONSTERS } from '@/data/monsters'
import { SPELLS } from '@/data/spells'
import { ITEMS } from '@/data/items'
import { CONDITIONS } from '@/data/conditions'
import { crToNum } from '@/data/thresholds'
import { useConfirm } from '@/components/ConfirmDialog'
import StatBlock from '@/components/StatBlock'
import type { Monster, Spell, MagicItem } from '@/types'
import { Surface, Modal, Input, Select, Pill } from '@/components/ui'

const SPELL_LEVEL_LABEL = (lv: number) => lv === 0 ? 'Cantrip' : `Level ${lv}`

export default function CompendiumPage() {
  const { theme } = useTheme()
  const {
    customMonsters, deleteCustomMonster,
    customSpells, deleteCustomSpell,
  } = useCombat()
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Monster | null>(null)
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
  const [selectedItem, setSelectedItem] = useState<MagicItem | null>(null)
  const [tab, setTab] = useState<'monsters' | 'spells' | 'items' | 'conditions'>('monsters')
  const [spellLevel, setSpellLevel] = useState<string>('')
  const [spellClass, setSpellClass] = useState<string>('')
  const [spellSchool, setSpellSchool] = useState<string>('')
  const [itemRarity, setItemRarity] = useState<string>('')
  const [itemType, setItemType] = useState<string>('')
  const [itemAttunement, setItemAttunement] = useState<string>('')

  const allMonsters = useMemo(
    () => {
      // Collision policy: custom overrides bundled, dedupe by slug, custom-first.
      const out = Object.values(customMonsters)
      const seen = new Set(out.map(m => m.slug))
      for (const m of MONSTERS) if (!seen.has(m.slug)) out.push(m)
      return out
    },
    [customMonsters],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allMonsters.filter(m => !q || m.name.toLowerCase().includes(q) || m.type.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allMonsters, query])

  const isCustom = (slug: string) => Object.prototype.hasOwnProperty.call(customMonsters, slug)

  const filteredConds = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CONDITIONS.filter(c => !q || c.name.toLowerCase().includes(q))
  }, [query])

  // Merge bundled SRD spells with imported spells. Collision policy mirrors
  // monsters: custom overrides bundled, dedupe by slug, custom-first display.
  const allSpells = useMemo(() => {
    const out: Spell[] = Object.values(customSpells)
    const seen = new Set(out.map(s => s.slug))
    for (const s of SPELLS) if (!seen.has(s.slug)) out.push(s)
    return out
  }, [customSpells])
  const spellClassOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of allSpells) for (const c of s.classes) set.add(c)
    return [...set].sort()
  }, [allSpells])
  const spellSchoolOptions = useMemo(
    () => [...new Set(allSpells.map(s => s.school))].filter(Boolean).sort(),
    [allSpells],
  )
  const filteredSpells = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allSpells.filter(s =>
      (!q || s.name.toLowerCase().includes(q)) &&
      (spellLevel === '' || String(s.level) === spellLevel) &&
      (!spellClass || s.classes.includes(spellClass)) &&
      (!spellSchool || s.school === spellSchool),
    ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }, [allSpells, query, spellLevel, spellClass, spellSchool])
  const isCustomSpell = (slug: string) => Object.prototype.hasOwnProperty.call(customSpells, slug)

  const itemRarityOptions = useMemo(
    () => [...new Set(ITEMS.map(i => i.rarity))].filter(Boolean).sort(),
    [],
  )
  const itemTypeOptions = useMemo(
    () => [...new Set(ITEMS.map(i => i.type))].filter(Boolean).sort(),
    [],
  )
  const RARITY_ORDER: Record<string, number> = {
    'common': 0, 'uncommon': 1, 'rare': 2, 'very rare': 3, 'legendary': 4, 'artifact': 5, 'varies': 6,
  }
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ITEMS.filter(i =>
      (!q || i.name.toLowerCase().includes(q)) &&
      (!itemRarity || i.rarity === itemRarity) &&
      (!itemType   || i.type   === itemType) &&
      (itemAttunement === '' ||
        (itemAttunement === 'yes' && i.requiresAttunement) ||
        (itemAttunement === 'no'  && !i.requiresAttunement)),
    ).sort((a, b) =>
      (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99)
      || a.name.localeCompare(b.name),
    )
  }, [query, itemRarity, itemType, itemAttunement])

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Compendium</h1>
          <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>
            {MONSTERS.length} monsters · {SPELLS.length} spells bundled (SRD 5.1)
            {Object.keys(customMonsters).length > 0 && ` · ${Object.keys(customMonsters).length} imported monster${Object.keys(customMonsters).length === 1 ? '' : 's'}`}
            {Object.keys(customSpells).length > 0 && ` · ${Object.keys(customSpells).length} imported spell${Object.keys(customSpells).length === 1 ? '' : 's'}`}
            {' · '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: theme.accent }}>CC BY 4.0</a>.
          </p>
        </div>
        <Link to="/settings"
          className="text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90"
          style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}` }}>
          Manage imports →
        </Link>
      </div>

      <Surface className="p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {(['monsters', 'spells', 'items', 'conditions'] as const).map(t => (
            <Pill key={t} active={tab === t} onClick={() => setTab(t)} className="capitalize">
              {t} ({t === 'monsters' ? allMonsters.length : t === 'spells' ? SPELLS.length : t === 'items' ? ITEMS.length : CONDITIONS.length})
            </Pill>
          ))}
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${tab}…`}
            className="ml-auto flex-1 min-w-[200px]" />
        </div>

        {tab === 'monsters' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-auto" style={{ maxHeight: '70vh' }}>
            {filtered.map(m => (
              <div key={m.slug} className="px-3 py-2.5 rounded-lg flex items-center gap-2"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <button onClick={() => setSelected(m)} className="text-left flex-1 min-w-0 hover:opacity-90">
                  <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                    <span className="truncate">{m.name}</span>
                    {isCustom(m.slug) && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        title={m.source?.sourceName ?? 'Custom import'}
                        style={{ background: `${theme.accent}22`, color: theme.accent }}>
                        {m.source?.sourceId && m.source.sourceId !== 'UNKNOWN' ? m.source.sourceId : 'Custom'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px]" style={{ color: theme.text2 }}>
                    {m.size} {m.type} · CR {m.challengeRating} · {m.xp} XP
                  </div>
                </button>
                {isCustom(m.slug) && (
                  <button title="Delete custom monster"
                    onClick={async () => { if (await confirm({ title: 'Delete monster', message: `Delete custom monster "${m.name}"?`, confirmLabel: 'Delete', destructive: true })) deleteCustomMonster(m.slug) }}
                    className="text-xs px-2 py-1 rounded hover:opacity-80"
                    style={{ background: 'transparent', color: '#d2484a', border: `1px solid ${theme.border}` }}>
                    ×
                  </button>
                )}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs" style={{ color: theme.text2 }}>No matches.</p>}
            <p className="col-span-full text-[11px] mt-3 pt-3" style={{ color: theme.text2, borderTop: `1px solid ${theme.border}` }}>
              Sorted by name · {filtered.length} of {allMonsters.length} · CRs range {allMonsters.length > 0 && `${allMonsters.reduce((a, m) => crToNum(m.challengeRating) < crToNum(a.challengeRating) ? m : a).challengeRating} – ${allMonsters.reduce((a, m) => crToNum(m.challengeRating) > crToNum(a.challengeRating) ? m : a).challengeRating}`}
            </p>
          </div>
        ) : tab === 'spells' ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Select value={spellLevel} onChange={e => setSpellLevel(e.target.value)}>
                <option value="">Any level</option>
                {[0,1,2,3,4,5,6,7,8,9].map(lv => <option key={lv} value={String(lv)}>{SPELL_LEVEL_LABEL(lv)}</option>)}
              </Select>
              <Select value={spellClass} onChange={e => setSpellClass(e.target.value)}>
                <option value="">Any class</option>
                {spellClassOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select value={spellSchool} onChange={e => setSpellSchool(e.target.value)}>
                <option value="">Any school</option>
                {spellSchoolOptions.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-auto" style={{ maxHeight: '64vh' }}>
              {filteredSpells.map(s => (
                <div key={s.slug} className="px-3 py-2.5 rounded-lg flex items-center gap-2"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <button onClick={() => setSelectedSpell(s)} className="text-left flex-1 min-w-0 hover:opacity-90">
                    <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                      <span className="truncate">{s.name}</span>
                      {s.concentration && <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: `${theme.accent}22`, color: theme.accent }}>C</span>}
                      {s.ritual && <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: theme.surface, color: theme.text2, border: `1px solid ${theme.border}` }}>R</span>}
                      {isCustomSpell(s.slug) && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                          title={s.source?.sourceName ?? 'Custom import'}
                          style={{ background: `${theme.accent}22`, color: theme.accent }}>
                          {s.source?.sourceId && s.source.sourceId !== 'UNKNOWN' ? s.source.sourceId : 'Custom'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] capitalize" style={{ color: theme.text2 }}>
                      {SPELL_LEVEL_LABEL(s.level)} · {s.school}{s.classes.length ? ` · ${s.classes.join(', ')}` : ''}
                    </div>
                  </button>
                  {isCustomSpell(s.slug) && (
                    <button title="Delete custom spell"
                      onClick={async () => { if (await confirm({ title: 'Delete spell', message: `Delete custom spell "${s.name}"?`, confirmLabel: 'Delete', destructive: true })) deleteCustomSpell(s.slug) }}
                      className="text-xs px-2 py-1 rounded hover:opacity-80"
                      style={{ background: 'transparent', color: '#d2484a', border: `1px solid ${theme.border}` }}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              {filteredSpells.length === 0 && <p className="text-xs" style={{ color: theme.text2 }}>No matches.</p>}
              <p className="col-span-full text-[11px] mt-3 pt-3" style={{ color: theme.text2, borderTop: `1px solid ${theme.border}` }}>
                {filteredSpells.length} of {SPELLS.length} spells
              </p>
            </div>
          </>
        ) : tab === 'items' ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Select value={itemRarity} onChange={e => setItemRarity(e.target.value)}>
                <option value="">Any rarity</option>
                {itemRarityOptions.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </Select>
              <Select value={itemType} onChange={e => setItemType(e.target.value)}>
                <option value="">Any type</option>
                {itemTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select value={itemAttunement} onChange={e => setItemAttunement(e.target.value)}>
                <option value="">Any attunement</option>
                <option value="yes">Requires attunement</option>
                <option value="no">No attunement</option>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-auto" style={{ maxHeight: '64vh' }}>
              {filteredItems.map(i => (
                <button key={i.slug} onClick={() => setSelectedItem(i)}
                  className="text-left px-3 py-2.5 rounded-lg hover:opacity-90"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: theme.text }}>
                    <span className="truncate">{i.name}</span>
                    {i.requiresAttunement && <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: `${theme.accent}22`, color: theme.accent }}>A</span>}
                  </div>
                  <div className="text-[11px] capitalize" style={{ color: theme.text2 }}>
                    {i.type}{i.rarity ? ` · ${i.rarity}` : ''}
                  </div>
                </button>
              ))}
              {filteredItems.length === 0 && <p className="text-xs" style={{ color: theme.text2 }}>No matches.</p>}
              <p className="col-span-full text-[11px] mt-3 pt-3" style={{ color: theme.text2, borderTop: `1px solid ${theme.border}` }}>
                {filteredItems.length} of {ITEMS.length} items
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-2 overflow-auto" style={{ maxHeight: '70vh' }}>
            {filteredConds.map(c => (
              <div key={c.id} className="px-3 py-2.5 rounded-lg" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <div className="text-sm font-semibold" style={{ color: theme.text }}>{c.name}</div>
                <div className="text-xs mt-1" style={{ color: theme.text2 }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      <Modal open={!!selected} onClose={() => setSelected(null)} maxWidth="720px">
        {selected && <StatBlock monster={selected} />}
      </Modal>

      <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)} maxWidth="640px">
        {selectedItem && (
          <div>
            <div className="text-xl font-bold" style={{ color: theme.accent }}>{selectedItem.name}</div>
            <div className="text-xs italic capitalize mt-0.5" style={{ color: theme.text2 }}>
              {selectedItem.type}{selectedItem.rarity ? `, ${selectedItem.rarity}` : ''}
              {selectedItem.requiresAttunement && selectedItem.attunementText ? ` (${selectedItem.attunementText})` : ''}
            </div>
            <div className="text-sm mt-3 whitespace-pre-wrap leading-relaxed" style={{ color: theme.text }}>
              {selectedItem.description}
            </div>
            <p className="text-[11px] mt-4 pt-3" style={{ color: theme.text2, borderTop: `1px solid ${theme.border}` }}>
              Source: System Reference Document 5.1, Wizards of the Coast LLC · CC BY 4.0.
            </p>
          </div>
        )}
      </Modal>

      <Modal open={!!selectedSpell} onClose={() => setSelectedSpell(null)} maxWidth="640px">
        {selectedSpell && (
          <div>
            <div className="text-xl font-bold" style={{ color: theme.accent }}>{selectedSpell.name}</div>
            <div className="text-xs italic capitalize mt-0.5" style={{ color: theme.text2 }}>
              {SPELL_LEVEL_LABEL(selectedSpell.level)} {selectedSpell.school}
              {selectedSpell.ritual && ' (ritual)'}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
              <div><span style={{ color: theme.text2 }}>Casting Time:</span> <span style={{ color: theme.text }}>{selectedSpell.castingTime}</span></div>
              <div><span style={{ color: theme.text2 }}>Range:</span> <span style={{ color: theme.text }}>{selectedSpell.range}</span></div>
              <div><span style={{ color: theme.text2 }}>Components:</span> <span style={{ color: theme.text }}>{selectedSpell.components}{selectedSpell.material ? ` (${selectedSpell.material})` : ''}</span></div>
              <div><span style={{ color: theme.text2 }}>Duration:</span> <span style={{ color: theme.text }}>{selectedSpell.concentration ? 'Concentration, ' : ''}{selectedSpell.duration}</span></div>
            </div>
            <div className="text-sm mt-3 whitespace-pre-wrap leading-relaxed" style={{ color: theme.text }}>
              {selectedSpell.description}
            </div>
            {selectedSpell.higherLevel && (
              <div className="text-sm mt-3 pt-3 whitespace-pre-wrap leading-relaxed" style={{ color: theme.text, borderTop: `1px solid ${theme.border}` }}>
                <span className="italic font-semibold">At Higher Levels.</span> {selectedSpell.higherLevel}
              </div>
            )}
            {selectedSpell.classes.length > 0 && (
              <div className="text-[11px] mt-3" style={{ color: theme.text2 }}>
                Classes: {selectedSpell.classes.join(', ')}
              </div>
            )}
            <p className="text-[11px] mt-4 pt-3" style={{ color: theme.text2, borderTop: `1px solid ${theme.border}` }}>
              Source: System Reference Document 5.1, Wizards of the Coast LLC · CC BY 4.0.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
