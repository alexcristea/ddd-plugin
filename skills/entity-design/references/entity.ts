// Generic Entity reference (neutral names; not compiled).
//
// An Entity has a distinct identity (uid) that persists across field changes, plus a
// lifecycle (createdAt/modifiedAt). Equality is by identity, not value. Fields are
// encapsulated: getters for all, setters only for the mutable ones. Adapt base class
// and serialization to the Project Profile.

import { Entity, EntityProps } from '<<entity-base import>>' // profile §1
import { ObjectId } from '<<id + value-objects import>>'

// Profile-defined enum for a domain status.
import { OrderStatus } from './OrderStatus'

// Props extends the base identity/audit fields. Optional fields use `?` and are
// coalesced to defaults in the constructor.
export interface OrderProps extends EntityProps {
  customerUid: ObjectId
  total: number
  status?: OrderStatus
  note?: string | null
}

export class Order extends Entity {
  private readonly _customerUid: ObjectId // set once → no setter
  private _total: number
  private _status: OrderStatus
  private _note: string | null

  constructor(props: OrderProps) {
    super(props) // initializes uid / createdAt / modifiedAt
    this._customerUid = props.customerUid
    this._total = props.total
    this._status = props.status || OrderStatus.Pending // default-coalesce optionals
    this._note = props.note ?? null
  }

  get customerUid(): ObjectId {
    return this._customerUid
  }

  get total(): number {
    return this._total
  }

  get status(): OrderStatus {
    return this._status
  }
  set status(status: OrderStatus) {
    this._status = status
  }

  get note(): string | null {
    return this._note
  }
  set note(note: string | null) {
    this._note = note
  }

  // Derived domain state.
  get isPaid(): boolean {
    return this._status === OrderStatus.Paid
  }

  // Serialization: unwrap value objects to primitives; include audit fields.
  // (If the profile marks Entity.toJSON @deprecated, still match siblings — don't
  // build new logic on it.)
  toJSON() {
    return {
      id: this.uid.value,
      customerUid: this._customerUid.value,
      total: this._total,
      status: this._status,
      note: this._note,
      createdAt: this._createdAt,
      modifiedAt: this._modifiedAt,
    }
  }
}
