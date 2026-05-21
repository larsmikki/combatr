import { readFileSync, existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join, isAbsolute } from 'path'
import { config } from '../config.js'
import { logger } from '../logger.js'
import type {
  PersistedState, EncounterRecord, SessionRecord, MonsterRecord, SpellRecord,
  CampaignRecord, Party, CharacterRecord, RuleElementRecord,
} from '../types.js'

function resolvePath(p: string) { return isAbsolute(p) ? p : join(process.cwd(), p) }

function newId(): string { return Math.random().toString(36).slice(2, 10) }

function defaultParty(): Party {
  return { generic: [{ level: 3, count: 4 }], characters: [] }
}

function defaultCampaign(party: Party = defaultParty()): CampaignRecord {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: 'My Campaign',
    description: '',
    notes: '',
    party,
    monsterNotes: {},
    createdAt: now,
    updatedAt: now,
  }
}

function defaultState(): PersistedState {
  const campaign = defaultCampaign()
  return {
    campaigns: { [campaign.id]: campaign },
    encounters: {},
    sessions: {},
    customMonsters: {},
    customSpells: {},
    characters: {},
    customRuleElements: {},
  }
}

// Migrate legacy state: previously party lived at the top level and there were
// no campaigns. Wrap into a default campaign owning that party, and stamp every
// encounter with its campaignId.
function migrate(raw: Partial<PersistedState>): PersistedState {
  const hasCampaigns = raw.campaigns && Object.keys(raw.campaigns).length > 0
  if (hasCampaigns) {
    // Newer shape — still backfill missing campaignId on encounters by picking
    // any campaign (defensive; shouldn't happen if the client behaves).
    const fallbackId = Object.keys(raw.campaigns!)[0]
    const encounters = { ...(raw.encounters ?? {}) }
    for (const id of Object.keys(encounters)) {
      const e = encounters[id]
      if (!e.campaignId && fallbackId) encounters[id] = { ...e, campaignId: fallbackId }
    }
    return {
      campaigns: raw.campaigns!,
      encounters,
      sessions: raw.sessions ?? {},
      customMonsters: raw.customMonsters ?? {},
      customSpells: raw.customSpells ?? {},
      characters: raw.characters ?? {},
      customRuleElements: raw.customRuleElements ?? {},
    }
  }
  const party = raw.party ?? defaultParty()
  const camp = defaultCampaign(party)
  const encounters: Record<string, EncounterRecord> = {}
  for (const [id, e] of Object.entries(raw.encounters ?? {})) {
    encounters[id] = { ...e, campaignId: camp.id }
  }
  logger.info('storage.migrate legacy → campaigns', { campaignId: camp.id, encounters: Object.keys(encounters).length })
  return {
    campaigns: { [camp.id]: camp },
    encounters,
    sessions: raw.sessions ?? {},
    customMonsters: raw.customMonsters ?? {},
    customSpells: raw.customSpells ?? {},
    characters: raw.characters ?? {},
    customRuleElements: raw.customRuleElements ?? {},
  }
}

export interface Storage {
  getState(): PersistedState

  listCampaigns(): CampaignRecord[]
  getCampaign(id: string): CampaignRecord | null
  putCampaign(r: CampaignRecord): CampaignRecord
  deleteCampaign(id: string): boolean

  listEncounters(): EncounterRecord[]
  getEncounter(id: string): EncounterRecord | null
  putEncounter(r: EncounterRecord): EncounterRecord
  deleteEncounter(id: string): boolean

  listSessions(): SessionRecord[]
  getSession(id: string): SessionRecord | null
  putSession(r: SessionRecord): SessionRecord
  deleteSession(id: string): boolean

  listCustomMonsters(): MonsterRecord[]
  getCustomMonster(slug: string): MonsterRecord | null
  putCustomMonster(r: MonsterRecord): MonsterRecord
  deleteCustomMonster(slug: string): boolean
  putCustomMonstersBulk(rs: MonsterRecord[]): { imported: number; skipped: number }
  wipeCustomMonsters(): { wiped: number }

  listCustomSpells(): SpellRecord[]
  getCustomSpell(slug: string): SpellRecord | null
  putCustomSpell(r: SpellRecord): SpellRecord
  deleteCustomSpell(slug: string): boolean
  putCustomSpellsBulk(rs: SpellRecord[]): { imported: number; skipped: number }
  wipeCustomSpells(): { wiped: number }

  listCharacters(): CharacterRecord[]
  getCharacter(id: string): CharacterRecord | null
  putCharacter(r: CharacterRecord): CharacterRecord
  deleteCharacter(id: string): boolean

  listCustomRuleElements(): RuleElementRecord[]
  getCustomRuleElement(slug: string): RuleElementRecord | null
  putCustomRuleElement(r: RuleElementRecord): RuleElementRecord
  deleteCustomRuleElement(slug: string): boolean
  putCustomRuleElementsBulk(rs: RuleElementRecord[]): { imported: number; skipped: number }
  wipeCustomRuleElements(): { wiped: number }

  importAll(s: PersistedState): void
}

export function createStorage(): Storage {
  const filePath = resolvePath(config.dataFile)
  let state: PersistedState = defaultState()

  let needsPersist = false
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf-8').trim()
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>
        state = migrate(parsed)
        // If the on-disk shape was legacy (no `campaigns` key), persist the
        // migrated state immediately so the freshly-minted campaign id is
        // stable across server restarts. Without this, every restart re-mints
        // a new id and the user's campaign appears to vanish.
        if (!parsed.campaigns || Object.keys(parsed.campaigns).length === 0) {
          needsPersist = true
          logger.info('storage migrated legacy file; will persist on first save')
        }
      }
    }
  } catch (e) {
    logger.error('Failed to read data file', { error: String(e) })
  }

  let writeQueue: Promise<void> = Promise.resolve()
  function save(): void {
    const snapshot = JSON.stringify(state, null, 2)
    writeQueue = writeQueue.then(() =>
      writeFile(filePath, snapshot, 'utf-8').catch(err =>
        logger.error('Failed to save data', { error: String(err) })
      ),
    )
  }

  if (needsPersist) save()

  return {
    getState: () => state,

    listCampaigns: () => Object.values(state.campaigns),
    getCampaign:   (id) => state.campaigns[id] ?? null,
    putCampaign:   (r) => { state.campaigns[r.id] = r; save(); return r },
    deleteCampaign: (id) => {
      if (!state.campaigns[id]) return false
      if (Object.keys(state.campaigns).length <= 1) return false  // can't delete last
      delete state.campaigns[id]
      // Orphan-clean: remove encounters that belonged to it.
      for (const eid of Object.keys(state.encounters)) {
        if (state.encounters[eid].campaignId === id) delete state.encounters[eid]
      }
      for (const cid of Object.keys(state.characters)) {
        if (state.characters[cid].campaignId === id) delete state.characters[cid]
      }
      save(); return true
    },

    listEncounters: () => Object.values(state.encounters),
    getEncounter:   (id) => state.encounters[id] ?? null,
    putEncounter:   (r) => { state.encounters[r.id] = r; save(); return r },
    deleteEncounter: (id) => { if (!state.encounters[id]) return false; delete state.encounters[id]; save(); return true },

    listSessions: () => Object.values(state.sessions),
    getSession:   (id) => state.sessions[id] ?? null,
    putSession:   (r) => { state.sessions[r.id] = r; save(); return r },
    deleteSession: (id) => { if (!state.sessions[id]) return false; delete state.sessions[id]; save(); return true },

    listCustomMonsters: () => Object.values(state.customMonsters),
    getCustomMonster:   (slug) => state.customMonsters[slug] ?? null,
    putCustomMonster:   (r) => { state.customMonsters[r.slug] = r; save(); return r },
    deleteCustomMonster: (slug) => {
      if (!state.customMonsters[slug]) return false
      delete state.customMonsters[slug]; save(); return true
    },
    putCustomMonstersBulk: (rs) => {
      let imported = 0, skipped = 0
      for (const r of rs) {
        if (!r || typeof r.slug !== 'string' || !r.slug) { skipped++; continue }
        state.customMonsters[r.slug] = r; imported++
      }
      if (imported > 0) save()
      return { imported, skipped }
    },
    wipeCustomMonsters: () => {
      const wiped = Object.keys(state.customMonsters).length
      state.customMonsters = {}
      if (wiped > 0) save()
      return { wiped }
    },

    listCustomSpells: () => Object.values(state.customSpells),
    getCustomSpell:   (slug) => state.customSpells[slug] ?? null,
    putCustomSpell:   (r) => { state.customSpells[r.slug] = r; save(); return r },
    deleteCustomSpell: (slug) => {
      if (!state.customSpells[slug]) return false
      delete state.customSpells[slug]; save(); return true
    },
    putCustomSpellsBulk: (rs) => {
      let imported = 0, skipped = 0
      for (const r of rs) {
        if (!r || typeof r.slug !== 'string' || !r.slug) { skipped++; continue }
        state.customSpells[r.slug] = r; imported++
      }
      if (imported > 0) save()
      return { imported, skipped }
    },
    wipeCustomSpells: () => {
      const wiped = Object.keys(state.customSpells).length
      state.customSpells = {}
      if (wiped > 0) save()
      return { wiped }
    },

    listCharacters: () => Object.values(state.characters),
    getCharacter:   (id) => state.characters[id] ?? null,
    putCharacter:   (r) => { state.characters[r.id] = r; save(); return r },
    deleteCharacter: (id) => {
      if (!state.characters[id]) return false
      delete state.characters[id]; save(); return true
    },

    listCustomRuleElements: () => Object.values(state.customRuleElements),
    getCustomRuleElement:   (slug) => state.customRuleElements[slug] ?? null,
    putCustomRuleElement:   (r) => { state.customRuleElements[r.slug] = r; save(); return r },
    deleteCustomRuleElement: (slug) => {
      if (!state.customRuleElements[slug]) return false
      delete state.customRuleElements[slug]; save(); return true
    },
    putCustomRuleElementsBulk: (rs) => {
      let imported = 0, skipped = 0
      for (const r of rs) {
        if (!r || typeof r.slug !== 'string' || !r.slug) { skipped++; continue }
        state.customRuleElements[r.slug] = r; imported++
      }
      if (imported > 0) save()
      return { imported, skipped }
    },
    wipeCustomRuleElements: () => {
      const wiped = Object.keys(state.customRuleElements).length
      state.customRuleElements = {}
      if (wiped > 0) save()
      return { wiped }
    },

    importAll: (s) => { state = migrate(s); save() },
  }
}

export const storage = createStorage()
