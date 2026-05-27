import type { Ability, Grant, RuleElement, RuleElementKind } from '@/types'
import { flattenEntries, slugify, type Entry } from './5etoolsTags'

interface Class5e {
  name: string
  source?: string
  hd?: { faces?: number }
  proficiency?: string[]
  spellcastingAbility?: Ability
  classFeatures?: Array<string | { classFeature?: string; gainSubclassFeature?: boolean }>
}

interface Subclass5e {
  name: string
  source?: string
  shortName?: string
  className?: string
  classSource?: string
  subclassFeatures?: string[]
}

interface Feature5e {
  name: string
  source?: string
  className?: string
  classSource?: string
  subclassShortName?: string
  subclassSource?: string
  level?: number
  entries?: Entry[]
}

interface Race5e {
  name: string
  source?: string
  speed?: number | { walk?: number }
  ability?: Array<Record<string, number>>
  entries?: Entry[]
}

interface Background5e {
  name: string
  source?: string
  skillProficiencies?: Array<Record<string, boolean | number>>
  entries?: Entry[]
}

interface Feat5e {
  name: string
  source?: string
  ability?: Array<Record<string, number>>
  entries?: Entry[]
}

export interface ConvertOptions {
  sourceName?: string
  sourceFilter?: string
}

export interface ConvertRuleResult {
  converted: RuleElement[]
  skipped: Array<{ name: string; reason: string }>
}

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function source(sourceId: string | undefined, sourceName: string | undefined) {
  return {
    sourceId: sourceId ?? 'UNKNOWN',
    sourceName: sourceName ?? sourceId ?? 'Private import',
    sourceType: 'PRIVATE_IMPORT' as const,
    isRedistributable: false,
  }
}

function sourceMatches(itemSource: string | undefined, opts: ConvertOptions): boolean {
  return !opts.sourceFilter || itemSource === opts.sourceFilter
}

function ruleSlug(kind: RuleElementKind, name: string, suffix?: string): string {
  return `${kind}-${slugify([suffix, name].filter(Boolean).join(' '))}`
}

function saveGrants(proficiency?: string[]): Grant[] {
  return (proficiency ?? [])
    .filter(p => ABILITIES.includes(p as Ability))
    .map(value => ({ type: 'proficiency', target: 'save', value }) satisfies Grant)
}

function abilityGrants(ability?: Array<Record<string, number>>): Grant[] {
  const grants: Grant[] = []
  for (const block of ability ?? []) {
    for (const ability of ABILITIES) {
      const value = block[ability]
      if (typeof value === 'number') grants.push({ type: 'ability', ability, value })
    }
  }
  return grants
}

function skillGrants(skillProficiencies?: Array<Record<string, boolean | number>>): Grant[] {
  const grants: Grant[] = []
  for (const block of skillProficiencies ?? []) {
    for (const [value, enabled] of Object.entries(block)) {
      if (enabled === true || typeof enabled === 'number') grants.push({ type: 'proficiency', target: 'skill', value })
    }
  }
  return grants
}

function subclassLevel(classFeatures?: Class5e['classFeatures']): number | undefined {
  for (const f of classFeatures ?? []) {
    if (typeof f === 'object' && f.gainSubclassFeature) {
      const raw = f.classFeature ?? ''
      const level = parseInt(raw.split('|')[3] ?? '', 10)
      if (Number.isFinite(level)) return level
    }
  }
  return undefined
}

function refs(values?: Array<string | { classFeature?: string; gainSubclassFeature?: boolean }>): string[] {
  return (values ?? []).map(v => typeof v === 'string' ? v : v.classFeature).filter(Boolean) as string[]
}

function convertClass(c: Class5e, opts: ConvertOptions): RuleElement {
  return {
    slug: ruleSlug('class', c.name),
    name: c.name,
    kind: 'class',
    hitDie: c.hd?.faces ?? 8,
    spellcastingAbility: c.spellcastingAbility,
    subclassLevel: subclassLevel(c.classFeatures),
    entries: `${c.name} class imported from 5e.tools data.`,
    grants: saveGrants(c.proficiency),
    refs: refs(c.classFeatures),
    source: source(c.source, opts.sourceName),
  }
}

function convertSubclass(s: Subclass5e, opts: ConvertOptions): RuleElement {
  const className = s.className ?? ''
  return {
    slug: ruleSlug('subclass', s.shortName ?? s.name, className),
    name: s.shortName ?? s.name,
    kind: 'subclass',
    className,
    classSource: s.classSource,
    level: parseInt((s.subclassFeatures?.[0] ?? '').split('|')[5] ?? '', 10) || undefined,
    entries: `${s.name} subclass imported from 5e.tools data.`,
    refs: s.subclassFeatures,
    source: source(s.source, opts.sourceName),
  }
}

function convertFeature(f: Feature5e, kind: 'classFeature' | 'subclassFeature', opts: ConvertOptions): RuleElement {
  const suffix = [f.className, f.subclassShortName, f.level].filter(Boolean).join(' ')
  return {
    slug: ruleSlug(kind, f.name, suffix),
    name: f.name,
    kind,
    className: f.className,
    classSource: f.classSource,
    subclassName: f.subclassShortName,
    subclassSource: f.subclassSource,
    level: f.level,
    entries: flattenEntries(f.entries),
    source: source(f.source, opts.sourceName),
  }
}

function convertRace(r: Race5e, opts: ConvertOptions): RuleElement {
  const speed = typeof r.speed === 'number' ? r.speed : r.speed?.walk
  const grants = abilityGrants(r.ability)
  if (speed) grants.unshift({ type: 'speed', mode: 'walk', value: speed })
  return {
    slug: ruleSlug('race', r.name),
    name: r.name,
    kind: 'race',
    entries: flattenEntries(r.entries),
    grants,
    source: source(r.source, opts.sourceName),
  }
}

function convertBackground(b: Background5e, opts: ConvertOptions): RuleElement {
  return {
    slug: ruleSlug('background', b.name),
    name: b.name,
    kind: 'background',
    entries: flattenEntries(b.entries),
    grants: skillGrants(b.skillProficiencies),
    source: source(b.source, opts.sourceName),
  }
}

function convertFeat(f: Feat5e, opts: ConvertOptions): RuleElement {
  return {
    slug: ruleSlug('feat', f.name),
    name: f.name,
    kind: 'feat',
    entries: flattenEntries(f.entries),
    grants: abilityGrants(f.ability),
    source: source(f.source, opts.sourceName),
  }
}

export function looksLike5eToolsRules(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false
  const obj = parsed as Record<string, unknown>
  return Array.isArray(obj.class)
    || Array.isArray(obj.subclass)
    || Array.isArray(obj.race)
    || Array.isArray(obj.background)
    || Array.isArray(obj.feat)
    || Array.isArray(obj.classFeature)
    || Array.isArray(obj.subclassFeature)
}

export function convertRules(parsed: unknown, opts: ConvertOptions = {}): ConvertRuleResult {
  const obj = parsed as {
    class?: Class5e[]
    subclass?: Subclass5e[]
    classFeature?: Feature5e[]
    subclassFeature?: Feature5e[]
    race?: Race5e[]
    background?: Background5e[]
    feat?: Feat5e[]
  }
  const converted: RuleElement[] = []
  const skipped: ConvertRuleResult['skipped'] = []
  const add = <T extends { name: string }>(items: T[] | undefined, fn: (item: T) => RuleElement) => {
    for (const item of items ?? []) {
      if (!item?.name) continue
      if (!sourceMatches((item as { source?: string }).source, opts)) continue
      try { converted.push(fn(item)) }
      catch (err) { skipped.push({ name: item.name, reason: err instanceof Error ? err.message : String(err) }) }
    }
  }
  add(obj.class, item => convertClass(item, opts))
  add(obj.subclass, item => convertSubclass(item, opts))
  add(obj.classFeature, item => convertFeature(item, 'classFeature', opts))
  add(obj.subclassFeature, item => convertFeature(item, 'subclassFeature', opts))
  add(obj.race, item => convertRace(item, opts))
  add(obj.background, item => convertBackground(item, opts))
  add(obj.feat, item => convertFeat(item, opts))
  return { converted, skipped }
}
