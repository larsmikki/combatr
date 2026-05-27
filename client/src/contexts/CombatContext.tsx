import { createContext, useContext } from 'react'
import type { Campaign, CharacterSheet, CombatSession, Encounter, Monster, Party, RuleElement, Spell } from '@/types'

export interface CombatContextType {
  loaded: boolean
  loadError: string | null
  campaigns: Record<string, Campaign>
  activeCampaignId: string | null
  setActiveCampaignId: (id: string | null) => void
  activeCampaign: Campaign | null
  upsertCampaign: (c: Campaign) => Promise<void>
  deleteCampaign: (id: string) => Promise<{ ok: boolean; reason?: string }>
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

export const uid = () => Math.random().toString(36).slice(2, 10)

export const emptyParty = (): Party => ({ generic: [{ level: 3, count: 4 }], characters: [] })

export const newDraft = (campaignId: string): Encounter => ({
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

export const combatQueryKey = ['combat-state'] as const

export const CombatContext = createContext<CombatContextType | null>(null)

export const useCombat = () => {
  const ctx = useContext(CombatContext)
  if (!ctx) throw new Error('useCombat must be used inside CombatProvider')
  return ctx
}
