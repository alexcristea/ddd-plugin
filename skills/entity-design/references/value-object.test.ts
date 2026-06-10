// Generic Value Object test reference (neutral names; not compiled).
//
// Value Objects are tested by direct instantiation — NO mocks (a VO has no injected
// collaborators). Cover: construction + normalization, value access, derived getters,
// value equality, and serialization (snapshot + toJSON).

import { Measurement } from './Measurement'

describe(Measurement.name, () => {
  it('should normalize on construction', () => {
    const sut = new Measurement({ value: '  10  ', unit: '  KG  ' })

    expect(sut.value).toStrictEqual('10') // trimmed
    expect(sut.unit).toStrictEqual('kg') // trimmed + lowercased
  })

  it('should reject invalid input', () => {
    expect(() => new Measurement({ value: '   ', unit: 'kg' })).toThrow()
  })

  // State-dependent derived getter → table test over [input, expected].
  const units: [string, boolean][] = [
    ['m', true],
    ['kg', true],
    ['ft', false],
  ]
  it.each(units)('should compute isMetric when unit is %s', (unit, expected) => {
    const sut = new Measurement({ value: '1', unit })

    expect(sut.isMetric).toStrictEqual(expected)
  })

  it('should compare by value', () => {
    const a = new Measurement({ value: '10', unit: 'kg' })
    const b = new Measurement({ value: '10', unit: 'kg' })
    const c = new Measurement({ value: '20', unit: 'kg' })

    expect(a).toEqual(b) // structural equality
    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
    expect(a.equals(null)).toBe(false)
  })

  it('should serialize to a frozen snapshot, and toJSON delegates to it', () => {
    const sut = new Measurement({ value: '10', unit: 'kg' })

    expect(sut.snapshot).toStrictEqual({ value: '10', unit: 'kg' })
    expect(sut.toJSON()).toStrictEqual(sut.snapshot)
    expect(Object.isFrozen(sut.snapshot)).toBe(true)
  })

  describe('factories', () => {
    it('make() should return null for blank input and an instance otherwise', () => {
      expect(Measurement.make(null, 'kg')).toBeNull()
      expect(Measurement.make('  ', 'kg')).toBeNull()
      expect(Measurement.make('10', 'kg')).toEqual(new Measurement({ value: '10', unit: 'kg' }))
    })

    it('restore() should rebuild from a snapshot', () => {
      const original = new Measurement({ value: '10', unit: 'kg' })

      expect(Measurement.restore(original.snapshot)).toEqual(original)
    })
  })
})
