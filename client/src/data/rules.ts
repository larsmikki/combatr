import type { Ability, RuleElement, SourceMetadata } from '@/types'

export const SRD_RULE_SOURCE: SourceMetadata = {
  sourceId: 'SRD_5_1',
  sourceName: 'System Reference Document 5.1',
  sourceType: 'SRD_5_1_CC',
  licenseName: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attributionText:
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available under the CC BY 4.0 license.',
  isRedistributable: true,
}

const cls = (name: string, hitDie: number, saves: Ability[], spellcastingAbility?: Ability, subclassLevel = 3): RuleElement => ({
  slug: `class-${name.toLowerCase().replaceAll(' ', '-')}`,
  name,
  kind: 'class',
  hitDie,
  spellcastingAbility,
  subclassLevel,
  entries: `${name} class progression.`,
  grants: saves.map(ability => ({ type: 'proficiency', target: 'save', value: ability })),
  source: SRD_RULE_SOURCE,
})

const sub = (className: string, name: string, level: number): RuleElement => ({
  slug: `subclass-${className.toLowerCase().replaceAll(' ', '-')}-${name.toLowerCase().replaceAll(' ', '-')}`,
  name,
  kind: 'subclass',
  className,
  level,
  entries: `${name} ${className} subclass.`,
  source: SRD_RULE_SOURCE,
})

const race = (name: string, speed = 30, grants: RuleElement['grants'] = []): RuleElement => ({
  slug: `race-${name.toLowerCase().replaceAll(' ', '-')}`,
  name,
  kind: 'race',
  entries: `${name} ancestry traits.`,
  grants: [{ type: 'speed', mode: 'walk', value: speed }, ...grants],
  source: SRD_RULE_SOURCE,
})

const background = (name: string, skills: string[]): RuleElement => ({
  slug: `background-${name.toLowerCase().replaceAll(' ', '-')}`,
  name,
  kind: 'background',
  entries: `${name} background.`,
  grants: skills.map(value => ({ type: 'proficiency', target: 'skill', value })),
  source: SRD_RULE_SOURCE,
})

const feature = (className: string, level: number, name: string, entries: string): RuleElement => ({
  slug: `feature-${className.toLowerCase().replaceAll(' ', '-')}-${level}-${name.toLowerCase().replaceAll(' ', '-')}`,
  name,
  kind: 'classFeature',
  className,
  level,
  entries,
  source: SRD_RULE_SOURCE,
})

export const SRD_RULE_ELEMENTS: RuleElement[] = [
  cls('Barbarian', 12, ['str', 'con']),
  cls('Bard', 8, ['dex', 'cha'], 'cha', 3),
  cls('Cleric', 8, ['wis', 'cha'], 'wis', 1),
  cls('Druid', 8, ['int', 'wis'], 'wis', 2),
  cls('Fighter', 10, ['str', 'con']),
  cls('Monk', 8, ['str', 'dex'], undefined, 3),
  cls('Paladin', 10, ['wis', 'cha'], 'cha', 3),
  cls('Ranger', 10, ['str', 'dex'], 'wis', 3),
  cls('Rogue', 8, ['dex', 'int']),
  cls('Sorcerer', 6, ['con', 'cha'], 'cha', 1),
  cls('Warlock', 8, ['wis', 'cha'], 'cha', 1),
  cls('Wizard', 6, ['int', 'wis'], 'int', 2),

  sub('Barbarian', 'Path of the Berserker', 3),
  sub('Bard', 'College of Lore', 3),
  sub('Cleric', 'Life Domain', 1),
  sub('Druid', 'Circle of the Land', 2),
  sub('Fighter', 'Champion', 3),
  sub('Monk', 'Way of the Open Hand', 3),
  sub('Paladin', 'Oath of Devotion', 3),
  sub('Ranger', 'Hunter', 3),
  sub('Rogue', 'Thief', 3),
  sub('Sorcerer', 'Draconic Bloodline', 1),
  sub('Warlock', 'The Fiend', 1),
  sub('Wizard', 'School of Evocation', 2),

  race('Human', 30, [
    { type: 'ability', ability: 'str', value: 1 },
    { type: 'ability', ability: 'dex', value: 1 },
    { type: 'ability', ability: 'con', value: 1 },
    { type: 'ability', ability: 'int', value: 1 },
    { type: 'ability', ability: 'wis', value: 1 },
    { type: 'ability', ability: 'cha', value: 1 },
  ]),
  race('Dwarf', 25, [{ type: 'ability', ability: 'con', value: 2 }]),
  race('Elf', 30, [{ type: 'ability', ability: 'dex', value: 2 }]),
  race('Halfling', 25, [{ type: 'ability', ability: 'dex', value: 2 }]),
  race('Dragonborn', 30, [{ type: 'ability', ability: 'str', value: 2 }, { type: 'ability', ability: 'cha', value: 1 }]),
  race('Gnome', 25, [{ type: 'ability', ability: 'int', value: 2 }]),
  race('Half-Elf', 30, [{ type: 'ability', ability: 'cha', value: 2 }]),
  race('Half-Orc', 30, [{ type: 'ability', ability: 'str', value: 2 }, { type: 'ability', ability: 'con', value: 1 }]),
  race('Tiefling', 30, [{ type: 'ability', ability: 'cha', value: 2 }, { type: 'ability', ability: 'int', value: 1 }]),

  background('Acolyte', ['insight', 'religion']),
  background('Criminal', ['deception', 'stealth']),
  background('Folk Hero', ['animal handling', 'survival']),
  background('Noble', ['history', 'persuasion']),
  background('Sage', ['arcana', 'history']),
  background('Soldier', ['athletics', 'intimidation']),

  feature('Fighter', 1, 'Fighting Style', 'Choose a fighting style. Imported content can provide detailed options.'),
  feature('Fighter', 1, 'Second Wind', 'Regain hit points as a bonus action once per rest.'),
  feature('Fighter', 2, 'Action Surge', 'Take one additional action on your turn once per rest.'),
  feature('Rogue', 1, 'Sneak Attack', 'Deal extra damage once per turn when its requirements are met.'),
  feature('Barbarian', 1, 'Rage', 'Enter a rage for bonus damage and damage resistance.'),
  feature('Wizard', 1, 'Spellcasting', 'Prepare and cast wizard spells using Intelligence.'),
  feature('Cleric', 1, 'Spellcasting', 'Prepare and cast cleric spells using Wisdom.'),
]

