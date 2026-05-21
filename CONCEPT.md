Below is an implementation-ready specification for an AI/software agent to build a **D&D 5e-style encounter builder and combat tracker** similar to D&D Beyond Encounters/Maps.

Important scope note: the app should **not ship with copied Monster Manual stat blocks unless the developer has a license** from Wizards of the Coast. It can ship with monsters/rules from the **SRD 5.1 / SRD 5.2 Creative Commons releases**, and it can allow users to privately import their own legally owned data. Wizards states that SRD 5.1 was released under Creative Commons to provide irrevocable creator certainty, and the newer SRD v5.2.1 is also available on D&D Beyond. ([D&D Beyond][1]) The Monster Manual as a whole includes proprietary monsters and text not fully included in the SRD.

# Specification: 5e Encounter Builder and Combat Tracker

## 1. Product goal

Build a web-based encounter planning and combat-running tool for D&D 5e-compatible games.

The tool should allow a Dungeon Master to:

Create parties.

Create or import monsters.

Build encounters.

Estimate encounter difficulty.

Start combat.

Roll and manage initiative.

Track rounds, turns, HP, temporary HP, damage, healing, conditions, death saves, concentration, lair actions, legendary actions, and reminders.

View monster stat blocks during play.

Save, pause, resume, duplicate, archive, and export encounters.

Optionally connect combatants to a map/token layer.

The experience should support both:

**Theater-of-the-mind mode** — initiative and stat tracking only.

**Map mode** — tokens on a grid connected to the combat tracker.

D&D Beyond’s own Encounters tool combines encounter building and combat tracking, while its Maps combat encounter system can populate combat from tokens, manage initiative, hide creatures from players, and allow adding/removing creatures during combat. ([D&D Beyond][2])

## 2. Legal and content model

### 2.1 Allowed bundled content

The application may bundle:

SRD 5.1 content under Creative Commons Attribution 4.0.

SRD 5.2.1 content under Creative Commons Attribution 4.0, if targeting the 2024 rules.

User-created homebrew monsters.

Original monsters created by the developer.

Open-licensed third-party monsters, provided their license terms are respected.

### 2.2 Not allowed by default

Do not bundle the complete Monster Manual stat blocks unless the developer has an explicit license.

Do not include proprietary D&D monsters that are not in the SRD, such as beholders, mind flayers/illithids, displacer beasts, carrion crawlers, yuan-ti, or other Product Identity/proprietary creatures unless licensed.

Do not copy D&D Beyond UI, logos, trade dress, or exact proprietary text.

### 2.3 Recommended data architecture

Use a **content-source abstraction**:

```ts
type ContentSource =
  | "SRD_5_1_CC"
  | "SRD_5_2_CC"
  | "USER_HOMEBREW"
  | "LICENSED_OFFICIAL"
  | "THIRD_PARTY_OPEN_LICENSE"
  | "PRIVATE_IMPORT";
```

Every rule element, monster, spell, item, and condition should include:

```ts
interface SourceMetadata {
  sourceId: string;
  sourceName: string;
  sourceType: ContentSource;
  licenseName?: string;
  licenseUrl?: string;
  attributionText?: string;
  copyrightNotice?: string;
  isRedistributable: boolean;
  importedByUserId?: string;
}
```

### 2.4 Private import mode

The tool may support user-private imports:

CSV

JSON

Markdown

Foundry-style JSON

Manual entry

PDF-derived manual entry, but avoid automated scraping of copyrighted books unless the user has rights and the app’s jurisdiction/legal review permits it.

Imported proprietary content should be marked:

```ts
isRedistributable: false
scope: "private-user-content"
```

It must not be published to a public compendium or shared marketplace.

## 3. Main user roles

### 3.1 Dungeon Master

Can create campaigns, parties, monsters, encounters, maps, tokens, and sessions.

Can see all hidden monsters and private notes.

Can modify HP, conditions, initiative, token visibility, and encounter state.

### 3.2 Player

Can see assigned character data.

Can roll initiative, attacks, saves, checks, and damage if the app supports character sheets.

Can see player-facing initiative order, but not hidden monsters.

Can see only revealed tokens and public combat notes.

### 3.3 Admin / Content Manager

Can import, validate, publish, or deprecate content packs.

Can manage licenses and attribution.

## 4. Core modules

The application should be split into these modules:

Authentication and campaigns.

Character/party manager.

Monster compendium.

Homebrew monster editor.

Encounter builder.

Combat tracker.

Dice roller.

Rules engine.

Condition/effect tracker.

Map/token layer.

Import/export tools.

Audit/history log.

Settings and content-source manager.

## 5. Data model

### 5.1 Campaign

```ts
interface Campaign {
  id: string;
  name: string;
  dmUserId: string;
  playerUserIds: string[];
  partyIds: string[];
  encounterIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 Character

```ts
interface Character {
  id: string;
  campaignId?: string;
  ownerUserId?: string;
  name: string;
  level: number;
  classes: CharacterClass[];
  race?: string;
  background?: string;

  armorClass: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;

  abilityScores: AbilityScores;
  savingThrows: SavingThrowProfile;
  skills: SkillProfile;

  speed: MovementSpeeds;
  passivePerception: number;

  initiativeBonus: number;
  proficiencyBonus: number;

  conditions: ActiveCondition[];
  effects: ActiveEffect[];

  notes?: string;
}
```

### 5.3 Monster stat block

The stat block should support both SRD monsters and complex modern stat blocks.

```ts
interface Monster {
  id: string;
  slug: string;
  name: string;
  size: CreatureSize;
  type: CreatureType;
  subtype?: string;
  alignment?: string;

  armorClass: ArmorClassEntry[];
  hitPoints: HitPointBlock;
  speed: MovementSpeeds;

  abilityScores: AbilityScores;

  savingThrows?: Partial<Record<Ability, number>>;
  skills?: Partial<Record<Skill, number>>;

  damageVulnerabilities: DamageType[];
  damageResistances: DamageType[];
  damageImmunities: DamageType[];
  conditionImmunities: ConditionType[];

  senses: SenseEntry[];
  passivePerception: number;

  languages: string[];

  challengeRating: string;
  xp: number;
  proficiencyBonus?: number;

  traits: StatBlockFeature[];
  actions: StatBlockFeature[];
  bonusActions?: StatBlockFeature[];
  reactions?: StatBlockFeature[];
  legendaryActions?: LegendaryActionBlock;
  mythicActions?: StatBlockFeature[];
  lairActions?: StatBlockFeature[];
  regionalEffects?: StatBlockFeature[];

  spellcasting?: SpellcastingBlock[];

  description?: string;
  environment?: string[];
  tags?: string[];

  source: SourceMetadata;
}
```

Supporting types:

```ts
interface HitPointBlock {
  average: number;
  formula: string; // e.g. "7d8 + 21"
}

interface ArmorClassEntry {
  value: number;
  type?: string; // "natural armor", "leather armor", "shield"
  condition?: string;
}

interface StatBlockFeature {
  id: string;
  name: string;
  description: string;
  attackBonus?: number;
  damageParts?: DamagePart[];
  saveDc?: number;
  saveAbility?: Ability;
  recharge?: RechargeRule;
  usage?: UsageRule;
}

interface DamagePart {
  formula: string; // "2d6 + 3"
  damageType: DamageType;
}

interface LegendaryActionBlock {
  actionsPerRound: number;
  description?: string;
  options: StatBlockFeature[];
}
```

### 5.4 Encounter template

An encounter template is the saved pre-combat encounter.

```ts
interface Encounter {
  id: string;
  campaignId?: string;
  name: string;
  description?: string;
  dmNotes?: string;

  partySnapshot: PartySnapshot;
  monsterGroups: EncounterMonsterGroup[];
  manualEntries: ManualEncounterEntry[];

  difficulty: EncounterDifficultyResult;

  status: "draft" | "ready" | "active" | "completed" | "archived";

  createdAt: string;
  updatedAt: string;
}
```

### 5.5 Monster group

```ts
interface EncounterMonsterGroup {
  id: string;
  monsterId: string;
  quantity: number;

  initiativeMode: "grouped" | "individual";
  hpMode: "average" | "rolled" | "manual";

  startingHidden: boolean;
  startingDisposition: "enemy" | "ally" | "neutral";

  customName?: string;
  notes?: string;
}
```

### 5.6 Active combat session

```ts
interface CombatSession {
  id: string;
  encounterId: string;
  campaignId?: string;

  status: "not_started" | "initiative_setup" | "running" | "paused" | "completed";

  roundNumber: number;
  activeTurnIndex: number;

  combatants: Combatant[];

  eventLog: CombatEvent[];

  visibilityMode: "dm_only" | "player_visible";

  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}
```

### 5.7 Combatant

```ts
interface Combatant {
  id: string;
  type: "character" | "monster" | "npc" | "manual" | "lair_action" | "environment";
  sourceEntityId?: string;

  displayName: string;
  publicName?: string;
  privateName?: string;

  initiative?: number;
  initiativeBonus: number;
  initiativeRoll?: DiceRollResult;
  initiativeTieBreaker?: number;

  armorClass?: number;
  maxHp?: number;
  currentHp?: number;
  tempHp?: number;

  isVisibleToPlayers: boolean;
  isDefeated: boolean;
  isRemoved: boolean;

  disposition: "ally" | "enemy" | "neutral";

  conditions: ActiveCondition[];
  effects: ActiveEffect[];

  concentration?: ConcentrationState;
  deathSaves?: DeathSaveState;

  tokenId?: string;

  sortGroup?: string;
  groupInstanceLabel?: string; // e.g. "A", "B", "C"

  notes?: string;
}
```

## 6. Encounter builder flow

### 6.1 Create encounter

User selects:

Campaign, optional.

Party, optional.

Rules version: `5e_2014`, `5e_2024`, or custom.

Content sources enabled.

Encounter name.

Environment.

Tags.

DM notes.

### 6.2 Select party

Party options:

Use campaign characters.

Create generic party.

Import party from JSON.

Add temporary NPC allies.

Generic party input:

```ts
interface GenericPartyMember {
  level: number;
  count: number;
}
```

The app should compute encounter thresholds based on party size and levels.

### 6.3 Add monsters

Monster search filters:

Name.

CR.

XP.

Size.

Type.

Environment.

Source.

Tags.

Movement type.

Legendary actions.

Lair actions.

Spellcasting.

Damage immunities/resistances.

Condition immunities.

Search result card should show:

Name.

CR and XP.

AC.

HP.

Type and size.

Source.

Short trait summary.

Add button.

Quantity control.

Grouped/individual initiative toggle.

Hidden/revealed toggle.

Disposition toggle.

### 6.4 Difficulty calculation

For 2014 5e, implement Dungeon Master’s Guide-style encounter math:

Calculate total monster XP.

Apply monster-count multiplier.

Adjust multiplier for party size.

Compare adjusted XP against party thresholds.

Return difficulty:

Trivial / Easy / Medium / Hard / Deadly / Absurd.

Example result:

```ts
interface EncounterDifficultyResult {
  totalMonsterXp: number;
  adjustedXp: number;
  partyThresholds: {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
  };
  dailyBudget?: number;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "deadly" | "absurd";
  monsterCountMultiplier: number;
  partySizeAdjustment: string;
}
```

### 6.5 Save encounter

Saving should persist:

Encounter template.

Party snapshot.

Monster group configuration.

Difficulty result.

Notes.

Content source versions.

Do not rely only on live character/monster references. Store a snapshot so future content changes do not break old encounters.

## 7. Combat tracker flow

### 7.1 Start combat

When user clicks **Run Encounter**:

Create a `CombatSession`.

Expand monster groups into combatants.

For grouped initiative, one initiative value may be shared by all members of a group.

For individual initiative, each monster instance gets its own initiative value.

Assign duplicate labels: Goblin A, Goblin B, Goblin C.

Set monster HP based on selected mode:

Average HP.

Rolled HP.

Manual HP.

Set player HP from live character sheet if connected, otherwise from snapshot.

Enter `initiative_setup` state.

### 7.2 Initiative setup

Each combatant has:

Initiative input.

Auto-roll button.

Advantage/disadvantage toggle.

Manual override.

Hidden/public visibility.

Roll formula:

```ts
1d20 + initiativeBonus
```

Tie-breakers:

Higher initiative value first.

Higher Dexterity score or initiative bonus.

Player characters before monsters, configurable.

Manual drag order override.

The app should preserve manual ordering after drag-and-drop.

### 7.3 Start round 1

When initiative is complete:

Sort combatants.

Set `roundNumber = 1`.

Set `activeTurnIndex = 0`.

Set status to `running`.

Write event log entry:

```ts
{
  type: "combat_started",
  round: 1,
  timestamp: "..."
}
```

### 7.4 Turn advancement

Controls:

Next turn.

Previous turn / undo.

Skip turn.

Delay turn.

Ready action marker.

Move combatant in order.

End combat.

On Next:

Apply start-of-turn automation.

Display active combatant.

Show active effects expiring at start/end of turn.

Prompt concentration checks if damage was taken since last turn.

If active combatant is hidden, player-facing order should not reveal it. D&D Beyond Maps similarly avoids revealing hidden creatures in the player-facing initiative order. ([dndbeyond-support.wizards.com][3])

### 7.5 Round advancement

When the final visible or hidden combatant ends turn:

Increment round.

Reset per-round resources.

Reset legendary action counters.

Reset reaction availability.

Trigger round-start reminders.

Log:

```ts
{
  type: "round_started",
  round: 2
}
```

## 8. HP, damage, healing, and death

### 8.1 HP editor

Each combatant HP panel should allow:

Set HP.

Apply damage.

Apply healing.

Apply temporary HP.

Set maximum HP.

Roll hit dice formula for monster HP.

Mark defeated.

Remove from combat.

Keep token as corpse.

Delete token.

### 8.2 Damage application

Damage flow:

Input total damage.

Optional damage type.

Optional critical flag.

Optional source.

Apply temp HP first.

Subtract remaining damage from current HP.

If character reaches 0 HP, enable death saves.

If monster reaches 0 HP, mark as defeated by default but allow override.

### 8.3 Healing

Healing flow:

Input healing amount.

Cannot exceed max HP unless feature allows max HP increase.

If at 0 HP and healed, clear unconscious/death-save pending state according to rules configuration.

### 8.4 Death saves

For player characters and important NPCs:

Track successes: 0–3.

Track failures: 0–3.

Natural 1 = two failures.

Natural 20 = regain 1 HP, configurable.

Damage at 0 HP causes death-save failures.

## 9. Conditions and effects

### 9.1 Built-in 5e conditions

The app should include condition definitions from allowed SRD content:

Blinded.

Charmed.

Deafened.

Frightened.

Grappled.

Incapacitated.

Invisible.

Paralyzed.

Petrified.

Poisoned.

Prone.

Restrained.

Stunned.

Unconscious.

Exhaustion.

Each condition should include:

Name.

Rules text from allowed source.

Mechanical tags.

Source metadata.

### 9.2 Active condition

```ts
interface ActiveCondition {
  id: string;
  conditionType: ConditionType;
  sourceCombatantId?: string;
  sourceName?: string;

  duration?: Duration;
  saveEnds?: SaveEndsRule;

  visibleToPlayers: boolean;
  notes?: string;

  appliedAtRound: number;
  appliedAtTurnCombatantId?: string;
}
```

### 9.3 Duration types

```ts
type Duration =
  | { type: "instant" }
  | { type: "rounds"; count: number; expires: "start_of_source_turn" | "end_of_source_turn" | "start_of_target_turn" | "end_of_target_turn" }
  | { type: "minutes"; count: number }
  | { type: "hours"; count: number }
  | { type: "concentration"; maxMinutes: number }
  | { type: "manual" };
```

### 9.4 Effects engine

Effects can modify:

AC.

Speed.

Attack rolls.

Saving throws.

Ability checks.

Damage resistance.

Damage immunity.

Advantage/disadvantage.

Visibility.

Action availability.

The first version may only track effects manually, but the data model should support future automation.

## 10. Monster stat block viewer

The combat tracker should provide a stat block side panel.

Sections:

Header: name, size, type, alignment.

AC.

HP.

Speed.

Abilities.

Saving throws.

Skills.

Vulnerabilities, resistances, immunities.

Senses.

Languages.

CR/XP.

Traits.

Actions.

Bonus actions.

Reactions.

Legendary actions.

Lair actions.

Spellcasting.

Notes.

Rollable elements:

Initiative.

Attack rolls.

Damage rolls.

Recharge rolls.

Saving throw DC display.

Ability checks.

Saving throws.

Clicking a rollable formula should create a dice roll event in the log.

## 11. Dice roller

### 11.1 Dice expression parser

Support:

`d20`

`1d20 + 5`

`2d6 + 3`

`4d8 + 2d6 + 4`

`1d20kh1` or advantage shorthand.

`1d20kl1` or disadvantage shorthand.

`2d20kh1 + 5`

Critical damage doubling modes:

Double dice only.

Double total.

Roll twice.

### 11.2 Roll result

```ts
interface DiceRollResult {
  id: string;
  expression: string;
  total: number;
  rolls: DiceRollPart[];
  label?: string;
  rollerUserId?: string;
  visibility: "private" | "party" | "public";
  createdAt: string;
}
```

## 12. Map/token mode

### 12.1 Map object

```ts
interface BattleMap {
  id: string;
  campaignId?: string;
  name: string;
  imageUrl?: string;
  gridType: "square" | "hex" | "none";
  gridSizePx: number;
  width: number;
  height: number;
  fogOfWarEnabled: boolean;
  tokens: Token[];
}
```

### 12.2 Token

```ts
interface Token {
  id: string;
  mapId: string;
  linkedCombatantId?: string;
  linkedEntityId?: string;

  name: string;
  imageUrl?: string;

  x: number;
  y: number;
  widthSquares: number;
  heightSquares: number;

  rotation?: number;

  visibleToPlayers: boolean;
  hiddenFromInitiative: boolean;

  disposition: "ally" | "enemy" | "neutral";

  statusMarkers: string[];
}
```

### 12.3 Map combat flow

User places tokens.

User selects tokens and clicks **Add to Encounter**.

App creates combatants from tokens.

Tokens inherit monster/character data if linked.

Hidden tokens remain invisible to players.

When combat starts, initiative order appears.

Active token is highlighted for DM.

Optional player-facing initiative strip shows only revealed combatants.

User can add reinforcements mid-combat.

User can remove defeated tokens from initiative while leaving token on map.

D&D Beyond Maps supports adding tokens to initiative, hidden creature behavior, player-facing initiative, and adding/removing creatures during combat; the same concepts should be implemented here without copying its exact UI. ([dndbeyond-support.wizards.com][3])

## 13. Manual entries and reminders

The tracker should allow arbitrary initiative entries:

Lair Action.

Regional Effect.

Trap.

Hazard.

Spell effect.

Falling rocks.

Burning building.

Round timer.

Villain monologue.

Reinforcement arrival.

Example:

```ts
interface ManualEncounterEntry {
  id: string;
  name: string;
  initiative?: number;
  recurring: boolean;
  visibleToPlayers: boolean;
  notes?: string;
}
```

Manual entries can have no HP/AC, or optional HP/AC if the DM wants to track objects.

## 14. Legendary, lair, and recharge tracking

### 14.1 Legendary actions

For each legendary creature:

Track total legendary actions per round.

Reset at start of creature’s turn.

Allow DM to spend actions after other creatures’ turns.

Show remaining legendary action count.

### 14.2 Lair actions

Allow lair action combatant at initiative 20.

Tie behavior configurable.

Default: initiative count 20, losing ties.

### 14.3 Recharge

For features with recharge:

Show recharge state.

At start of monster turn, prompt roll.

On success, mark ability available.

On use, mark ability expended.

```ts
interface RechargeRule {
  type: "recharge";
  values: number[]; // [5, 6]
}
```

## 15. Player-facing display

The player view should show:

Current round.

Current turn.

Visible initiative order.

Visible combatants only.

Public names.

Public conditions.

Public HP mode, configurable:

Exact HP.

Healthy/Bloodied/Near Death.

Hidden HP.

The DM can configure:

Show monster names or generic names.

Show AC after discovered.

Show conditions.

Show defeated enemies.

Show hidden creatures.

## 16. Encounter state machine

```txt
draft
  -> ready
  -> initiative_setup
  -> running
  -> paused
  -> running
  -> completed
  -> archived
```

Allowed transitions:

Draft to ready.

Ready to initiative setup.

Initiative setup to running.

Running to paused.

Paused to running.

Running to completed.

Any non-active state to archived.

Completed to restarted, creating a new session.

## 17. Event log

Every important action should be logged.

```ts
interface CombatEvent {
  id: string;
  combatSessionId: string;
  type:
    | "combat_started"
    | "round_started"
    | "turn_started"
    | "initiative_rolled"
    | "damage_applied"
    | "healing_applied"
    | "temp_hp_applied"
    | "condition_added"
    | "condition_removed"
    | "effect_added"
    | "effect_expired"
    | "combatant_defeated"
    | "combatant_removed"
    | "combatant_added"
    | "dice_rolled"
    | "note_added"
    | "combat_ended";

  actorUserId?: string;
  combatantId?: string;
  round?: number;
  turnIndex?: number;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

This allows undo, replay, audit, and session recaps.

## 18. Undo model

Version 1:

Allow undo for turn advancement only.

Version 2:

Allow undo for:

Damage.

Healing.

Condition changes.

Initiative changes.

Combatant removal.

Version 3:

Full event-sourced state reconstruction.

Recommended approach:

Store current state for speed.

Store event log for audit.

Store reversible patches for undo.

## 19. Import/export formats

### 19.1 Monster JSON import

```json
{
  "name": "Example Beast",
  "size": "Medium",
  "type": "beast",
  "alignment": "unaligned",
  "armorClass": [{ "value": 13, "type": "natural armor" }],
  "hitPoints": { "average": 22, "formula": "4d8 + 4" },
  "speed": { "walk": 40 },
  "abilityScores": {
    "str": 14,
    "dex": 15,
    "con": 13,
    "int": 2,
    "wis": 12,
    "cha": 6
  },
  "senses": [{ "type": "passivePerception", "value": 11 }],
  "languages": [],
  "challengeRating": "1/2",
  "xp": 100,
  "traits": [],
  "actions": [
    {
      "name": "Bite",
      "description": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 piercing damage.",
      "attackBonus": 4,
      "damageParts": [{ "formula": "1d8 + 3", "damageType": "piercing" }]
    }
  ],
  "source": {
    "sourceId": "USER_HOMEBREW",
    "sourceName": "User Homebrew",
    "sourceType": "USER_HOMEBREW",
    "isRedistributable": false
  }
}
```

### 19.2 Encounter export

Export should include:

Encounter metadata.

Party snapshot.

Monster references.

Monster snapshots if private export.

Combat log.

Final state.

Do not export non-redistributable monster text unless export is explicitly private to the user.

## 20. Content import pipeline for SRD monsters

The AI/programmer should implement this pipeline:

Fetch SRD source files from a legally usable source.

Parse monsters into normalized JSON.

Attach Creative Commons attribution.

Validate required fields.

Calculate derived fields:

Proficiency bonus.

Initiative bonus from Dexterity.

Passive Perception.

Expected XP from CR.

Index search fields.

Store in compendium.

Expose in encounter builder.

### 20.1 Import validation

For every monster:

Name required.

Size required.

Type required.

AC required.

HP required.

Speed required.

Ability scores required.

CR required.

At least one action recommended.

Source metadata required.

License metadata required.

### 20.2 Attribution

Every SRD-derived page or export should include attribution text similar to:

“This work includes material taken from the System Reference Document 5.1 by Wizards of the Coast LLC, available under the Creative Commons Attribution 4.0 International License.”

Use the exact attribution required by the chosen SRD/source.

## 21. AI programming instructions

The AI building this tool should follow these rules:

Do not hardcode copyrighted Monster Manual stat blocks.

Implement the data schema first.

Create seed data only from SRD/CC content or small placeholder homebrew examples.

Build the app with clean separation between rules logic and UI.

Build encounter math as a pure function.

Build combat state transitions as pure reducer functions.

Build stat block rendering from generic JSON, not from hardcoded monster-specific templates.

Build importers as separate modules.

Add tests for initiative ordering, HP changes, difficulty calculation, grouped monsters, hidden monsters, round advancement, and condition expiry.

## 22. Recommended MVP

### MVP 1: Standalone encounter tracker

Features:

Campaignless encounter creation.

Generic party.

SRD monster compendium.

Monster search.

Difficulty calculation.

Start combat.

Roll initiative.

Manual initiative override.

Round/turn tracking.

HP/damage/healing/temp HP.

Basic conditions.

Monster stat block viewer.

Save/resume encounter.

### MVP 2: Campaign support

Features:

Campaigns.

Characters.

Party import.

Live character HP.

Player-facing initiative.

Shared dice log.

### MVP 3: Advanced combat

Features:

Concentration.

Death saves.

Legendary actions.

Lair actions.

Recharge.

Effect durations.

Manual reminders.

Undo.

Session recap.

### MVP 4: Map mode

Features:

Map upload.

Grid.

Tokens.

Token-to-combatant linking.

Hidden monsters.

Player view.

Add/remove tokens during combat.

## 23. Suggested backend API

### Encounters

```http
POST /encounters
GET /encounters
GET /encounters/:id
PATCH /encounters/:id
DELETE /encounters/:id
POST /encounters/:id/duplicate
POST /encounters/:id/start
```

### Combat sessions

```http
GET /combat-sessions/:id
PATCH /combat-sessions/:id
POST /combat-sessions/:id/roll-initiative
POST /combat-sessions/:id/start
POST /combat-sessions/:id/next-turn
POST /combat-sessions/:id/previous-turn
POST /combat-sessions/:id/apply-damage
POST /combat-sessions/:id/apply-healing
POST /combat-sessions/:id/add-condition
POST /combat-sessions/:id/remove-condition
POST /combat-sessions/:id/add-combatant
POST /combat-sessions/:id/remove-combatant
POST /combat-sessions/:id/end
```

### Monsters

```http
GET /monsters
GET /monsters/:id
POST /monsters
PATCH /monsters/:id
DELETE /monsters/:id
POST /monsters/import
POST /monsters/validate
```

### Dice

```http
POST /dice/roll
```

## 24. Testing requirements

### Encounter math tests

One monster vs four PCs.

Many weak monsters vs four PCs.

Solo boss vs large party.

Party size multiplier adjustment.

XP threshold edge cases.

### Initiative tests

Manual initiative ordering.

Auto initiative.

Tie breakers.

Grouped monsters.

Individual monsters.

Hidden monsters in player view.

Drag-and-drop reorder.

### HP tests

Damage applies to temp HP first.

Healing cannot exceed max HP.

Monster defeated at 0 HP.

Character death saves activate at 0 HP.

Mass damage and resistance hooks.

### Condition tests

Condition applied.

Condition removed.

Condition expires at start of turn.

Condition expires at end of turn.

Concentration effect removed when concentration ends.

### Map tests

Token added to encounter.

Hidden token not visible to players.

Token removed from combat but left on map.

Token deleted from map and combat.

Reinforcement added mid-combat.

## 25. Non-goals for first version

Full character builder.

Full spell automation.

Full rules adjudication.

Full official Monster Manual database.

Automated copyrighted PDF extraction.

Marketplace.

3D virtual tabletop.

Voice/video.

## 26. Summary implementation brief for the AI programmer

Build a modular 5e-compatible encounter builder and combat tracker. Use SRD/Creative Commons monsters as bundled data. Do not include full proprietary Monster Manual stat blocks unless licensed. Represent all monsters, characters, and manual entries as generic combatants during active combat. Encounters are saved templates; combat sessions are active stateful runs. Initiative, HP, conditions, effects, rounds, turns, hidden visibility, and stat block access are the core features. Add map/token support only after the standalone tracker is reliable.

[1]: https://www.dndbeyond.com/srd?srsltid=AfmBOoro0FXjTkuxdY8mhDOhZiss8dds9J-l-VJKrBWJfuJDOy8JHbTF&utm_source=chatgpt.com "SRD v5.2.1 - System Reference Document"
[2]: https://www.dndbeyond.com/posts/1135-tutorial-how-to-build-encounters-and-run-them-on-d?srsltid=AfmBOoppyMQraCwhqYJTygjydQnvVIzmeVBZTua8cK_HKfX7bKsXldnQ&utm_source=chatgpt.com "Tutorial: How to Build Encounters and Run Them on D&D ..."
[3]: https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps?utm_source=chatgpt.com "Combat Encounters on Maps - D&D Beyond"
