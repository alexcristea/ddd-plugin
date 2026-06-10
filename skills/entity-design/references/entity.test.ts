// Generic Entity test reference (neutral names; not compiled).
//
// Entities are tested by instantiation — NO mocks. Cover: construction, optional
// defaults, value access, mutation via setters, derived state (table), serialization.
// Build the SUT from a shared `props` object; in OTHER layers' tests prefer a Builder
// (see builder.ts) — here, in the entity's own test, raw construction is fine.

import { ObjectId } from '<<id + value-objects import>>'
import { Order } from './Order'
import { OrderStatus } from './OrderStatus'

describe(Order.name, () => {
  const NOW = new Date('2021-01-01')
  const UID = new ObjectId('UID')
  const CUSTOMER_UID = new ObjectId('CUSTOMER_UID')

  const props = {
    uid: UID,
    customerUid: CUSTOMER_UID,
    total: 100,
    status: OrderStatus.Pending,
    note: 'gift wrap',
    createdAt: NOW,
    modifiedAt: NOW,
  }

  it('should create a new instance', () => {
    const sut = new Order(props)

    expect(sut.uid).toStrictEqual(UID)
    expect(sut.customerUid).toStrictEqual(CUSTOMER_UID)
    expect(sut.total).toStrictEqual(100)
    expect(sut.status).toStrictEqual(OrderStatus.Pending)
  })

  it('should default optional fields', () => {
    const sut = new Order({ uid: UID, customerUid: CUSTOMER_UID, total: 100, createdAt: NOW, modifiedAt: NOW })

    expect(sut.status).toStrictEqual(OrderStatus.Pending) // default
    expect(sut.note).toBeNull() // ?? null
  })

  // Derived state → table test.
  const statuses: [OrderStatus, boolean][] = [
    [OrderStatus.Pending, false],
    [OrderStatus.Paid, true],
    [OrderStatus.Cancelled, false],
  ]
  it.each(statuses)('should compute isPaid when status is %s', (status, expected) => {
    const sut = new Order(props)
    sut.status = status

    expect(sut.isPaid).toStrictEqual(expected)
  })

  it('should serialize to JSON, unwrapping value objects', () => {
    const sut = new Order(props)

    expect(sut.toJSON()).toStrictEqual({
      id: UID.value,
      customerUid: CUSTOMER_UID.value,
      total: 100,
      status: OrderStatus.Pending,
      note: 'gift wrap',
      createdAt: NOW,
      modifiedAt: NOW,
    })
  })

  describe('setters', () => {
    it('should update mutable fields', () => {
      const sut = new Order(props)

      sut.status = OrderStatus.Paid
      sut.note = null

      expect(sut.status).toStrictEqual(OrderStatus.Paid)
      expect(sut.note).toBeNull()
    })
  })
})
