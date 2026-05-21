import type { DiceRollResult } from '@/types'

export function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides)
}

// Parses NdM±X with optional kh1/kl1 (advantage/disadvantage) on each NdM term.
export function rollExpr(expr: string): DiceRollResult {
  const normalized = String(expr)
    .replace(/\s+/g, '')
    .replace(/\+-/g, '-')
    .replace(/-\+/g, '-')
    .replace(/--/g, '+')
    .replace(/\+\+/g, '+')
  const tokens = normalized.match(/[+-]?(?:\d+d\d+(?:kh\d+|kl\d+)?|\d+)/gi) ?? []

  let total = 0
  const parts: DiceRollResult['parts'] = []
  for (const t of tokens) {
    const sign = t.startsWith('-') ? -1 : 1
    const body = t.replace(/^[+-]/, '')
    const dm = body.match(/^(\d+)d(\d+)(?:(kh|kl)(\d+))?$/i)
    if (dm) {
      const n = +dm[1]
      const s = +dm[2]
      const keep = dm[3]
      const k = +dm[4] || 0
      const rolls = Array.from({ length: n }, () => rollDie(s))
      let kept = rolls.slice()
      if (keep) {
        const sorted = rolls.slice().sort((a, b) => a - b)
        kept = keep.toLowerCase() === 'kh' ? sorted.slice(-k) : sorted.slice(0, k)
      }
      const sum = kept.reduce((a, b) => a + b, 0) * sign
      total += sum
      parts.push({ expr: t, rolls, kept, sum })
    } else if (/^\d+$/.test(body)) {
      const constant = sign * +body
      total += constant
      parts.push({ expr: t, constant })
    }
  }
  return { expression: String(expr), total, parts }
}
