import { useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useCombat } from '@/contexts/CombatContext'
import ThemePicker from '@/components/ThemePicker'
import { useConfirm } from '@/components/ConfirmDialog'
import { Surface, Button, Input, Textarea } from '@/components/ui'
import type { Monster, RuleElement, Spell } from '@/types'
import { convertBestiary, looksLike5eToolsBestiary } from '@/lib/convert5eToolsBestiary'
import { convertSpellbook, looksLike5eToolsSpellbook } from '@/lib/convert5eToolsSpells'
import { convertRules, looksLike5eToolsRules } from '@/lib/convert5eToolsRules'

// Books that have a per-source spell file on 5etools (per compendium.json).
const SPELL_SOURCE_CODES = ['PHB', 'IDRotF'] as const
const CHARACTER_SOURCE_CODES = ['PHB', 'XPHB', 'TCE', 'XGE', 'SCAG', 'EFA', 'EGW', 'FRHoF'] as const
const CLASS_FILE_CODES = ['artificer','barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard'] as const
const CHARACTER_SHARED_FILES = ['races.json', 'backgrounds.json', 'feats.json'] as const

const SOURCE_NAMES: Record<string, string> = {
  MM:     'Monster Manual',
  PHB:    'PHB 2014',
  XPHB:   'PHB 2024',
  TCE:    'Tasha’s Cauldron of Everything',
  XGE:    'Xanathar’s Guide to Everything',
  SCAG:   'Sword Coast Adventurer’s Guide',
  EFA:    'Eberron: Rising from the Last War',
  ERLW:   'Eberron: Rising from the Last War',
  EGW:    'Explorer’s Guide to Wildemount',
  FRHoF:  'Forgotten Realms: Heroes of Faerûn',
  LMoP:   'Lost Mine of Phandelver',
  CoS:    'Curse of Strahd',
  ToA:    'Tomb of Annihilation',
  SKT:    'Storm King’s Thunder',
  WDH:    'Waterdeep: Dragon Heist',
  WDMM:   'Waterdeep: Dungeon of the Mad Mage',
  HotDQ:  'Hoard of the Dragon Queen',
  RoT:    'The Rise of Tiamat',
  IDRotF: 'Icewind Dale: Rime of the Frostmaiden',
}
const SOURCE_TAGS: Record<string, string> = {
  MM: 'mm', PHB: 'phb', LMoP: 'lmop', CoS: 'cos', ToA: 'toa', SKT: 'skt',
  WDH: 'wdh', WDMM: 'wdmm', HotDQ: 'hotdq', RoT: 'rot', IDRotF: 'rotf',
}

export default function SettingsPage() {
  const { theme } = useTheme()
  const {
    exportAll, importAll, encounters, sessions,
    customMonsters, bulkImportMonsters, wipeCustomMonsters,
    customSpells, bulkImportSpells, wipeCustomSpells,
    customRuleElements, bulkImportRuleElements, wipeCustomRuleElements,
  } = useCombat()
  const confirm = useConfirm()

  // ── Backup file import/export ──
  const backupInputRef = useRef<HTMLInputElement>(null)
  const [backupNote, setBackupNote] = useState<{ ok: boolean; text: string } | null>(null)

  const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await importAll(reader.result as string)
        setBackupNote({ ok: true, text: 'Imported successfully.' })
      } catch (err) {
        setBackupNote({ ok: false, text: err instanceof Error ? err.message : 'Import failed' })
      } finally {
        if (backupInputRef.current) backupInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // ── 5etools / JSON compendium import ──
  const compendiumFileRef = useRef<HTMLInputElement>(null)
  const [importText, setImportText] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [importNote, setImportNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [fetching, setFetching] = useState(false)
  const [characterSource, setCharacterSource] = useState<string>('PHB')

  const parseAndImport = async (raw: string) => {
    setImportNote(null)
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch (e) {
      setImportNote({ ok: false, text: 'Not valid JSON: ' + (e instanceof Error ? e.message : String(e)) })
      return
    }

    // 5etools character rules
    if (looksLike5eToolsRules(parsed)) {
      const sourceName = characterSource ? SOURCE_NAMES[characterSource] ?? characterSource : undefined
      const result = convertRules(parsed, { sourceFilter: characterSource || undefined, sourceName })
      if (result.converted.length === 0) {
        setImportNote({ ok: false, text: `5etools rules file detected but no convertible entries${characterSource ? ` for ${characterSource}` : ''}.` })
        return
      }
      try {
        const r = await bulkImportRuleElements(result.converted)
        const skipped = result.skipped.length ? `, converter skipped ${result.skipped.length}` : ''
        setImportNote({ ok: true, text: `Imported ${r.imported} ${characterSource || 'mixed-source'} rule element${r.imported === 1 ? '' : 's'}, skipped ${r.skipped}${skipped}.` })
        setImportText('')
      } catch (e) {
        setImportNote({ ok: false, text: e instanceof Error ? e.message : 'Rule import failed' })
      }
      return
    }

    // 5etools spellbook
    if (looksLike5eToolsSpellbook(parsed)) {
      const sample = (Array.isArray(parsed)
        ? (parsed as Array<{ source?: string }>)[0]
        : ((parsed as { spell?: Array<{ source?: string }> }).spell ?? [])[0])
      const srcId = sample?.source
      const sourceName = srcId ? SOURCE_NAMES[srcId] : undefined
      const result = convertSpellbook(parsed, { sourceName })
      if (result.converted.length === 0) {
        setImportNote({ ok: false, text: '5etools spellbook detected but no convertible entries.' })
        return
      }
      try {
        const r = await bulkImportSpells(result.converted)
        setImportNote({ ok: true, text: `Imported ${r.imported} spell${r.imported === 1 ? '' : 's'}, skipped ${r.skipped}.` })
        setImportText('')
      } catch (e) {
        setImportNote({ ok: false, text: e instanceof Error ? e.message : 'Spell import failed' })
      }
      return
    }

    // 5etools bestiary or raw Combatr-shape monster JSON
    let list: Monster[]
    let skippedNote = ''
    if (looksLike5eToolsBestiary(parsed)) {
      const sample = (Array.isArray(parsed)
        ? (parsed as Array<{ source?: string }>)[0]
        : ((parsed as { monster?: Array<{ source?: string }> }).monster ?? [])[0])
      const srcId = sample?.source
      const sourceName = srcId ? SOURCE_NAMES[srcId] : undefined
      const defaultTag = srcId ? SOURCE_TAGS[srcId] : undefined
      const result = convertBestiary(parsed, { sourceName, defaultTag })
      list = result.converted
      if (result.skipped.length) {
        skippedNote = ` (${result.skipped.length} skipped — _copy entries need their base bestiary)`
      }
      if (list.length === 0) {
        setImportNote({ ok: false, text: `5etools bestiary detected but no convertible entries${skippedNote}.` })
        return
      }
    } else {
      list = Array.isArray(parsed)
        ? parsed as Monster[]
        : (parsed && typeof parsed === 'object' && 'slug' in (parsed as object))
          ? [parsed as Monster]
          : []
      if (list.length === 0) {
        setImportNote({ ok: false, text: 'Expected a Monster object, an array of monsters, a 5etools bestiary, or a 5etools spellbook.' })
        return
      }
      const bad = list.find(m => !m || typeof m.slug !== 'string' || !m.slug || typeof m.name !== 'string')
      if (bad) {
        setImportNote({ ok: false, text: 'Every entry needs at least a "slug" and "name".' })
        return
      }
    }

    try {
      const r = await bulkImportMonsters(list)
      setImportNote({ ok: true, text: `Imported ${r.imported} monster${r.imported === 1 ? '' : 's'}, skipped ${r.skipped}${skippedNote}.` })
      setImportText('')
    } catch (e) {
      setImportNote({ ok: false, text: e instanceof Error ? e.message : 'Import failed' })
    }
  }

  const fetchAndImport = async (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    setImportNote(null)
    setFetching(true)
    try {
      const proxyUrl = `/api/proxy/5etools?url=${encodeURIComponent(trimmed)}`
      const res = await fetch(proxyUrl)
      const text = await res.text()
      if (!res.ok) {
        let detail = text
        try { detail = (JSON.parse(text) as { error?: string }).error ?? text } catch { /* keep raw */ }
        throw new Error(`HTTP ${res.status} — ${detail}`)
      }
      setImportText(text)
      await parseAndImport(text)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setImportNote({
        ok: false,
        text: `Fetch failed: ${msg}. Check the server console for details; you can also download the file and upload it instead.`,
      })
    } finally {
      setFetching(false)
    }
  }

  const fetchJsonViaProxy = async (url: string): Promise<unknown> => {
    const proxyUrl = `/api/proxy/5etools?url=${encodeURIComponent(url)}`
    const res = await fetch(proxyUrl)
    const text = await res.text()
    if (!res.ok) {
      let detail = text
      try { detail = (JSON.parse(text) as { error?: string }).error ?? text } catch { /* keep raw */ }
      throw new Error(`HTTP ${res.status} — ${detail}`)
    }
    return JSON.parse(text)
  }

  const importCharacterSource = async (sourceCode: string) => {
    setImportNote(null)
    setFetching(true)
    setCharacterSource(sourceCode)
    try {
      const sourceName = SOURCE_NAMES[sourceCode] ?? sourceCode
      const converted: RuleElement[] = []
      const skipped: Array<{ name: string; reason: string }> = []
      const urls = [
        ...CLASS_FILE_CODES.map(code => `https://5e.tools/data/class/class-${code}.json`),
        ...CHARACTER_SHARED_FILES.map(file => `https://5e.tools/data/${file}`),
      ]
      for (const url of urls) {
        const parsed = await fetchJsonViaProxy(url)
        if (!looksLike5eToolsRules(parsed)) continue
        const result = convertRules(parsed, { sourceFilter: sourceCode, sourceName })
        converted.push(...result.converted)
        skipped.push(...result.skipped)
      }
      const dedup = new Map<string, RuleElement>()
      for (const rule of converted) dedup.set(rule.slug, rule)
      const list = [...dedup.values()]
      if (list.length === 0) {
        setImportNote({ ok: false, text: `No character rules found for ${sourceCode}.` })
        return
      }
      const r = await bulkImportRuleElements(list)
      setImportNote({
        ok: true,
        text: `Imported ${r.imported} ${sourceCode} character rule element${r.imported === 1 ? '' : 's'}, skipped ${r.skipped}${skipped.length ? `, converter skipped ${skipped.length}` : ''}.`,
      })
    } catch (e) {
      setImportNote({ ok: false, text: e instanceof Error ? e.message : 'Character source import failed' })
    } finally {
      setFetching(false)
    }
  }

  const handleCompendiumFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { parseAndImport(reader.result as string) }
    reader.readAsText(file)
    if (compendiumFileRef.current) compendiumFileRef.current.value = ''
  }

  // ── Wipe ──
  const [wipeNote, setWipeNote] = useState<{ ok: boolean; text: string } | null>(null)
  const handleWipeMonsters = async () => {
    const count = Object.keys(customMonsters).length
    if (count === 0) { setWipeNote({ ok: false, text: 'Nothing to wipe — no imported monsters.' }); return }
    if (!await confirm({
      title: 'Wipe imported monsters',
      message: `Permanently delete all ${count} imported monster${count === 1 ? '' : 's'}? Spells, encounters, sessions, and party are untouched.`,
      confirmLabel: 'Wipe',
      destructive: true,
    })) return
    try {
      const r = await wipeCustomMonsters()
      setWipeNote({ ok: true, text: `Wiped ${r.wiped} imported monster${r.wiped === 1 ? '' : 's'}.` })
    } catch (e) { setWipeNote({ ok: false, text: e instanceof Error ? e.message : 'Wipe failed' }) }
  }
  const handleWipeSpells = async () => {
    const count = Object.keys(customSpells).length
    if (count === 0) { setWipeNote({ ok: false, text: 'Nothing to wipe — no imported spells.' }); return }
    if (!await confirm({
      title: 'Wipe imported spells',
      message: `Permanently delete all ${count} imported spell${count === 1 ? '' : 's'}? Monsters, encounters, sessions, and party are untouched.`,
      confirmLabel: 'Wipe',
      destructive: true,
    })) return
    try {
      const r = await wipeCustomSpells()
      setWipeNote({ ok: true, text: `Wiped ${r.wiped} imported spell${r.wiped === 1 ? '' : 's'}.` })
    } catch (e) { setWipeNote({ ok: false, text: e instanceof Error ? e.message : 'Wipe failed' }) }
  }
  const handleWipeRules = async () => {
    const count = Object.keys(customRuleElements).length
    if (count === 0) { setWipeNote({ ok: false, text: 'Nothing to wipe — no imported character rules.' }); return }
    if (!await confirm({
      title: 'Wipe imported character rules',
      message: `Permanently delete all ${count} imported class, race, background, feat, and feature rule elements? Characters keep their stored choices but may show missing-rule warnings.`,
      confirmLabel: 'Wipe',
      destructive: true,
    })) return
    try {
      const r = await wipeCustomRuleElements()
      setWipeNote({ ok: true, text: `Wiped ${r.wiped} imported rule element${r.wiped === 1 ? '' : 's'}.` })
    } catch (e) { setWipeNote({ ok: false, text: e instanceof Error ? e.message : 'Wipe failed' }) }
  }

  // ── 5etools-sourced groups for the listing (hides truly-custom entries) ──
  const groupedBySource = useMemo(() => {
    const groups: Record<string, { monsters: Monster[]; spells: Spell[]; rules: RuleElement[] }> = {}
    const ensure = (id: string) => (groups[id] ??= { monsters: [], spells: [], rules: [] })
    for (const m of Object.values(customMonsters)) {
      const id = m.source?.sourceId
      if (!id || !(id in SOURCE_NAMES)) continue
      ensure(id).monsters.push(m)
    }
    for (const s of Object.values(customSpells)) {
      const id = s.source?.sourceId
      if (!id || !(id in SOURCE_NAMES)) continue
      ensure(id).spells.push(s)
    }
    for (const r of Object.values(customRuleElements)) {
      const id = r.source?.sourceId
      if (!id) continue
      ensure(id).rules.push(r)
    }
    return Object.entries(groups)
      .map(([id, v]) => ({
        id, name: SOURCE_NAMES[id] ?? v.rules[0]?.source?.sourceName ?? id,
        monsters: v.monsters.sort((a, b) => a.name.localeCompare(b.name)),
        spells: v.spells.sort((a, b) => a.name.localeCompare(b.name)),
        rules: v.rules.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [customMonsters, customSpells, customRuleElements])

  const encounterCount = Object.keys(encounters).length
  const sessionCount = Object.keys(sessions).length
  const importSummary = (g: { monsters: Monster[]; spells: Spell[]; rules: RuleElement[] }) => [
    g.monsters.length > 0 ? `${g.monsters.length} monster${g.monsters.length === 1 ? '' : 's'}` : '',
    g.spells.length > 0 ? `${g.spells.length} spell${g.spells.length === 1 ? '' : 's'}` : '',
    g.rules.length > 0 ? `${g.rules.length} rule element${g.rules.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ')

  const chipStyle = {
    background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`,
  }

  const TrashIcon = () => (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z" clipRule="evenodd"/>
    </svg>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.text }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: theme.text2 }}>Customize your Combatr experience.</p>
      </div>

      {/* Theme */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Theme</h2>
        <p className="text-xs mb-5" style={{ color: theme.text2 }}>Choose how Combatr looks to you.</p>
        <ThemePicker />
      </Surface>

      {/* Compendium imports */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Compendium imports</h2>
        <p className="text-xs mb-3" style={{ color: theme.text2 }}>
          Auto-detects bestiary (<code>{'{ monster: [...] }'}</code>), spell (<code>{'{ spell: [...] }'}</code>), and character-rule JSON such as classes, races, backgrounds, and feats. Imports are private to this server and never leave it. Per-book JSON files come from the community-maintained{' '}
          <a href="https://5e.tools/bestiary.html" target="_blank" rel="noopener noreferrer" style={{ color: theme.accent, textDecoration: 'underline' }}>5e.tools</a> project — use only with books you legally own.
        </p>

        {/* URL + fetch */}
        <div className="flex gap-2 items-center flex-wrap mb-3">
          <Input type="url" value={importUrl} onChange={e => setImportUrl(e.target.value)}
            placeholder="https://5e.tools/data/bestiary/bestiary-idrotf.json"
            className="flex-1 min-w-[260px] font-mono"
          />
          <Button variant="primary" size="sm" onClick={() => fetchAndImport(importUrl)} disabled={fetching || !importUrl.trim()}>
            {fetching ? 'Fetching…' : 'Fetch & import'}
          </Button>
        </div>

        {/* Quick-link chips */}
        <div className="mb-2 flex flex-wrap gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wider mr-1" style={{ color: theme.text2 }}>Bestiaries:</span>
          {Object.entries(SOURCE_NAMES).map(([code, label]) => {
            const url = `https://5e.tools/data/bestiary/bestiary-${code.toLowerCase()}.json`
            return (
              <button key={code} onClick={() => { setImportUrl(url); fetchAndImport(url) }}
                title={`${label} — ${url}`}
                className="text-[11px] px-2 py-0.5 rounded hover:opacity-90"
                style={chipStyle}>{code}</button>
            )
          })}
        </div>
        <div className="mb-3 flex flex-wrap gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wider mr-1" style={{ color: theme.text2 }}>Spells:</span>
          {SPELL_SOURCE_CODES.map(code => {
            const label = SOURCE_NAMES[code]
            const url = `https://5e.tools/data/spells/spells-${code.toLowerCase()}.json`
            return (
              <button key={code} onClick={() => { setImportUrl(url); fetchAndImport(url) }}
                title={`${label} spells — ${url}`}
                className="text-[11px] px-2 py-0.5 rounded hover:opacity-90"
                style={chipStyle}>{code}</button>
            )
          })}
        </div>
        <div className="mb-3 flex flex-wrap gap-1 items-center">
          <span className="text-[10px] uppercase tracking-wider mr-1" style={{ color: theme.text2 }}>Characters:</span>
          {CHARACTER_SOURCE_CODES.map(code => (
            <button key={code} onClick={() => importCharacterSource(code)}
              disabled={fetching}
              title={`Import all ${SOURCE_NAMES[code] ?? code} character rules from 5e.tools class, race, background, and feat data`}
              className="text-[11px] px-2 py-0.5 rounded hover:opacity-90 disabled:opacity-50"
              style={chipStyle}>{code}</button>
          ))}
        </div>

        {/* Paste / upload */}
        <Textarea value={importText} onChange={e => setImportText(e.target.value)}
          placeholder='Paste JSON here, or use a chip / URL above…'
          rows={6} className="font-mono" />
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <Button variant="primary" size="sm" onClick={() => parseAndImport(importText)}>Import JSON</Button>
          <Button size="sm" onClick={() => compendiumFileRef.current?.click()}>Upload file…</Button>
          <input ref={compendiumFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleCompendiumFile} />
          {importNote && (
            <span className="text-xs" style={{ color: importNote.ok ? '#22c55e' : '#d2484a' }}>
              {importNote.ok ? '✓' : '✗'} {importNote.text}
            </span>
          )}
        </div>
      </Surface>

      {/* Imported content (listing + wipe) */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Imported content</h2>
        <p className="text-xs mb-3" style={{ color: theme.text2 }}>
          {Object.keys(customMonsters).length} monster{Object.keys(customMonsters).length === 1 ? '' : 's'}, {Object.keys(customSpells).length} spell{Object.keys(customSpells).length === 1 ? '' : 's'}, and {Object.keys(customRuleElements).length} character rule element{Object.keys(customRuleElements).length === 1 ? '' : 's'} imported. Wiping a category reverts that category to bundled SRD content only.
        </p>

        {groupedBySource.length > 0 ? (
          <div className="mb-4 flex flex-col gap-2">
            {groupedBySource.map(g => (
              <details key={g.id}
                className="rounded-lg px-3 py-2"
                style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <summary className="cursor-pointer flex items-center gap-2 flex-wrap text-sm" style={{ color: theme.text }}>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${theme.accent}22`, color: theme.accent }}>{g.id}</span>
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-xs" style={{ color: theme.text2 }}>
                    {importSummary(g)}
                  </span>
                </summary>
                <div className="mt-2 grid sm:grid-cols-3 gap-x-4 gap-y-1 text-xs" style={{ color: theme.text2 }}>
                  {g.monsters.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.text }}>Monsters</div>
                      {g.monsters.map(m => <div key={m.slug} className="truncate">· {m.name}</div>)}
                    </div>
                  )}
                  {g.spells.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.text }}>Spells</div>
                      {g.spells.map(s => <div key={s.slug} className="truncate">· {s.name}</div>)}
                    </div>
                  )}
                  {g.rules.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: theme.text }}>Rules</div>
                      {g.rules.slice(0, 80).map(r => <div key={r.slug} className="truncate">· {r.name} <span className="capitalize">({r.kind})</span></div>)}
                      {g.rules.length > 80 && <div>· ...and {g.rules.length - 80} more</div>}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-xs mb-4 italic" style={{ color: theme.text2 }}>Nothing imported from a recognized 5etools source yet.</p>
        )}

        <div className="flex gap-3 flex-wrap">
          <Button variant="danger" leadingIcon={<TrashIcon />} onClick={handleWipeMonsters}>Wipe imported monsters</Button>
          <Button variant="danger" leadingIcon={<TrashIcon />} onClick={handleWipeSpells}>Wipe imported spells</Button>
          <Button variant="danger" leadingIcon={<TrashIcon />} onClick={handleWipeRules}>Wipe imported rules</Button>
        </div>
        {wipeNote && (
          <p className="text-xs mt-3" style={{ color: wipeNote.ok ? '#22c55e' : '#d2484a' }}>
            {wipeNote.ok ? '✓' : '✗'} {wipeNote.text}
          </p>
        )}
      </Surface>

      {/* Data backup */}
      <Surface className="p-6 mb-5">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>Data backup</h2>
        <p className="text-xs mb-5" style={{ color: theme.text2 }}>
          {encounterCount} encounter{encounterCount === 1 ? '' : 's'} and {sessionCount} session{sessionCount === 1 ? '' : 's'} stored on the server. Export creates a JSON backup of your party, encounters, sessions, and imported content.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={exportAll}
            leadingIcon={
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm3.293-7.707a1 1 0 0 1 1.414 0L9 10.586V3a1 1 0 1 1 2 0v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414z" clipRule="evenodd"/>
              </svg>
            }
          >
            Export
          </Button>
          <Button
            onClick={() => backupInputRef.current?.click()}
            leadingIcon={
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zM6.293 6.707a1 1 0 0 1 0-1.414l3-3a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L11 5.414V13a1 1 0 1 1-2 0V5.414L7.707 6.707a1 1 0 0 1-1.414 0z" clipRule="evenodd"/>
              </svg>
            }
          >
            Restore backup
          </Button>
          <input ref={backupInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleBackupImport} />
        </div>
        {backupNote && (
          <p className="text-xs mt-3" style={{ color: backupNote.ok ? '#22c55e' : '#d2484a' }}>
            {backupNote.ok ? '✓' : '✗'} {backupNote.text}
          </p>
        )}
      </Surface>

      {/* About */}
      <Surface className="p-6">
        <h2 className="text-base font-bold mb-1" style={{ color: theme.text }}>About</h2>
        <p className="text-xs" style={{ color: theme.text2 }}>
          Combatr is a self-hosted D&amp;D 5e encounter builder and combat tracker. It bundles SRD 5.1 content under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
             className="underline" style={{ color: theme.accent }}>CC BY 4.0</a>.
          It does not bundle proprietary book content; you privately import your own legally owned material above.
        </p>
        <p className="text-[11px] mt-3" style={{ color: theme.text2 }}>
          This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available under the Creative Commons Attribution 4.0 International License.
        </p>
      </Surface>
    </div>
  )
}
