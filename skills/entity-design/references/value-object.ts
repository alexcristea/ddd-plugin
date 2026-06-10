// Generic Value Object reference (neutral names; not compiled).
//
// A Value Object is defined entirely by its values: no identity, immutable, two
// instances with equal values are interchangeable. It wraps + validates a concept
// and is the unit of equality. Adapt base class / serialization / factory names to
// the Project Profile.

import { ValueObject } from '<<vo-base import>>' // profile §1

// Constructor input shape.
interface Props {
  value: string
  unit: string
}

// Serializable shape returned by `snapshot` (enums become their string values).
interface Snapshot {
  value: string
  unit: string
}

export class Measurement extends ValueObject {
  // All fields private + readonly. Use a non-readonly field ONLY for a value that
  // legitimately transitions in place (rare for a VO — usually a status).
  private readonly _value: string
  private readonly _unit: string

  constructor(params: Props) {
    super()
    // The constructor is the invariant gate: normalize and validate here.
    this._value = params.value.trim()
    this._unit = params.unit.trim().toLowerCase()
    if (!this._value) {
      // Prefer a typed domain error (profile §10) over a bare Error in real code.
      throw new Error('Measurement value must not be empty')
    }
  }

  get value(): string {
    return this._value
  }

  get unit(): string {
    return this._unit
  }

  // Derived domain question — expresses intent, keeps callers from poking at fields.
  get isMetric(): boolean {
    return this._unit === 'm' || this._unit === 'kg'
  }

  // Value equality. Compare the underlying values, tolerate null/undefined.
  equals(other: Measurement | null | undefined): boolean {
    return this._value === other?.value && this._unit === other?.unit
  }

  // Serialization: frozen snapshot; `toJSON()` is inherited and returns it.
  get snapshot(): Snapshot {
    return Object.freeze({
      value: this._value,
      unit: this._unit,
    })
  }

  // --- Static factories (use the names your Project Profile §4 specifies) ---

  // Nullable guard: returns null for absent/blank input instead of throwing.
  static make(value?: string | null, unit?: string | null): Measurement | null {
    return value?.trim() && unit?.trim() ? new Measurement({ value, unit }) : null
  }

  // Rehydrate from a persisted snapshot.
  static restore(snapshot: Snapshot): Measurement {
    return new Measurement({ value: snapshot.value, unit: snapshot.unit })
  }
}

// Export the Props alias when other layers construct or persist this VO.
export type MeasurementProps = Props
