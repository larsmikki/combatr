// Server-side mirror of client/src/types — only the persisted shapes.
// We treat encounters, sessions, campaigns, monsters, and spells as opaque records;
// the client owns the schema. Server only enforces id/slug presence.

export interface Party {
  generic: Array<{ level: number; count: number }>
  characters: Array<{
    id: string; name: string; level: number;
    maxHp: number; currentHp: number;
    armorClass: number; initiativeBonus: number;
    notes?: string
  }>
}

export type EncounterRecord = { id: string; campaignId?: string } & Record<string, unknown>
export type SessionRecord   = { id: string } & Record<string, unknown>
export type MonsterRecord   = { slug: string } & Record<string, unknown>
export type SpellRecord     = { slug: string } & Record<string, unknown>
export type CampaignRecord  = { id: string } & Record<string, unknown>
export type CharacterRecord = { id: string; campaignId?: string } & Record<string, unknown>
export type RuleElementRecord = { slug: string; kind?: string } & Record<string, unknown>

export interface PersistedState {
  campaigns: Record<string, CampaignRecord>
  encounters: Record<string, EncounterRecord>
  sessions: Record<string, SessionRecord>
  customMonsters: Record<string, MonsterRecord>
  customSpells: Record<string, SpellRecord>
  characters: Record<string, CharacterRecord>
  customRuleElements: Record<string, RuleElementRecord>
  // Legacy: pre-Campaign data had a top-level `party`. Kept here only so a
  // migration can read it on first load; never written by current code.
  party?: Party
}
