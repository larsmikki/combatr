import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Campaign, CharacterSheet, CombatSession, Encounter, Monster, Party, RuleElement, Spell } from '@/types'
import { api } from '@/api'

interface CombatContextType {
  loaded: boolean
  loadError: string | null

  campaigns: Record<string, Campaign>
  activeCampaignId: string | null
  setActiveCampaignId: (id: string | null) => void
  activeCampaign: Campaign | null
  upsertCampaign: (c: Campaign) => Promise<void>
  deleteCampaign: (id: string) => Promise<{ ok: boolean; reason?: string }>

  // Convenience: party derived from active campaign. setParty writes back to it.
  party: Party
  setParty: (next: Party) => void

  encounters: Record<string, Encounter>
  upsertEncounter: (e: Encounter) => Promise<void>
  deleteEncounter: (id: string) => Promise<void>

  sessions: Record<string, CombatSession>
  upsertSession: (s: CombatSession) => Promise<void>
  deleteSession: (id: string) => Promise<void>

  customMonsters: Record<string, Monster>
  upsertCustomMonster: (m: Monster) => Promise<void>
  deleteCustomMonster: (slug: string) => Promise<void>
  bulkImportMonsters: (list: Monster[]) => Promise<{ imported: number; skipped: number }>
  wipeCustomMonsters: () => Promise<{ wiped: number }>

  customSpells: Record<string, Spell>
  deleteCustomSpell: (slug: string) => Promise<void>
  bulkImportSpells: (list: Spell[]) => Promise<{ imported: number; skipped: number }>
  wipeCustomSpells: () => Promise<{ wiped: number }>

  characters: Record<string, CharacterSheet>
  upsertCharacter: (c: CharacterSheet) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>

  customRuleElements: Record<string, RuleElement>
  bulkImportRuleElements: (list: RuleElement[]) => Promise<{ imported: number; skipped: number }>
  wipeCustomRuleElements: () => Promise<{ wiped: number }>

  encounterDraft: Encounter
  setEncounterDraft: (e: Encounter) => void
  resetDraft: (campaignId?: string) => Encounter

  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void

  exportAll: () => Promise<void>
  importAll: (json: string) => Promise<void>
}

const uid = () => Math.random().toString(36).slice(2, 10)

const emptyParty = (): Party => ({ generic: [{ level: 3, count: 4 }], characters: [] })

const newDraft = (campaignId: string): Encounter => ({
  id: uid(),
  campaignId,
  name: 'New Encounter',
  environment: '',
  dmNotes: '',
  groups: [],
  manualEntries: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const CombatContext = createContext<CombatContextType | null>(null)

export function CombatProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<Record<string, Campaign>>({})
  const [activeCampaignId, setActiveCampaignIdState] = useState<string | null>(
    () => localStorage.getItem('combatr-active-campaign'),
  )
  const setActiveCampaignId = useCallback((id: string | null) => {
    setActiveCampaignIdState(id)
    if (id) localStorage.setItem('combatr-active-campaign', id)
    else localStorage.removeItem('combatr-active-campaign')
  }, [])

  const [encounters, setEncounters] = useState<Record<string, Encounter>>({})
  const [sessions, setSessions] = useState<Record<string, CombatSession>>({})
  const [customMonsters, setCustomMonsters] = useState<Record<string, Monster>>({})
  const [customSpells, setCustomSpells] = useState<Record<string, Spell>>({})
  const [characters, setCharacters] = useState<Record<string, CharacterSheet>>({})
  const [customRuleElements, setCustomRuleElements] = useState<Record<string, RuleElement>>({})

  const [encounterDraft, setEncounterDraft] = useState<Encounter>(() => {
    const cached = localStorage.getItem('combatr-draft')
    if (cached) { try { return JSON.parse(cached) as Encounter } catch {} }
    return newDraft('')
  })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('combatr-active-session'))

  useEffect(() => { localStorage.setItem('combatr-draft', JSON.stringify(encounterDraft)) }, [encounterDraft])
  useEffect(() => {
    if (activeSessionId) localStorage.setItem('combatr-active-session', activeSessionId)
    else localStorage.removeItem('combatr-active-session')
  }, [activeSessionId])

  // Initial load
  useEffect(() => {
    api.getState()
      .then(s => {
        setCampaigns(s.campaigns ?? {})
        setEncounters(s.encounters)
        setSessions(s.sessions)
        setCustomMonsters(s.customMonsters ?? {})
        setCustomSpells(s.customSpells ?? {})
        setCharacters(s.characters ?? {})
        setCustomRuleElements(s.customRuleElements ?? {})
        // Pick active campaign: localStorage if still valid, else first.
        const ids = Object.keys(s.campaigns ?? {})
        const stored = localStorage.getItem('combatr-active-campaign')
        const next = stored && s.campaigns?.[stored] ? stored : ids[0] ?? null
        setActiveCampaignIdState(next)
        if (next) localStorage.setItem('combatr-active-campaign', next)
        setLoaded(true)
      })
      .catch(e => {
        setLoadError(e instanceof Error ? e.message : 'Failed to load')
        setLoaded(true)
      })
  }, [])

  const activeCampaign = activeCampaignId ? campaigns[activeCampaignId] ?? null : null

  // Debounced campaign writes (party edits in particular need debouncing).
  const campSaveTimer = useRef<Record<string, number>>({})
  const upsertCampaign = useCallback(async (c: Campaign) => {
    setCampaigns(prev => ({ ...prev, [c.id]: c }))
    const t = campSaveTimer.current[c.id]
    if (t) clearTimeout(t)
    campSaveTimer.current[c.id] = window.setTimeout(() => {
      api.putCampaign(c).catch(err => console.error('putCampaign', err))
    }, 400)
  }, [])

  const deleteCampaign = useCallback(async (id: string) => {
    if (Object.keys(campaigns).length <= 1) {
      return { ok: false, reason: 'Cannot delete the last campaign.' }
    }
    setCampaigns(prev => { const n = { ...prev }; delete n[id]; return n })
    setEncounters(prev => {
      const n = { ...prev }
      for (const eid of Object.keys(n)) if (n[eid].campaignId === id) delete n[eid]
      return n
    })
    if (activeCampaignId === id) {
      const remaining = Object.keys(campaigns).filter(k => k !== id)
      setActiveCampaignId(remaining[0] ?? null)
    }
    try { await api.deleteCampaign(id) } catch (err) { console.error('deleteCampaign', err) }
    return { ok: true }
  }, [campaigns, activeCampaignId, setActiveCampaignId])

  // Party = active campaign's party. Read returns empty party if none.
  const party = activeCampaign?.party ?? emptyParty()
  const setParty = useCallback((next: Party) => {
    if (!activeCampaign) return
    upsertCampaign({ ...activeCampaign, party: next, updatedAt: new Date().toISOString() })
  }, [activeCampaign, upsertCampaign])

  const upsertEncounter = useCallback(async (e: Encounter) => {
    setEncounters(prev => ({ ...prev, [e.id]: e }))
    try { await api.putEncounter(e) } catch (err) { console.error('putEncounter', err) }
  }, [])
  const deleteEncounter = useCallback(async (id: string) => {
    setEncounters(prev => { const n = { ...prev }; delete n[id]; return n })
    try { await api.deleteEncounter(id) } catch (err) { console.error('deleteEncounter', err) }
  }, [])

  const upsertSession = useCallback(async (s: CombatSession) => {
    setSessions(prev => ({ ...prev, [s.id]: s }))
    try { await api.putSession(s) } catch (err) { console.error('putSession', err) }
  }, [])
  const deleteSession = useCallback(async (id: string) => {
    setSessions(prev => { const n = { ...prev }; delete n[id]; return n })
    if (activeSessionId === id) setActiveSessionId(null)
    try { await api.deleteSession(id) } catch (err) { console.error('deleteSession', err) }
  }, [activeSessionId])

  const upsertCustomMonster = useCallback(async (m: Monster) => {
    setCustomMonsters(prev => ({ ...prev, [m.slug]: m }))
    try { await api.putCustomMonster(m) } catch (err) { console.error('putCustomMonster', err) }
  }, [])
  const deleteCustomMonster = useCallback(async (slug: string) => {
    setCustomMonsters(prev => { const n = { ...prev }; delete n[slug]; return n })
    try { await api.deleteCustomMonster(slug) } catch (err) { console.error('deleteCustomMonster', err) }
  }, [])
  const bulkImportMonsters = useCallback(async (list: Monster[]) => {
    const result = await api.bulkImportMonsters(list)
    const fresh = await api.listCustomMonsters()
    const next: Record<string, Monster> = {}
    for (const m of fresh) next[m.slug] = m
    setCustomMonsters(next)
    return result
  }, [])
  const wipeCustomMonsters = useCallback(async () => {
    const result = await api.wipeCustomMonsters()
    setCustomMonsters({})
    return result
  }, [])

  const deleteCustomSpell = useCallback(async (slug: string) => {
    setCustomSpells(prev => { const n = { ...prev }; delete n[slug]; return n })
    try { await api.deleteCustomSpell(slug) } catch (err) { console.error('deleteCustomSpell', err) }
  }, [])
  const bulkImportSpells = useCallback(async (list: Spell[]) => {
    const result = await api.bulkImportSpells(list)
    const fresh = await api.listCustomSpells()
    const next: Record<string, Spell> = {}
    for (const s of fresh) next[s.slug] = s
    setCustomSpells(next)
    return result
  }, [])
  const wipeCustomSpells = useCallback(async () => {
    const result = await api.wipeCustomSpells()
    setCustomSpells({})
    return result
  }, [])

  const upsertCharacter = useCallback(async (c: CharacterSheet) => {
    setCharacters(prev => ({ ...prev, [c.id]: c }))
    try { await api.putCharacter(c) } catch (err) { console.error('putCharacter', err) }
  }, [])
  const deleteCharacter = useCallback(async (id: string) => {
    setCharacters(prev => { const n = { ...prev }; delete n[id]; return n })
    try { await api.deleteCharacter(id) } catch (err) { console.error('deleteCharacter', err) }
  }, [])

  const bulkImportRuleElements = useCallback(async (list: RuleElement[]) => {
    const result = await api.bulkImportRuleElements(list)
    const fresh = await api.listCustomRuleElements()
    const next: Record<string, RuleElement> = {}
    for (const r of fresh) next[r.slug] = r
    setCustomRuleElements(next)
    return result
  }, [])
  const wipeCustomRuleElements = useCallback(async () => {
    const result = await api.wipeCustomRuleElements()
    setCustomRuleElements({})
    return result
  }, [])

  const resetDraft = useCallback((campaignId?: string) => {
    const d = newDraft(campaignId ?? activeCampaignId ?? '')
    setEncounterDraft(d)
    return d
  }, [activeCampaignId])

  const exportAll = useCallback(async () => {
    const data = await api.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `combatr-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const importAll = useCallback(async (jsonText: string) => {
    const parsed = JSON.parse(jsonText)
    await api.importAll(parsed)
    const s = await api.getState()
    setCampaigns(s.campaigns ?? {})
    setEncounters(s.encounters); setSessions(s.sessions)
    setCustomMonsters(s.customMonsters ?? {})
    setCustomSpells(s.customSpells ?? {})
    setCharacters(s.characters ?? {})
    setCustomRuleElements(s.customRuleElements ?? {})
    const ids = Object.keys(s.campaigns ?? {})
    setActiveCampaignId(ids[0] ?? null)
  }, [setActiveCampaignId])

  const value = useMemo<CombatContextType>(() => ({
    loaded, loadError,
    campaigns, activeCampaignId, setActiveCampaignId, activeCampaign,
    upsertCampaign, deleteCampaign,
    party, setParty,
    encounters, upsertEncounter, deleteEncounter,
    sessions, upsertSession, deleteSession,
    customMonsters, upsertCustomMonster, deleteCustomMonster, bulkImportMonsters, wipeCustomMonsters,
    customSpells, deleteCustomSpell, bulkImportSpells, wipeCustomSpells,
    characters, upsertCharacter, deleteCharacter,
    customRuleElements, bulkImportRuleElements, wipeCustomRuleElements,
    encounterDraft, setEncounterDraft, resetDraft,
    activeSessionId, setActiveSessionId,
    exportAll, importAll,
  }), [
    loaded, loadError,
    campaigns, activeCampaignId, setActiveCampaignId, activeCampaign,
    upsertCampaign, deleteCampaign,
    party, setParty,
    encounters, upsertEncounter, deleteEncounter,
    sessions, upsertSession, deleteSession,
    customMonsters, upsertCustomMonster, deleteCustomMonster, bulkImportMonsters, wipeCustomMonsters,
    customSpells, deleteCustomSpell, bulkImportSpells, wipeCustomSpells,
    characters, upsertCharacter, deleteCharacter,
    customRuleElements, bulkImportRuleElements, wipeCustomRuleElements,
    encounterDraft, resetDraft, activeSessionId, exportAll, importAll,
  ])

  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>
}

export const useCombat = () => {
  const ctx = useContext(CombatContext)
  if (!ctx) throw new Error('useCombat must be used inside CombatProvider')
  return ctx
}
