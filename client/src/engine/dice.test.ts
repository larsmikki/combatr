import { describe, it, expect } from 'vitest'
import { rollExpr } from './dice'

// Seed-free: we assert range invariants over many trials.

describe('rollExpr', () => {
  it('parses a constant', () => {
    expect(rollExpr('7').total).toBe(7)
  })

  it('parses NdM with modifier', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollExpr('2d6+3')
      expect(r.total).toBeGreaterThanOrEqual(5)
      expect(r.total).toBeLessThanOrEqual(15)
    }
  })

  it('handles negative modifier (literal -)', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollExpr('1d4-1')
      expect(r.total).toBeGreaterThanOrEqual(0)
      expect(r.total).toBeLessThanOrEqual(3)
    }
  })

  it('normalizes +- combo from template strings', () => {
    // Templated bonuses can produce things like "1d20+-2".
    for (let i = 0; i < 200; i++) {
      const r = rollExpr('1d20+-2')
      expect(r.total).toBeGreaterThanOrEqual(-1)
      expect(r.total).toBeLessThanOrEqual(18)
    }
  })

  it('advantage (kh1) keeps the higher of two d20s', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollExpr('2d20kh1+5')
      expect(r.total).toBeGreaterThanOrEqual(6)
      expect(r.total).toBeLessThanOrEqual(25)
    }
  })

  it('disadvantage (kl1) keeps the lower', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollExpr('2d20kl1')
      expect(r.total).toBeGreaterThanOrEqual(1)
      expect(r.total).toBeLessThanOrEqual(20)
    }
  })

  it('sums multiple dice terms', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollExpr('1d6+1d4+2')
      expect(r.total).toBeGreaterThanOrEqual(4)
      expect(r.total).toBeLessThanOrEqual(12)
    }
  })

  it('returns parts metadata', () => {
    const r = rollExpr('2d6+3')
    expect(r.parts).toHaveLength(2)
    expect(r.parts[0].rolls).toHaveLength(2)
    expect(r.parts[1].constant).toBe(3)
  })
})
