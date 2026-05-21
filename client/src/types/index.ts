// Combatr — shared TypeScript types for monsters, encounters, and combat state.
// Aligned with the schema in CONCEPT.md but trimmed to what MVP actually uses.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type Skill = string
export type DamageType = string
export type ConditionType = string

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'
export type Disposition = 'enemy' | 'ally' | 'neutral'
export type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly' | 'absurd'

export interface AbilityScores { str: number; dex: number; con: number; int: number; wis: number; cha: number }
export interface MovementSpeeds { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number }

export interface ArmorClassEntry { value: number; type?: string; condition?: string }
export interface HitPointBlock { average: number; formula: string }
export interface SenseEntry { type: string; value: number }

export interface DamagePart { formula: string; damageType: DamageType }
export interface RechargeRule { type: 'recharge'; values: number[] }

export interface StatBlockFeature {
  name: string
  description: string
  attackBonus?: number
  damageParts?: DamagePart[]
  saveDc?: number
  saveAbility?: Ability
  recharge?: RechargeRule
  cost?: number
}

export interface SpellcastingBlock {
  ability: Ability
  saveDc?: number
  attackBonus?: number
  level?: number
  className?: string
  description?: string
  atWill?: string[]
  perDay?: Array<{ slots: number; spells: string[] }>
  spellSlots?: Array<{ level: number; slots: number; spells: string[] }>
}

export interface GearItem {
  name: string
  notes?: string
  attuned?: boolean
}

export interface LairBlock {
  description?: string
  initiative?: number
  actions?: StatBlockFeature[]
  regionalEffects?: StatBlockFeature[]
  regionalEffectsEndText?: string
}

export type ContentSource =
  | 'SRD_5_1_CC'
  | 'SRD_5_2_CC'
  | 'USER_HOMEBREW'
  | 'LICENSED_OFFICIAL'
  | 'THIRD_PARTY_OPEN_LICENSE'
  | 'PRIVATE_IMPORT'

export interface SourceMetadata {
  sourceId: string
  sourceName: string
  sourceType: ContentSource
  licenseName?: string
  licenseUrl?: string
  attributionText?: string
  isRedistributable: boolean
}

export interface Monster {
  slug: string
  name: string
  size: CreatureSize
  type: string
  subtype?: string
  alignment?: string
  armorClass: ArmorClassEntry[]
  hitPoints: HitPointBlock
  speed: MovementSpeeds
  abilityScores: AbilityScores
  savingThrows?: Partial<Record<Ability, number>>
  skills?: Partial<Record<Skill, number>>
  damageVulnerabilities?: DamageType[]
  damageResistances?: DamageType[]
  damageImmunities?: DamageType[]
  conditionImmunities?: ConditionType[]
  senses: SenseEntry[]
  languages: string[]
  challengeRating: string
  xp: number
  traits: StatBlockFeature[]
  actions: StatBlockFeature[]
  bonusActions?: StatBlockFeature[]
  reactions?: StatBlockFeature[]
  legendaryActions?: { actionsPerRound: number; description?: string; options: StatBlockFeature[] }
  mythicActions?: { description?: string; options: StatBlockFeature[] }
  lair?: LairBlock
  spellcasting?: SpellcastingBlock
  gear?: GearItem[]
  role?: string
  tags?: string[]
  description?: string
  source: SourceMetadata
}

export interface ConditionDef { id: string; name: string; text: string }

export interface MagicItem {
  slug: string
  name: string
  type: string
  rarity: string
  requiresAttunement: boolean
  attunementText?: string
  description: string
  magic: boolean
  source: SourceMetadata
}

export interface Spell {
  slug: string
  name: string
  level: number
  school: string
  castingTime: string
  range: string
  components: string
  material?: string
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  higherLevel?: string
  classes: string[]
  source: SourceMetadata
}

// Character rules/content. Character sheets store user choices and live state;
// derived combat/math values are produced by the rules engine.
export type RuleElementKind =
  | 'class' | 'subclass' | 'race' | 'background' | 'feat'
  | 'classFeature' | 'subclassFeature' | 'item' | 'spell' | 'optionalFeature'

export type Grant =
  | { type: 'ability'; ability: Ability; value: number }
  | { type: 'proficiency'; target: 'skill' | 'save' | 'armor' | 'weapon' | 'tool'; value: string }
  | { type: 'expertise'; skill: string }
  | { type: 'speed'; mode: keyof MovementSpeeds; value: number }
  | { type: 'language'; value: string }
  | { type: 'spell'; spellSlug: string }
  | { type: 'resource'; resourceId: string; name: string; maxFormula: string; reset: 'shortRest' | 'longRest' | 'dawn' | 'manual' }

export interface RuleChoice {
  id: string
  label: string
  choose: number
  options: Array<{ id: string; label: string; grants?: Grant[] }>
  requiredAtLevel?: number
}

export interface RuleRequirement {
  type: 'level' | 'class' | 'subclass' | 'ability' | 'proficiency'
  value: string | number
}

export interface RuleElement {
  slug: string
  name: string
  kind: RuleElementKind
  source: SourceMetadata
  className?: string
  classSource?: string
  subclassName?: string
  subclassSource?: string
  level?: number
  hitDie?: number
  spellcastingAbility?: Ability
  subclassLevel?: number
  entries: string
  grants?: Grant[]
  choices?: RuleChoice[]
  requirements?: RuleRequirement[]
  refs?: string[]
}

export interface CharacterLevelEntry {
  id: string
  classSlug: string
  level: number
  hpMode: 'average' | 'rolled' | 'manual'
  hpValue: number
}

export interface CharacterClassProgression {
  classSlug: string
  subclassSlug?: string
  levels: number
}

export interface CharacterChoiceSelection {
  choiceId: string
  selectedOptionIds: string[]
}

export interface CharacterInventoryItem {
  id: string
  itemSlug?: string
  name: string
  quantity: number
  equipped?: boolean
  attuned?: boolean
  notes?: string
}

export interface CharacterResourceState {
  resourceId: string
  used: number
}

export interface CharacterSheet {
  id: string
  campaignId: string
  name: string
  ancestrySlug?: string
  backgroundSlug?: string
  gender?: '' | 'male' | 'female'
  portraitUrl?: string
  classes: CharacterClassProgression[]
  levelHistory: CharacterLevelEntry[]
  abilityScoreMode: 'standard-array' | 'point-buy' | 'rolled' | 'manual'
  abilityIncreaseMode?: 'fixed' | 'flexible'
  abilityScores: AbilityScores
  flexibleAbilityBonuses?: Partial<Record<Ability, number>>
  choices: CharacterChoiceSelection[]
  inventory: CharacterInventoryItem[]
  knownSpells: string[]
  preparedSpells: string[]
  currentHp: number
  tempHp: number
  deathSaves?: DeathSaveState
  resources?: CharacterResourceState[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CharacterAttack {
  name: string
  attackBonus: number
  damage: string
  notes?: string
}

export interface CharacterSpellcasting {
  classSlug: string
  ability: Ability
  saveDc: number
  attackBonus: number
  slots: Array<{ level: number; max: number; used: number }>
}

export interface DerivedCharacter {
  id: string
  name: string
  level: number
  proficiencyBonus: number
  abilityMods: AbilityScores
  maxHp: number
  currentHp: number
  tempHp: number
  armorClass: number
  initiativeBonus: number
  speed: MovementSpeeds
  savingThrows: Partial<Record<Ability, number>>
  skills: Record<string, number>
  passivePerception: number
  attacks: CharacterAttack[]
  spellcasting: CharacterSpellcasting[]
  features: RuleElement[]
  unresolvedChoices: RuleChoice[]
  warnings: string[]
}

// Party
export interface GenericPartyMember { level: number; count: number }
export interface NamedCharacter {
  id: string
  name: string
  level: number
  maxHp: number
  currentHp: number
  armorClass: number
  initiativeBonus: number
  notes?: string
}
export interface Party {
  generic: GenericPartyMember[]
  characters: NamedCharacter[]
}

// Encounter
// A boss form / phase reference. When a group has 2+ forms, defeating one
// transforms the combatant into the next instead of marking it defeated.
export interface FormRef {
  monsterSlug: string
  monsterName: string
  cr: string
  xp: number
  displayName?: string
}
export interface EncounterMonsterGroup {
  id: string
  monsterSlug: string
  monsterName: string
  cr: string
  xp: number
  quantity: number
  initiativeMode: 'grouped' | 'individual'
  hpMode: 'average' | 'rolled'
  startingHidden: boolean
  startingDisposition: Disposition
  customName?: string
  // Optional multi-phase boss support. forms[0] mirrors the group's primary
  // monsterSlug; forms[1..N] are subsequent phases. Length <= 1 (or undefined)
  // means no transformation. group.xp is kept in sync with the sum of form XP.
  forms?: FormRef[]
}
export interface ManualEncounterEntry {
  id: string
  name: string
  initiative?: number
  recurring: boolean
  visibleToPlayers: boolean
  notes?: string
}
export interface EncounterDifficultyResult {
  totalMonsterXp: number
  adjustedXp: number
  monsterCountMultiplier: number
  partyThresholds: { easy: number; medium: number; hard: number; deadly: number }
  difficulty: Difficulty
  partySizeAdjustment: string
}
export interface Encounter {
  id: string
  campaignId: string
  name: string
  description?: string
  environment?: string
  dmNotes?: string
  groups: EncounterMonsterGroup[]
  manualEntries: ManualEncounterEntry[]
  partySnapshot?: Party
  difficulty?: EncounterDifficultyResult | null
  status: 'draft' | 'ready' | 'completed' | 'archived'
  createdAt: string
  updatedAt: string
}

// Campaign — top-level container for Party, Encounters, and free-form notes.
// A campaign owns its party (so different campaigns can have different parties)
// and a per-monster-slug notes map for NPC/creature notes that follow into combat.
export interface CampaignSessionNote {
  id: string
  date: string  // ISO YYYY-MM-DD
  notes: string
}
export interface Campaign {
  id: string
  name: string
  description?: string
  notes: string
  party: Party
  monsterNotes: Record<string, string>
  sessionLog?: CampaignSessionNote[]
  createdAt: string
  updatedAt: string
}

// Combat
export interface ActiveCondition {
  id: string
  conditionType: ConditionType
  appliedAtRound: number
  notes?: string
}
export interface DeathSaveState { successes: number; failures: number }
export interface DiceRollResult {
  expression: string
  total: number
  parts: Array<{ expr: string; rolls?: number[]; kept?: number[]; sum?: number; constant?: number }>
}
export interface Combatant {
  id: string
  type: 'character' | 'monster' | 'npc' | 'manual'
  sourceEntityId?: string
  monsterSlug?: string
  displayName: string
  initiative: number | null
  initiativeBonus: number
  initiativeRoll: DiceRollResult | null
  armorClass: number | null
  maxHp: number | null
  currentHp: number | null
  tempHp: number
  isVisibleToPlayers: boolean
  isDefeated: boolean
  disposition: Disposition
  conditions: ActiveCondition[]
  deathSaves: DeathSaveState | null
  notes?: string
  // Multi-phase boss support. When formChain has 2+ entries, dropping the
  // combatant to 0 HP advances currentFormIndex and re-stats them from the next
  // form's monster instead of marking them defeated. Final form dies normally.
  formChain?: FormRef[]
  currentFormIndex?: number
  // Carry the encounter group's hpMode onto the combatant so transformations
  // pick the same roll/average behavior that built the starting form.
  hpMode?: 'average' | 'rolled'
}
export type CombatEventType =
  | 'combat_started' | 'round_started' | 'turn_started'
  | 'damage_applied' | 'healing_applied' | 'temp_hp_applied'
  | 'condition_added' | 'condition_removed'
  | 'combatant_defeated' | 'combatant_added' | 'combatant_removed'
  | 'combatant_transformed'
  | 'dice_rolled' | 'note_added' | 'combat_ended'
export interface CombatEvent {
  id: string
  type: CombatEventType
  combatantId?: string
  round?: number
  payload: Record<string, unknown>
  createdAt: string
}
export interface CombatSession {
  id: string
  encounterId: string
  encounterName: string
  status: 'initiative_setup' | 'running' | 'paused' | 'completed'
  roundNumber: number
  activeTurnIndex: number
  combatants: Combatant[]
  eventLog: CombatEvent[]
  selectedCombatantId: string | null
  startedAt: string
  completedAt?: string
  updatedAt: string
}
