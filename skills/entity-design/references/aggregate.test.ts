// Generic Aggregate + Collection test reference (neutral names; not compiled).
//
// Build roots/related entities with BUILDERS (see builder.ts) — never hand-assemble
// an aggregate root inline. No mocks. Cover: root access, cluster getters, mutation
// of lazy fields, and the collection's domain queries.

import { CartBuilder, LineItemBuilder } from '<<fakes-alias>>' // profile §7
import { ObjectId } from '<<value-objects import>>'
import { CartAggregate, LineItemCollection } from './CartAggregate'

describe(CartAggregate.name, () => {
  const CART = CartBuilder.build()
  const ITEMS = LineItemBuilder.buildMany(2)

  it('should expose the root', () => {
    const sut = new CartAggregate({ root: CART, items: ITEMS })

    expect(sut.root).toStrictEqual(CART)
  })

  it('should expose cluster getters', () => {
    const sut = new CartAggregate({ root: CART, items: ITEMS })

    expect(sut.items).toStrictEqual(ITEMS)
    expect(sut.itemCount).toStrictEqual(2)
    expect(sut.appliedCoupon).toBeNull() // default for the lazy field
  })

  it('should set a lazily-loaded field', () => {
    const sut = new CartAggregate({ root: CART, items: ITEMS })

    sut.appliedCoupon = 'SAVE10'

    expect(sut.appliedCoupon).toStrictEqual('SAVE10')
  })
})

describe(LineItemCollection.name, () => {
  const PRODUCT_UID = new ObjectId('PRODUCT_UID')

  it('should find the first item for a product', () => {
    const match = LineItemBuilder.build({ productUid: PRODUCT_UID })
    const other = LineItemBuilder.build() // random product
    const sut = new LineItemCollection([other, match])

    expect(sut.firstForProduct(PRODUCT_UID)).toStrictEqual(match)
  })

  it('should return null when no item matches', () => {
    const sut = new LineItemCollection(LineItemBuilder.buildMany(2))

    expect(sut.firstForProduct(new ObjectId('MISSING'))).toBeNull()
  })

  it('should still behave as an Array', () => {
    const sut = new LineItemCollection(LineItemBuilder.buildMany(3))

    expect(sut).toHaveLength(3)
    expect(sut.find(() => true)).toBeDefined() // inherited Array method (element-returning)
    // Caution: array-RETURNING methods (map/filter/slice) call the species constructor
    // with a length, which breaks a `super(...items)` ctor unless the base Collection
    // overrides Symbol.species — check the project's base before asserting on them.
  })
})
