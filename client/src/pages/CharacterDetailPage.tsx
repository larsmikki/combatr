import { Link, Navigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import { SRD_RULE_ELEMENTS } from '@/data/rules'
import { SPELLS } from '@/data/spells'
import { ITEMS } from '@/data/items'
import { addClassLevel } from '@/rules/characterFactory'
import { deriveCharacter, normalizeCharacterClasses } from '@/rules/deriveCharacter'
import type { Ability, CharacterInventoryItem, CharacterSheet, RuleElement } from '@/types'
import { Surface, Button, Input, Select, Textarea, Modal } from '@/components/ui'

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const uid = () => Math.random().toString(36).slice(2, 10)
const POINT_BUY_BUDGET = 21
const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
type PickerKind = 'race' | 'background' | 'class' | 'subclass'
interface PortraitSearchResult {
  thumb: string
  full: string
  title: string
}

async function searchPortraitImages(query: string, offset = 0): Promise<PortraitSearchResult[]> {
  const res = await fetch(`/api/search-images?q=${encodeURIComponent(query)}&offset=${offset}`)
  if (!res.ok) throw new Error('Search failed')
  const { images } = await res.json() as { images?: PortraitSearchResult[] }
  return images ?? []
}

async function proxyImageToDataUrl(url: string): Promise<string> {
  const res = await fetch(`/api/proxy-image-data?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('Image fetch failed')
  const { dataUrl } = await res.json() as { dataUrl: string }
  return dataUrl
}

function mergeRules(custom: Record<string, RuleElement>): RuleElement[] {
  const key = (r: RuleElement) => [
    r.kind,
    r.className ?? '',
    r.subclassName ?? '',
    r.level ?? '',
    r.name.toLowerCase(),
  ].join('|')
  const bySemanticKey = new Map<string, RuleElement>()
  for (const r of Object.values(custom)) bySemanticKey.set(key(r), r)
  for (const r of SRD_RULE_ELEMENTS) {
    const k = key(r)
    if (!bySemanticKey.has(k)) bySemanticKey.set(k, r)
  }
  return [...bySemanticKey.values()]
}

function pointBuySpent(scores: CharacterSheet['abilityScores']): number {
  return ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[Math.max(8, Math.min(15, scores[a]))] ?? 0), 0)
}

function excerpt(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 700)
}

function abilityLabel(ability: string): string {
  return ability.toUpperCase()
}

function grantLabel(grant: NonNullable<RuleElement['grants']>[number]): string {
  switch (grant.type) {
    case 'ability':
      return `${abilityLabel(grant.ability)} ${grant.value >= 0 ? '+' : ''}${grant.value}`
    case 'proficiency':
      if (grant.target === 'save') return `${abilityLabel(grant.value)} saving throw proficiency`
      return `${grant.value} ${grant.target} proficiency`
    case 'expertise':
      return `${grant.skill} expertise`
    case 'speed':
      return `${grant.mode} speed ${grant.value} ft.`
    case 'language':
      return `${grant.value} language`
    case 'spell':
      return `Spell: ${grant.spellSlug}`
    case 'resource':
      return `${grant.name} resource (${grant.reset})`
  }
}

function ruleSummary(rule: RuleElement | undefined): string[] {
  if (!rule) return ['No selection.']
  const lines: string[] = []
  if (rule.kind === 'class') {
    if (rule.hitDie) lines.push(`Hit Die: d${rule.hitDie}`)
    const saves = (rule.grants ?? []).flatMap(g =>
      g.type === 'proficiency' && g.target === 'save' ? [abilityLabel(g.value)] : [])
    if (saves.length) lines.push(`Saving throws: ${saves.join(', ')}`)
    if (rule.spellcastingAbility) lines.push(`Spellcasting ability: ${abilityLabel(rule.spellcastingAbility)}`)
    if (rule.subclassLevel) lines.push(`Subclass choice at class level ${rule.subclassLevel}`)
  }
  if (rule.kind === 'subclass' && rule.level) lines.push(`Unlocks at class level ${rule.level}`)
  for (const grant of rule.grants ?? []) lines.push(grantLabel(grant))
  for (const choice of rule.choices ?? []) lines.push(`Choice: ${choice.label} (${choice.choose})`)
  if (lines.length === 0) {
    const text = excerpt(rule.entries)
    if (text) lines.push(text)
    else lines.push(`${rule.name} has descriptive rules text but no structured sheet changes yet.`)
  }
  return [...new Set(lines)]
}

function shortSummary(rule: RuleElement): string {
  const lines = ruleSummary(rule)
  return lines.slice(0, 3).join(' · ')
}

function cleanRuleText(text: string | undefined): string {
  if (!text) return ''
  return text.replace(/\n?\s*Referenced progression\s*\n(?:.+\|.+\n?)+(?:\.\.\.and \d+ more)?/gi, '').trim()
}

function grantsForAbility(rule: RuleElement | undefined, ability: Ability): number {
  return (rule?.grants ?? []).reduce((sum, grant) =>
    grant.type === 'ability' && grant.ability === ability ? sum + grant.value : sum, 0)
}

function fixedAbilityBonusTotal(rule: RuleElement | undefined): number {
  return (rule?.grants ?? []).reduce((sum, grant) => grant.type === 'ability' ? sum + Math.abs(grant.value) : sum, 0)
}

function parseProgressionRef(ref: string): { name: string; level: string; source: string } {
  const parts = ref.split('|')
  const levelIndex = parts.findIndex((part, index) => index > 2 && /^\d+$/.test(part))
  let source = ''
  if (levelIndex === 3) source = parts[4] || parts[2] || ''
  else if (levelIndex === 5) source = parts[6] || parts[4] || parts[2] || ''
  else if (levelIndex >= 0) source = parts.slice(levelIndex + 1).find(part => part && !/^\d+$/.test(part)) ?? ''
  return {
    name: parts[0] ?? ref,
    level: levelIndex >= 0 ? parts[levelIndex] : '',
    source,
  }
}

function PickerButton({
  label,
  value,
  summary,
  disabled,
  onClick,
}: {
  label: string
  value: string
  summary: string
  disabled?: boolean
  onClick: () => void
}) {
  const { theme } = useTheme()
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="w-full rounded-lg p-3 text-left transition-opacity hover:opacity-90 disabled:opacity-55 disabled:cursor-not-allowed"
      style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: theme.text2 }}>{label}</div>
          <div className="text-sm font-bold truncate">{value}</div>
          <div className="text-[11px] truncate mt-0.5" style={{ color: theme.text2 }}>{summary}</div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-md shrink-0"
          style={{ background: theme.surface, color: disabled ? theme.text2 : theme.accent, border: `1px solid ${theme.border}` }}>
          Choose
        </span>
      </div>
    </button>
  )
}

export default function CharacterDetailPage() {
  const { theme } = useTheme()
  const { id } = useParams<{ id: string }>()
  const [picker, setPicker] = useState<PickerKind | null>(null)
  const [previewSlug, setPreviewSlug] = useState<string | null>(null)
  const [portraitResults, setPortraitResults] = useState<PortraitSearchResult[]>([])
  const [portraitQuery, setPortraitQuery] = useState('')
  const [portraitOffset, setPortraitOffset] = useState(0)
  const [portraitSearchError, setPortraitSearchError] = useState('')
  const [isSearchingPortraits, setIsSearchingPortraits] = useState(false)
  const [isLoadingMorePortraits, setIsLoadingMorePortraits] = useState(false)
  const [loadingPortraitIndex, setLoadingPortraitIndex] = useState<number | null>(null)
  const { characters, customRuleElements, customSpells, upsertCharacter } = useCombat()
  const sheet = id ? characters[id] : null
  const rules = mergeRules(customRuleElements)

  if (id && !sheet && Object.keys(characters).length > 0) return <Navigate to="/characters" replace />
  if (!sheet) return <div className="text-sm" style={{ color: theme.text2 }}>Loading...</div>

  const derived = deriveCharacter(sheet, rules)
  const classes = rules.filter(r => r.kind === 'class').sort((a, b) => a.name.localeCompare(b.name))
  const races = rules.filter(r => r.kind === 'race').sort((a, b) => a.name.localeCompare(b.name))
  const backgrounds = rules.filter(r => r.kind === 'background').sort((a, b) => a.name.localeCompare(b.name))
  const currentClass = sheet.classes[0]?.classSlug ?? classes[0]?.slug ?? ''
  const currentClassRule = rules.find(r => r.slug === currentClass)
  const subclasses = rules
    .filter(r => r.kind === 'subclass' && (!currentClassRule || r.className === currentClassRule.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  const allSpells = [...Object.values(customSpells), ...SPELLS]
  const selectedRace = sheet.ancestrySlug ? rules.find(r => r.slug === sheet.ancestrySlug) : undefined
  const selectedBackground = sheet.backgroundSlug ? rules.find(r => r.slug === sheet.backgroundSlug) : undefined
  const selectedSubclass = sheet.classes[0]?.subclassSlug ? rules.find(r => r.slug === sheet.classes[0]?.subclassSlug) : undefined
  const featureProgression = rules
    .filter(r => r.kind === 'classFeature' && currentClassRule && r.className === currentClassRule.name)
    .sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name))
  const visibleSpells = allSpells
    .filter(s => !currentClassRule?.name || s.classes.includes(currentClassRule.name))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .slice(0, 160)
  const spellGroups = Array.from(
    visibleSpells.reduce((map, spell) => {
      const group = map.get(spell.level) ?? []
      group.push(spell)
      map.set(spell.level, group)
      return map
    }, new Map<number, typeof visibleSpells>()),
  ).sort(([a], [b]) => a - b)
  const scoreMode = sheet.abilityScoreMode === 'manual' ? 'manual' : 'point-buy'
  const pointSpent = pointBuySpent(sheet.abilityScores)
  const pointRemaining = POINT_BUY_BUDGET - pointSpent
  const asiMode = sheet.abilityIncreaseMode ?? 'fixed'
  const flexibleBonuses = sheet.flexibleAbilityBonuses ?? {}
  const flexibleBudget = Math.max(3, fixedAbilityBonusTotal(selectedRace) || 3)
  const flexibleSpent = ABILITIES.reduce((sum, a) => sum + (flexibleBonuses[a] ?? 0), 0)
  const finalScores: CharacterSheet['abilityScores'] = {
    str: sheet.abilityScores.str + (asiMode === 'fixed' ? grantsForAbility(selectedRace, 'str') : flexibleBonuses.str ?? 0),
    dex: sheet.abilityScores.dex + (asiMode === 'fixed' ? grantsForAbility(selectedRace, 'dex') : flexibleBonuses.dex ?? 0),
    con: sheet.abilityScores.con + (asiMode === 'fixed' ? grantsForAbility(selectedRace, 'con') : flexibleBonuses.con ?? 0),
    int: sheet.abilityScores.int + (asiMode === 'fixed' ? grantsForAbility(selectedRace, 'int') : flexibleBonuses.int ?? 0),
    wis: sheet.abilityScores.wis + (asiMode === 'fixed' ? grantsForAbility(selectedRace, 'wis') : flexibleBonuses.wis ?? 0),
    cha: sheet.abilityScores.cha + (asiMode === 'fixed' ? grantsForAbility(selectedRace, 'cha') : flexibleBonuses.cha ?? 0),
  }

  const save = (patch: Partial<CharacterSheet>) => {
    upsertCharacter({ ...sheet, ...patch, updatedAt: new Date().toISOString() })
  }
  const saveFull = (next: CharacterSheet) => upsertCharacter({ ...next, updatedAt: new Date().toISOString() })
  const setPortraitFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') save({ portraitUrl: reader.result })
    }
    reader.readAsDataURL(file)
  }
  const portraitSearchTerms = [
      sheet.gender,
      selectedRace?.name,
      currentClassRule?.name,
      'portrait',
    ].filter(Boolean).join(' ') || 'fantasy character portrait'
  const searchPortrait = async () => {
    setIsSearchingPortraits(true)
    setPortraitSearchError('')
    setPortraitResults([])
    setPortraitOffset(0)
    setPortraitQuery(portraitSearchTerms)
    try {
      const results = await searchPortraitImages(portraitSearchTerms, 0)
      if (results.length === 0) setPortraitSearchError('No results found. Try changing gender, race, or class.')
      setPortraitResults(results)
    } catch {
      setPortraitSearchError('Search failed. Check the connection and try again.')
    } finally {
      setIsSearchingPortraits(false)
    }
  }
  const loadMorePortraits = async () => {
    const nextOffset = portraitOffset + 9
    setIsLoadingMorePortraits(true)
    try {
      const results = await searchPortraitImages(portraitQuery || portraitSearchTerms, nextOffset)
      if (results.length > 0) {
        setPortraitResults(prev => [...prev, ...results])
        setPortraitOffset(nextOffset)
      }
    } catch {
      setPortraitSearchError('Could not load more results.')
    } finally {
      setIsLoadingMorePortraits(false)
    }
  }
  const selectPortraitResult = async (result: PortraitSearchResult, index: number) => {
    setLoadingPortraitIndex(index)
    setPortraitSearchError('')
    try {
      const dataUrl = await proxyImageToDataUrl(result.full).catch(() => proxyImageToDataUrl(result.thumb))
      save({ portraitUrl: dataUrl })
      setPortraitResults([])
    } catch {
      setPortraitSearchError('Could not load that image. Try another result.')
    } finally {
      setLoadingPortraitIndex(null)
    }
  }
  const setAbility = (ability: Ability, value: number) => {
    const nextValue = scoreMode === 'point-buy'
      ? Math.max(8, Math.min(15, value))
      : Math.max(1, Math.min(30, value))
    save({ abilityScores: { ...sheet.abilityScores, [ability]: nextValue } })
  }
  const setAbilityMode = (mode: CharacterSheet['abilityScoreMode']) => {
    if (mode === 'point-buy') {
      save({
        abilityScoreMode: mode,
        abilityScores: { str: 13, dex: 12, con: 12, int: 12, wis: 10, cha: 10 },
      })
      return
    }
    save({ abilityScoreMode: mode })
  }
  const setAsiMode = (mode: NonNullable<CharacterSheet['abilityIncreaseMode']>) => {
    if (mode === 'flexible') {
      save({ abilityIncreaseMode: mode, flexibleAbilityBonuses: sheet.flexibleAbilityBonuses ?? { str: 2, con: 1 } })
      return
    }
    save({ abilityIncreaseMode: mode })
  }
  const setFlexibleBonus = (ability: Ability, value: number) => {
    const next = { ...flexibleBonuses, [ability]: Math.max(0, Math.min(2, value)) }
    save({ flexibleAbilityBonuses: next })
  }
  const setPrimaryClass = (classSlug: string) => {
    const first = sheet.classes[0]
    const old = first?.classSlug
    const classesNext = [{ classSlug, levels: Math.max(1, first?.levels ?? derived.level), subclassSlug: undefined }]
    const levelHistory = sheet.levelHistory.map(l => l.classSlug === old ? { ...l, classSlug } : l)
    save({ classes: classesNext, levelHistory })
  }
  const setSubclass = (subclassSlug: string) => {
    const classesNext = sheet.classes.length
      ? sheet.classes.map((c, i) => i === 0 ? { ...c, subclassSlug: subclassSlug || undefined } : c)
      : [{ classSlug: currentClass, levels: derived.level, subclassSlug: subclassSlug || undefined }]
    save({ classes: classesNext })
  }
  const levelUp = () => {
    const next = addClassLevel({ ...sheet, classes: normalizeCharacterClasses(sheet) }, currentClass, rules)
    const maxHp = deriveCharacter(next, rules).maxHp
    saveFull({ ...next, currentHp: maxHp })
  }
  const updateLevelHp = (levelId: string, hpValue: number) =>
    save({ levelHistory: sheet.levelHistory.map(l => l.id === levelId ? { ...l, hpMode: 'manual', hpValue } : l) })
  const addInventory = () => {
    const item: CharacterInventoryItem = { id: uid(), name: 'New item', quantity: 1 }
    save({ inventory: [...sheet.inventory, item] })
  }
  const updateInventory = (itemId: string, patch: Partial<CharacterInventoryItem>) =>
    save({ inventory: sheet.inventory.map(i => i.id === itemId ? { ...i, ...patch } : i) })
  const removeInventory = (itemId: string) => save({ inventory: sheet.inventory.filter(i => i.id !== itemId) })
  const toggleSpell = (slug: string, field: 'knownSpells' | 'preparedSpells') => {
    const set = new Set(sheet[field])
    if (set.has(slug)) set.delete(slug)
    else set.add(slug)
    save({ [field]: [...set].sort() } as Partial<CharacterSheet>)
  }
  const openPicker = (kind: PickerKind, currentSlug?: string) => {
    setPicker(kind)
    setPreviewSlug(currentSlug ?? null)
  }
  const pickerOptions = picker === 'race' ? races
    : picker === 'background' ? backgrounds
      : picker === 'class' ? classes
        : picker === 'subclass' ? subclasses
          : []
  const preview = pickerOptions.find(o => o.slug === previewSlug) ?? pickerOptions[0]
  const pickerTitle = picker === 'race' ? 'Choose race / species'
    : picker === 'background' ? 'Choose background'
      : picker === 'class' ? 'Choose class'
        : picker === 'subclass' ? 'Choose subclass'
          : ''
  const choosePreview = () => {
    if (!picker || !preview) return
    if (picker === 'race') save({ ancestrySlug: preview.slug })
    else if (picker === 'background') save({ backgroundSlug: preview.slug })
    else if (picker === 'class') setPrimaryClass(preview.slug)
    else if (picker === 'subclass') setSubclass(preview.slug)
    setPicker(null)
    setPreviewSlug(null)
  }
  const previewProgression = preview && (preview.kind === 'class' || preview.kind === 'subclass')
    ? rules
      .filter(r => {
        if (preview.kind === 'class') return r.kind === 'classFeature' && r.className === preview.name
        return r.kind === 'subclassFeature'
          && r.className === preview.className
          && r.subclassName === preview.name
      })
      .sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.name.localeCompare(b.name))
    : []
  const previewSpellLevels = preview?.kind === 'class' && preview.spellcastingAbility
    ? SPELLS.filter(s => s.classes.includes(preview.name))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .reduce((map, spell) => {
        const group = map.get(spell.level) ?? []
        group.push(spell.name)
        map.set(spell.level, group)
        return map
      }, new Map<number, string[]>())
    : new Map<number, string[]>()

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <Input value={sheet.name} onChange={e => save({ name: e.target.value })} className="text-2xl font-extrabold" />
          <div className="text-xs mt-2" style={{ color: theme.text2 }}>
            Level {derived.level} · PB +{derived.proficiencyBonus} · AC {derived.armorClass} · HP {derived.currentHp}/{derived.maxHp} · Init {derived.initiativeBonus >= 0 ? '+' : ''}{derived.initiativeBonus}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/characters/${sheet.id}/print`} className="inline-flex items-center justify-center gap-1.5 font-semibold px-4 py-2 text-sm rounded-lg"
            style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, textDecoration: 'none' }}>
            Print
          </Link>
          <Button variant="primary" onClick={levelUp} disabled={!currentClass || derived.level >= 20}>Level up</Button>
        </div>
      </div>

      {(derived.warnings.length > 0 || derived.unresolvedChoices.length > 0) && (
        <Surface className="p-4 mb-5">
          <div className="text-sm font-bold mb-1" style={{ color: theme.text }}>Validation</div>
          {[...derived.warnings, ...derived.unresolvedChoices.map(c => `Unresolved choice: ${c.label}`)].map(msg => (
            <div key={msg} className="text-xs" style={{ color: '#d97706' }}>{msg}</div>
          ))}
        </Surface>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div className="space-y-5">
          <Surface className="p-5">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Portrait</h2>
            <div className="grid sm:grid-cols-[160px_1fr] gap-4 items-start">
              <div className="aspect-[3/4] rounded-lg overflow-hidden flex items-center justify-center text-xs text-center"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text2 }}>
                {sheet.portraitUrl ? (
                  <img src={sheet.portraitUrl} alt={`${sheet.name} portrait`} className="w-full h-full object-cover" />
                ) : (
                  <span>No portrait</span>
                )}
              </div>
              <div className="space-y-3">
                <label className="block text-xs" style={{ color: theme.text2 }}>
                  Gender
                  <Select value={sheet.gender ?? ''} onChange={e => save({ gender: e.target.value as CharacterSheet['gender'] })} className="mt-1">
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>
                </label>
                <Button variant="secondary" onClick={searchPortrait} fullWidth disabled={isSearchingPortraits}>
                  {isSearchingPortraits ? 'Searching...' : `Find ${portraitSearchTerms}`}
                </Button>
                {portraitSearchError && <p className="text-xs" style={{ color: '#dc2626' }}>{portraitSearchError}</p>}
                {portraitResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {portraitResults.map((result, index) => (
                        <button key={`${result.thumb}-${index}`} type="button"
                          onClick={() => selectPortraitResult(result, index)}
                          disabled={loadingPortraitIndex !== null}
                          title={result.title}
                          className="relative aspect-[3/4] rounded-md overflow-hidden p-0"
                          style={{
                            background: theme.surface2,
                            border: `1px solid ${theme.border}`,
                            cursor: loadingPortraitIndex !== null ? 'wait' : 'pointer',
                          }}>
                          <img src={result.thumb} alt={result.title || 'Portrait result'} className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
                          {loadingPortraitIndex === index && (
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
                              style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}>
                              Loading
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={loadMorePortraits} disabled={isLoadingMorePortraits}>
                        {isLoadingMorePortraits ? 'Loading...' : 'More'}
                      </Button>
                      <Button variant="secondary" onClick={() => setPortraitResults([])}>Clear</Button>
                    </div>
                  </div>
                )}
                <label className="block text-xs" style={{ color: theme.text2 }}>
                  Image URL
                  <Input value={sheet.portraitUrl?.startsWith('data:') ? '' : sheet.portraitUrl ?? ''}
                    placeholder="https://..."
                    onChange={e => save({ portraitUrl: e.target.value })}
                    className="mt-1" />
                </label>
                <label className="block text-xs" style={{ color: theme.text2 }}>
                  Upload image
                  <input type="file" accept="image/*" onChange={e => setPortraitFile(e.target.files?.[0])}
                    className="mt-1 block w-full text-xs" style={{ color: theme.text }} />
                </label>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => save({ portraitUrl: '' })} disabled={!sheet.portraitUrl}>Remove portrait</Button>
                </div>
                <p className="text-xs" style={{ color: theme.text2 }}>
                  Uploaded images are stored with the character and included in Settings export.
                </p>
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Build</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <PickerButton
                label="Race / species"
                value={selectedRace?.name ?? 'Choose race / species'}
                summary={selectedRace ? shortSummary(selectedRace) : 'Ancestry traits, speed, and ability increases'}
                onClick={() => openPicker('race', sheet.ancestrySlug)}
              />
              <PickerButton
                label="Background"
                value={selectedBackground?.name ?? 'Choose background'}
                summary={selectedBackground ? shortSummary(selectedBackground) : 'Skills, tools, languages, and background feature'}
                onClick={() => openPicker('background', sheet.backgroundSlug)}
              />
              <PickerButton
                label="Class"
                value={currentClassRule?.name ?? 'Choose class'}
                summary={currentClassRule ? shortSummary(currentClassRule) : 'Hit die, saves, proficiencies, and level features'}
                onClick={() => openPicker('class', currentClass)}
              />
              <div className="sm:col-span-2">
                <PickerButton
                  label="Subclass"
                  value={selectedSubclass?.name ?? (subclasses.length ? 'Choose subclass' : 'No subclass options for current class')}
                  summary={selectedSubclass ? shortSummary(selectedSubclass) : 'Subclass features unlock at class-specific levels'}
                  disabled={subclasses.length === 0}
                  onClick={() => openPicker('subclass', sheet.classes[0]?.subclassSlug)}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              {[
                ['Race', selectedRace],
                ['Background', selectedBackground],
                ['Class', currentClassRule],
              ].map(([label, rule]) => (
                <div key={label as string} className="rounded-lg p-3 text-xs" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                  <div className="font-bold mb-1" style={{ color: theme.text }}>{label as string}</div>
                  <ul className="leading-relaxed list-disc pl-4" style={{ color: theme.text2 }}>
                    {ruleSummary(rule as RuleElement | undefined).map(line => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            {selectedSubclass && (
              <div className="rounded-lg p-3 text-xs mt-3" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <div className="font-bold mb-1" style={{ color: theme.text }}>Subclass</div>
                <ul className="leading-relaxed list-disc pl-4" style={{ color: theme.text2 }}>
                  {ruleSummary(selectedSubclass).map(line => <li key={line}>{line}</li>)}
                </ul>
              </div>
            )}
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h2 className="text-base font-bold" style={{ color: theme.text }}>Ability scores</h2>
              <div className="flex items-center gap-2">
                <Select value={scoreMode} onChange={e => setAbilityMode(e.target.value as CharacterSheet['abilityScoreMode'])} className="min-w-[180px]">
                  <option value="point-buy">Point buy 21</option>
                  <option value="manual">Free assignment</option>
                </Select>
                {scoreMode === 'point-buy' && (
                  <span className="text-xs whitespace-nowrap" style={{ color: pointRemaining < 0 ? '#dc2626' : theme.text2 }}>
                    {pointRemaining} left
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ABILITIES.map(a => (
                <label key={a} className="text-xs uppercase" style={{ color: theme.text2 }}>
                  {a}
                  <Input type="number" min={scoreMode === 'point-buy' ? 8 : 1} max={scoreMode === 'point-buy' ? 15 : 30} value={sheet.abilityScores[a]} onChange={e => setAbility(a, +e.target.value || 10)} />
                  <span className="block text-center mt-1" style={{ color: theme.text }}>
                    {finalScores[a]} ({derived.abilityMods[a] >= 0 ? '+' : ''}{derived.abilityMods[a]})
                  </span>
                  {finalScores[a] !== sheet.abilityScores[a] && (
                    <span className="block text-center text-[10px]" style={{ color: theme.text2 }}>
                      base {sheet.abilityScores[a]}
                    </span>
                  )}
                  {scoreMode === 'point-buy' && (
                    <span className="block text-center text-[10px]" style={{ color: theme.text2 }}>
                      {POINT_BUY_COST[sheet.abilityScores[a]] ?? 0} pts
                    </span>
                  )}
                </label>
              ))}
            </div>
            {scoreMode === 'point-buy' && (
              <p className="text-xs mt-3" style={{ color: pointRemaining < 0 ? '#dc2626' : theme.text2 }}>
                Scores are limited to 8-15 before racial bonuses and use the standard 5e point-buy cost table with a 21 point budget.
              </p>
            )}
            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${theme.border}` }}>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="text-sm font-bold" style={{ color: theme.text }}>Ability increases</div>
                  <div className="text-xs" style={{ color: theme.text2 }}>
                    Fixed uses the selected race/species rules. Flexible lets you assign the same total bonus manually.
                  </div>
                </div>
                <Select value={asiMode} onChange={e => setAsiMode(e.target.value as NonNullable<CharacterSheet['abilityIncreaseMode']>)} className="max-w-[220px]">
                  <option value="fixed">Fixed racial bonuses</option>
                  <option value="flexible">Flexible assignment</option>
                </Select>
              </div>
              {asiMode === 'flexible' ? (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {ABILITIES.map(a => (
                      <label key={a} className="text-xs uppercase" style={{ color: theme.text2 }}>
                        {a} bonus
                        <Input type="number" min={0} max={2} value={flexibleBonuses[a] ?? 0} onChange={e => setFlexibleBonus(a, +e.target.value || 0)} />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: flexibleSpent === flexibleBudget ? theme.text2 : '#d97706' }}>
                    Assigned {flexibleSpent} of {flexibleBudget}. Each ability is capped at +2.
                  </p>
                </>
              ) : (
                <p className="text-xs" style={{ color: theme.text2 }}>
                  Current fixed bonuses: {ruleSummary(selectedRace).filter(line => /^[A-Z]{3} [+-]\d/.test(line)).join(', ') || 'none'}
                </p>
              )}
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold" style={{ color: theme.text }}>Level history</h2>
              <Button size="sm" onClick={levelUp} disabled={!currentClass || derived.level >= 20}>Add level</Button>
            </div>
            <div className="space-y-2">
              {sheet.levelHistory.map(l => {
                const cls = rules.find(r => r.slug === l.classSlug)
                return (
                  <div key={l.id} className="grid grid-cols-[1fr_90px] gap-2 items-center text-sm">
                    <div style={{ color: theme.text }}>Level {l.level}: {cls?.name ?? l.classSlug}</div>
                    <Input type="number" value={l.hpValue} min={1} onChange={e => updateLevelHp(l.id, +e.target.value || 1)} />
                  </div>
                )
              })}
            </div>
            {featureProgression.length > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.text2 }}>
                  {currentClassRule?.name} feature progression
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {featureProgression.slice(0, 16).map(f => {
                    const active = (f.level ?? 99) <= derived.level
                    return (
                      <div key={f.slug} className="rounded-lg p-2 text-xs"
                        style={{ background: active ? `${theme.accent}14` : theme.surface2, border: `1px solid ${active ? theme.accent : theme.border}` }}>
                        <div className="font-semibold" style={{ color: theme.text }}>Level {f.level}: {f.name}</div>
                        <div className="mt-1 line-clamp-2" style={{ color: theme.text2 }}>{excerpt(f.entries)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold" style={{ color: theme.text }}>Inventory</h2>
              <Button size="sm" onClick={addInventory}>Add item</Button>
            </div>
            <div className="space-y-2">
              {sheet.inventory.map(i => (
                <div key={i.id} className="grid sm:grid-cols-[1fr_80px_80px_28px] gap-2 items-center">
                  <Input value={i.name} onChange={e => updateInventory(i.id, { name: e.target.value })} list="items" />
                  <Input type="number" value={i.quantity} min={1} onChange={e => updateInventory(i.id, { quantity: +e.target.value || 1 })} />
                  <label className="text-xs flex items-center gap-1" style={{ color: theme.text2 }}>
                    <input type="checkbox" checked={!!i.equipped} onChange={e => updateInventory(i.id, { equipped: e.target.checked })} /> Equipped
                  </label>
                  <button onClick={() => removeInventory(i.id)} style={{ color: theme.text2 }}>×</button>
                </div>
              ))}
              <datalist id="items">{ITEMS.map(i => <option key={i.slug} value={i.name} />)}</datalist>
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Spells</h2>
            <div className="space-y-3 max-h-80 overflow-auto">
              {spellGroups.map(([level, spells]) => (
                <div key={level}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.text2 }}>
                    {level === 0 ? 'Cantrips' : `Level ${level}`}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {spells.map(s => (
                      <label key={s.slug} className="text-xs flex items-center gap-2 rounded px-2 py-1"
                        style={{ background: theme.surface2, color: theme.text }}>
                        <input type="checkbox" checked={sheet.knownSpells.includes(s.slug)} onChange={() => toggleSpell(s.slug, 'knownSpells')} />
                        <span className="flex-1 truncate">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Notes</h2>
            <Textarea value={sheet.notes ?? ''} rows={5} onChange={e => save({ notes: e.target.value })} />
          </Surface>
        </div>

        <div className="space-y-5">
          <Surface className="p-5">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Derived sheet</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[10px]" style={{ color: theme.text2 }}>AC</div><div className="text-xl font-bold" style={{ color: theme.accent }}>{derived.armorClass}</div></div>
              <div><div className="text-[10px]" style={{ color: theme.text2 }}>HP</div><div className="text-xl font-bold" style={{ color: theme.accent }}>{derived.maxHp}</div></div>
              <div><div className="text-[10px]" style={{ color: theme.text2 }}>Speed</div><div className="text-xl font-bold" style={{ color: theme.accent }}>{derived.speed.walk ?? 30}</div></div>
            </div>
            <div className="mt-4 text-xs space-y-1" style={{ color: theme.text2 }}>
              <div>Passive Perception {derived.passivePerception}</div>
              <div>Saves {Object.entries(derived.savingThrows).map(([a, v]) => `${a.toUpperCase()} ${v && v >= 0 ? '+' : ''}${v}`).join(' · ')}</div>
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="text-base font-bold mb-3" style={{ color: theme.text }}>Features</h2>
            <div className="space-y-2 max-h-96 overflow-auto">
              {derived.features.map(f => (
                <details key={f.slug} className="text-xs rounded p-2" style={{ background: theme.surface2, color: theme.text }}>
                  <summary className="font-semibold cursor-pointer">{f.name}</summary>
                  <p className="mt-1 whitespace-pre-wrap" style={{ color: theme.text2 }}>{cleanRuleText(f.entries) || 'Imported feature text unavailable.'}</p>
                </details>
              ))}
            </div>
          </Surface>
        </div>
      </div>
      <Modal open={picker !== null} onClose={() => { setPicker(null); setPreviewSlug(null) }} title={pickerTitle} maxWidth="980px">
        {picker && (
          <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[560px]">
            <div className="rounded-lg overflow-auto" style={{ border: `1px solid ${theme.border}`, maxHeight: '65vh' }}>
              {pickerOptions.length === 0 ? (
                <div className="p-3 text-sm" style={{ color: theme.text2 }}>No options available.</div>
              ) : pickerOptions.map(option => {
                const active = option.slug === (preview?.slug ?? '')
                return (
                  <button key={option.slug} type="button" onClick={() => setPreviewSlug(option.slug)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:opacity-90"
                    style={{
                      background: active ? `${theme.accent}18` : theme.surface,
                      borderBottom: `1px solid ${theme.border}`,
                      color: active ? theme.accent : theme.text,
                    }}>
                    <div className="font-semibold">{option.name}</div>
                    <div className="text-[11px] truncate" style={{ color: theme.text2 }}>{shortSummary(option)}</div>
                  </button>
                )
              })}
            </div>
            <div className="rounded-lg p-4 overflow-auto" style={{ background: theme.surface2, border: `1px solid ${theme.border}`, maxHeight: '65vh' }}>
              {preview ? (
                <>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: theme.text }}>{preview.name}</h3>
                      <div className="text-xs capitalize" style={{ color: theme.text2 }}>
                        {preview.kind}
                        {preview.source?.sourceName ? ` · ${preview.source.sourceName}` : ''}
                      </div>
                    </div>
                    <Button variant="primary" onClick={choosePreview}>Choose</Button>
                  </div>
                  <div className="rounded-lg p-3 mb-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                    <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.text2 }}>Sheet changes</div>
                    <ul className="text-sm leading-relaxed list-disc pl-5" style={{ color: theme.text }}>
                      {ruleSummary(preview).map(line => <li key={line}>{line}</li>)}
                    </ul>
                  </div>
                  {preview.refs && preview.refs.length > 0 && (
                    <div className="rounded-lg p-3 mb-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.text2 }}>Referenced progression</div>
                      <div className="overflow-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr style={{ color: theme.text2, borderBottom: `1px solid ${theme.border}` }}>
                              <th className="text-left py-1 pr-2 font-semibold">Level</th>
                              <th className="text-left py-1 pr-2 font-semibold">Feature</th>
                              <th className="text-left py-1 font-semibold">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.refs.map(ref => {
                              const row = parseProgressionRef(ref)
                              return (
                                <tr key={ref} style={{ borderBottom: `1px solid ${theme.border}` }}>
                                  <td className="py-1 pr-2 whitespace-nowrap" style={{ color: theme.text }}>{row.level || '-'}</td>
                                  <td className="py-1 pr-2" style={{ color: theme.text }}>{row.name}</td>
                                  <td className="py-1 whitespace-nowrap" style={{ color: theme.text2 }}>{row.source || '-'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {previewProgression.length > 0 && (
                    <div className="rounded-lg p-3 mb-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.text2 }}>
                        {preview.kind === 'class' ? 'Level progression' : 'Subclass progression'}
                      </div>
                      <div className="space-y-2">
                        {previewProgression.map(feature => (
                          <details key={feature.slug} className="rounded-md p-2" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                            <summary className="cursor-pointer text-sm font-semibold" style={{ color: theme.text }}>
                              Level {feature.level ?? '?'}: {feature.name}
                            </summary>
                            <div className="text-xs mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: theme.text2 }}>
                              {cleanRuleText(feature.entries) || 'No feature text available.'}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                  {preview.kind === 'class' && preview.spellcastingAbility && (
                    <div className="rounded-lg p-3 mb-3" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: theme.text2 }}>Spellcasting</div>
                      <div className="text-sm mb-2" style={{ color: theme.text }}>
                        Uses {abilityLabel(preview.spellcastingAbility)} for spell save DCs and spell attacks.
                      </div>
                      {previewSpellLevels.size > 0 ? (
                        <div className="space-y-2">
                          {Array.from(previewSpellLevels.entries()).map(([level, names]) => (
                            <div key={level} className="text-xs">
                              <div className="font-semibold" style={{ color: theme.text }}>
                                {level === 0 ? 'Cantrips' : `Level ${level}`}
                              </div>
                              <div style={{ color: theme.text2 }}>
                                {names.slice(0, 18).join(', ')}{names.length > 18 ? `, and ${names.length - 18} more` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs" style={{ color: theme.text2 }}>No class spell list found in the current compendium.</div>
                      )}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: theme.text }}>
                    {cleanRuleText(preview.entries) || 'No descriptive text available for this imported rule element.'}
                  </div>
                </>
              ) : (
                <div className="text-sm" style={{ color: theme.text2 }}>Select an option to preview it.</div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
