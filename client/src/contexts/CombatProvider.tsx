import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Campaign, CharacterSheet, CombatSession, Encounter, Monster, RuleElement, Spell } from '@/types'
import { api, type AppState } from '@/api'
import {
  CombatContext,
  combatQueryKey,
  emptyParty,
  newDraft,
  type CombatContextType,
} from '@/contexts/CombatContext'

const emptyState: AppState = {
  campaigns: {},
  encounters: {},
  sessions: {},
  customMonsters: {},
  customSpells: {},
  characters: {},
  customRuleElements: {},
}
const EMPTY_CAMPAIGNS: AppState['campaigns'] = {}
const EMPTY_ENCOUNTERS: AppState['encounters'] = {}
const EMPTY_SESSIONS: AppState['sessions'] = {}
const EMPTY_MONSTERS: AppState['customMonsters'] = {}
const EMPTY_SPELLS: AppState['customSpells'] = {}
const EMPTY_CHARACTERS: AppState['characters'] = {}
const EMPTY_RULE_ELEMENTS: AppState['customRuleElements'] = {}

const toRecord = <T extends { slug?: string; id?: string }>(items: T[], key: 'slug' | 'id') => {
  const next: Record<string, T> = {}
  for (const item of items) {
    const value = item[key]
    if (value) next[value] = item
  }
  return next
}

export function CombatProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [activeCampaignId, setActiveCampaignIdState] = useState<string | null>(
    () => localStorage.getItem('combatr-active-campaign'),
  )
  const [encounterDraft, setEncounterDraft] = useState<Encounter>(() => {
    const cached = localStorage.getItem('combatr-draft')
    if (cached) { try { return JSON.parse(cached) as Encounter } catch {} }
    return newDraft('')
  })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('combatr-active-session'))

  const { data = emptyState, isLoading, error } = useQuery({
    queryKey: combatQueryKey,
    queryFn: api.getState,
  })

  useEffect(() => { localStorage.setItem('combatr-draft', JSON.stringify(encounterDraft)) }, [encounterDraft])
  useEffect(() => {
    if (activeSessionId) localStorage.setItem('combatr-active-session', activeSessionId)
    else localStorage.removeItem('combatr-active-session')
  }, [activeSessionId])

  const campaigns = data.campaigns ?? EMPTY_CAMPAIGNS
  const encounters = data.encounters ?? EMPTY_ENCOUNTERS
  const sessions = data.sessions ?? EMPTY_SESSIONS
  const customMonsters = data.customMonsters ?? EMPTY_MONSTERS
  const customSpells = data.customSpells ?? EMPTY_SPELLS
  const characters = data.characters ?? EMPTY_CHARACTERS
  const customRuleElements = data.customRuleElements ?? EMPTY_RULE_ELEMENTS

  const validActiveCampaignId = activeCampaignId && campaigns[activeCampaignId]
    ? activeCampaignId
    : Object.keys(campaigns)[0] ?? null
  const activeCampaign = validActiveCampaignId ? campaigns[validActiveCampaignId] ?? null : null

  const setState = useCallback((updater: (state: AppState) => AppState) => {
    queryClient.setQueryData<AppState>(combatQueryKey, prev => updater(prev ?? emptyState))
  }, [queryClient])

  const setActiveCampaignId = useCallback((id: string | null) => {
    setActiveCampaignIdState(id)
    if (id) localStorage.setItem('combatr-active-campaign', id)
    else localStorage.removeItem('combatr-active-campaign')
  }, [])

  const campSaveTimer = useRef<Record<string, number>>({})
  const upsertCampaign = useCallback(async (c: Campaign) => {
    setState(prev => ({ ...prev, campaigns: { ...(prev.campaigns ?? {}), [c.id]: c } }))
    const t = campSaveTimer.current[c.id]
    if (t) clearTimeout(t)
    campSaveTimer.current[c.id] = window.setTimeout(() => {
      api.putCampaign(c).catch(err => console.error('putCampaign', err))
    }, 400)
  }, [setState])

  const deleteCampaign = useCallback(async (id: string) => {
    if (Object.keys(campaigns).length <= 1) {
      return { ok: false, reason: 'Cannot delete the last campaign.' }
    }
    setState(prev => {
      const nextCampaigns = { ...(prev.campaigns ?? {}) }
      delete nextCampaigns[id]
      const nextEncounters = { ...(prev.encounters ?? {}) }
      for (const eid of Object.keys(nextEncounters)) if (nextEncounters[eid].campaignId === id) delete nextEncounters[eid]
      return { ...prev, campaigns: nextCampaigns, encounters: nextEncounters }
    })
    if (validActiveCampaignId === id) {
      const remaining = Object.keys(campaigns).filter(k => k !== id)
      setActiveCampaignId(remaining[0] ?? null)
    }
    try { await api.deleteCampaign(id) } catch (err) { console.error('deleteCampaign', err) }
    return { ok: true }
  }, [campaigns, setActiveCampaignId, setState, validActiveCampaignId])

  const party = activeCampaign?.party ?? emptyParty()
  const setParty = useCallback((next: ReturnType<typeof emptyParty>) => {
    if (!activeCampaign) return
    void upsertCampaign({ ...activeCampaign, party: next, updatedAt: new Date().toISOString() })
  }, [activeCampaign, upsertCampaign])

  const upsertEncounter = useCallback(async (e: Encounter) => {
    setState(prev => ({ ...prev, encounters: { ...(prev.encounters ?? {}), [e.id]: e } }))
    try { await api.putEncounter(e) } catch (err) { console.error('putEncounter', err) }
  }, [setState])

  const deleteEncounter = useCallback(async (id: string) => {
    setState(prev => { const n = { ...(prev.encounters ?? {}) }; delete n[id]; return { ...prev, encounters: n } })
    try { await api.deleteEncounter(id) } catch (err) { console.error('deleteEncounter', err) }
  }, [setState])

  const upsertSession = useCallback(async (s: CombatSession) => {
    setState(prev => ({ ...prev, sessions: { ...(prev.sessions ?? {}), [s.id]: s } }))
    try { await api.putSession(s) } catch (err) { console.error('putSession', err) }
  }, [setState])

  const deleteSession = useCallback(async (id: string) => {
    setState(prev => { const n = { ...(prev.sessions ?? {}) }; delete n[id]; return { ...prev, sessions: n } })
    if (activeSessionId === id) setActiveSessionId(null)
    try { await api.deleteSession(id) } catch (err) { console.error('deleteSession', err) }
  }, [activeSessionId, setState])

  const upsertCustomMonster = useCallback(async (m: Monster) => {
    setState(prev => ({ ...prev, customMonsters: { ...(prev.customMonsters ?? {}), [m.slug]: m } }))
    try { await api.putCustomMonster(m) } catch (err) { console.error('putCustomMonster', err) }
  }, [setState])
  const deleteCustomMonster = useCallback(async (slug: string) => {
    setState(prev => { const n = { ...(prev.customMonsters ?? {}) }; delete n[slug]; return { ...prev, customMonsters: n } })
    try { await api.deleteCustomMonster(slug) } catch (err) { console.error('deleteCustomMonster', err) }
  }, [setState])
  const bulkImportMonsters = useCallback(async (list: Monster[]) => {
    const result = await api.bulkImportMonsters(list)
    const fresh = await api.listCustomMonsters()
    setState(prev => ({ ...prev, customMonsters: toRecord(fresh, 'slug') }))
    return result
  }, [setState])
  const wipeCustomMonsters = useCallback(async () => {
    const result = await api.wipeCustomMonsters()
    setState(prev => ({ ...prev, customMonsters: {} }))
    return result
  }, [setState])

  const deleteCustomSpell = useCallback(async (slug: string) => {
    setState(prev => { const n = { ...(prev.customSpells ?? {}) }; delete n[slug]; return { ...prev, customSpells: n } })
    try { await api.deleteCustomSpell(slug) } catch (err) { console.error('deleteCustomSpell', err) }
  }, [setState])
  const bulkImportSpells = useCallback(async (list: Spell[]) => {
    const result = await api.bulkImportSpells(list)
    const fresh = await api.listCustomSpells()
    setState(prev => ({ ...prev, customSpells: toRecord(fresh, 'slug') }))
    return result
  }, [setState])
  const wipeCustomSpells = useCallback(async () => {
    const result = await api.wipeCustomSpells()
    setState(prev => ({ ...prev, customSpells: {} }))
    return result
  }, [setState])

  const upsertCharacter = useCallback(async (c: CharacterSheet) => {
    setState(prev => ({ ...prev, characters: { ...(prev.characters ?? {}), [c.id]: c } }))
    try { await api.putCharacter(c) } catch (err) { console.error('putCharacter', err) }
  }, [setState])
  const deleteCharacter = useCallback(async (id: string) => {
    setState(prev => { const n = { ...(prev.characters ?? {}) }; delete n[id]; return { ...prev, characters: n } })
    try { await api.deleteCharacter(id) } catch (err) { console.error('deleteCharacter', err) }
  }, [setState])

  const bulkImportRuleElements = useCallback(async (list: RuleElement[]) => {
    const result = await api.bulkImportRuleElements(list)
    const fresh = await api.listCustomRuleElements()
    setState(prev => ({ ...prev, customRuleElements: toRecord(fresh, 'slug') }))
    return result
  }, [setState])
  const wipeCustomRuleElements = useCallback(async () => {
    const result = await api.wipeCustomRuleElements()
    setState(prev => ({ ...prev, customRuleElements: {} }))
    return result
  }, [setState])

  const resetDraft = useCallback((campaignId?: string) => {
    const d = newDraft(campaignId ?? validActiveCampaignId ?? '')
    setEncounterDraft(d)
    return d
  }, [validActiveCampaignId])

  const exportAll = useCallback(async () => {
    const exported = await api.exportAll()
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
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
    const fresh = await queryClient.fetchQuery({ queryKey: combatQueryKey, queryFn: api.getState })
    const ids = Object.keys(fresh.campaigns ?? {})
    setActiveCampaignId(ids[0] ?? null)
  }, [queryClient, setActiveCampaignId])

  const value = useMemo<CombatContextType>(() => ({
    loaded: !isLoading,
    loadError: error instanceof Error ? error.message : null,
    campaigns, activeCampaignId: validActiveCampaignId, setActiveCampaignId, activeCampaign,
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
    isLoading, error, campaigns, validActiveCampaignId, setActiveCampaignId, activeCampaign,
    upsertCampaign, deleteCampaign, party, setParty, encounters, upsertEncounter, deleteEncounter,
    sessions, upsertSession, deleteSession, customMonsters, upsertCustomMonster, deleteCustomMonster,
    bulkImportMonsters, wipeCustomMonsters, customSpells, deleteCustomSpell, bulkImportSpells,
    wipeCustomSpells, characters, upsertCharacter, deleteCharacter, customRuleElements,
    bulkImportRuleElements, wipeCustomRuleElements, encounterDraft, resetDraft, activeSessionId,
    exportAll, importAll,
  ])

  return <CombatContext.Provider value={value}>{children}</CombatContext.Provider>
}
