// Shared utilities for 5etools-format JSON: inline {@tag …} stripping and
// entry-array flattening. Used by both the bestiary and spell converters.

export type Entry =
  | string
  | { type?: string; name?: string; entries?: Entry[]; entry?: string; items?: Array<ListItem | string>; style?: string }
export type ListItem = { type?: string; name?: string; entry?: string; entries?: Entry[] }

// 5etools embeds inline tags like {@dc 15}, {@hit 7}, {@damage 2d6+3},
// {@spell fireball}, {@item shield|PHB}, {@status surprised}, {@h} for "Hit:", etc.
// Strip to readable plain text. Recursive via repeated passes (handles nesting).
export function stripTags(text: string): string {
  let out = text
  for (let i = 0; i < 6; i++) {
    const prev = out
    out = out.replace(/\{@(\w+)\s+([^{}]*?)\}/g, (_full, tag: string, body: string) => {
      const parts = body.split('|')
      const first = parts[0]
      switch (tag) {
        case 'h': return 'Hit: '
        case 'dc': return `DC ${first}`
        case 'hit': return (first.startsWith('+') || first.startsWith('-')) ? first : `+${first}`
        case 'atk': return ''
        case 'damage': case 'dice': case 'd20':
        case 'scaledamage': case 'scaledice':
          return first
        case 'recharge': return first ? `Recharge ${first}` : 'Recharge'
        case 'chance': return `${first}%`
        case 'item': case 'spell': case 'creature': case 'condition':
        case 'status': case 'skill': case 'sense': case 'action':
        case 'class': case 'race': case 'feat': case 'background':
        case 'deity': case 'book': case 'adventure': case 'filter':
        case 'variantrule': case 'optfeature': case 'reward': case 'table':
        case 'trap': case 'hazard': case 'vehicle': case 'object':
        case 'cult': case 'boon': case 'disease': case 'language': case 'note':
          return parts[2] || first
        case 'b': case 'bold':
        case 'i': case 'italic':
        case 'u': case 'underline':
        case 's': case 'strike':
          return first
        case 'color': return parts[0]
        case 'highlight': return first
        case 'quickref': return parts[3] || parts[0]
        default: return parts[parts.length - 1] || first
      }
    })
    if (out === prev) break
  }
  return out.replace(/\s+\./g, '.').replace(/\s{2,}/g, ' ').trim()
}

export function flattenEntries(entries: Entry[] | undefined): string {
  if (!entries) return ''
  const parts: string[] = []
  for (const e of entries) {
    if (typeof e === 'string') {
      parts.push(stripTags(e))
    } else if (e && typeof e === 'object') {
      if (e.type === 'list' && Array.isArray(e.items)) {
        for (const it of e.items) {
          if (typeof it === 'string') parts.push('• ' + stripTags(it))
          else if (it && typeof it === 'object') {
            const head = it.name ? `${stripTags(it.name)}.` : ''
            const body = it.entry ? stripTags(it.entry)
              : Array.isArray(it.entries) ? flattenEntries(it.entries)
              : ''
            parts.push(`• ${head} ${body}`.trim())
          }
        }
      } else if (Array.isArray(e.entries)) {
        const head = e.name ? `${stripTags(e.name)}. ` : ''
        parts.push(head + flattenEntries(e.entries))
      } else if (typeof e.entry === 'string') {
        parts.push(stripTags(e.entry))
      }
    }
  }
  return parts.join('\n').trim()
}

export function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[''‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
