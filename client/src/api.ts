import type { Campaign, CharacterSheet, CombatSession, Encounter, Monster, Party, RuleElement, Spell } from '@/types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface AppState {
  campaigns: Record<string, Campaign>
  encounters: Record<string, Encounter>
  sessions: Record<string, CombatSession>
  customMonsters: Record<string, Monster>
  customSpells: Record<string, Spell>
  characters: Record<string, CharacterSheet>
  customRuleElements: Record<string, RuleElement>
  // Legacy: pre-Campaign data had top-level party. Server migration handles it.
  party?: Party
}

export const api = {
  health:      () => req<{ status: string }>('/api/health'),
  getState:    () => req<AppState>('/api/state'),

  listCampaigns: () => req<Campaign[]>('/api/campaigns'),
  putCampaign:   (c: Campaign) => req<Campaign>(`/api/campaigns/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }),
  deleteCampaign: (id: string) => req<void>(`/api/campaigns/${id}`, { method: 'DELETE' }),

  listEncounters:  () => req<Encounter[]>('/api/encounters'),
  putEncounter:    (e: Encounter) => req<Encounter>(`/api/encounters/${e.id}`, { method: 'PUT', body: JSON.stringify(e) }),
  deleteEncounter: (id: string) => req<void>(`/api/encounters/${id}`, { method: 'DELETE' }),

  listSessions:  () => req<CombatSession[]>('/api/sessions'),
  putSession:    (s: CombatSession) => req<CombatSession>(`/api/sessions/${s.id}`, { method: 'PUT', body: JSON.stringify(s) }),
  deleteSession: (id: string) => req<void>(`/api/sessions/${id}`, { method: 'DELETE' }),

  listCustomMonsters:  () => req<Monster[]>('/api/monsters'),
  putCustomMonster:    (m: Monster) => req<Monster>(`/api/monsters/${m.slug}`, { method: 'PUT', body: JSON.stringify(m) }),
  deleteCustomMonster: (slug: string) => req<void>(`/api/monsters/${slug}`, { method: 'DELETE' }),
  bulkImportMonsters:  (list: Monster[]) =>
    req<{ imported: number; skipped: number }>('/api/monsters/bulk', { method: 'POST', body: JSON.stringify(list) }),
  wipeCustomMonsters:  () => req<{ wiped: number }>('/api/monsters', { method: 'DELETE' }),

  listCustomSpells:    () => req<Spell[]>('/api/spells'),
  putCustomSpell:      (s: Spell) => req<Spell>(`/api/spells/${s.slug}`, { method: 'PUT', body: JSON.stringify(s) }),
  deleteCustomSpell:   (slug: string) => req<void>(`/api/spells/${slug}`, { method: 'DELETE' }),
  bulkImportSpells:    (list: Spell[]) =>
    req<{ imported: number; skipped: number }>('/api/spells/bulk', { method: 'POST', body: JSON.stringify(list) }),
  wipeCustomSpells:    () => req<{ wiped: number }>('/api/spells', { method: 'DELETE' }),

  listCharacters:  () => req<CharacterSheet[]>('/api/characters'),
  putCharacter:    (c: CharacterSheet) => req<CharacterSheet>(`/api/characters/${c.id}`, { method: 'PUT', body: JSON.stringify(c) }),
  deleteCharacter: (id: string) => req<void>(`/api/characters/${id}`, { method: 'DELETE' }),

  listCustomRuleElements: () => req<RuleElement[]>('/api/rules'),
  putCustomRuleElement:   (r: RuleElement) => req<RuleElement>(`/api/rules/${r.slug}`, { method: 'PUT', body: JSON.stringify(r) }),
  bulkImportRuleElements: (list: RuleElement[]) =>
    req<{ imported: number; skipped: number }>('/api/rules/bulk', { method: 'POST', body: JSON.stringify(list) }),
  wipeCustomRuleElements: () => req<{ wiped: number }>('/api/rules', { method: 'DELETE' }),

  exportAll: () => req<AppState>('/api/export'),
  importAll: (s: AppState) => req<{ ok: boolean }>('/api/import', { method: 'POST', body: JSON.stringify(s) }),
}
