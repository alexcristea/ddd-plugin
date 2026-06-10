// Generic Builder reference (neutral names; not compiled).
//
// Builders ("fakes") are the test-data factories that EVERY layer imports to construct
// domain objects in its tests — instead of hand-assembling them. They fill sensible
// faker-random defaults and accept partial overrides. This is the "mock used by other
// layers" for the domain model.
//
// The contract (define once, profile §7 names the file + alias):
//
//   interface Builder<Props, Model>      { build(overrides?: Partial<Props>): Model }
//   interface ManyBuilder<Props, Model> extends Builder<Props, Model> {
//     buildMany(count: number, overrides?: Partial<Props>): Model[]
//   }

import { faker } from '<<faker import>>' // profile §7 — match the installed major version's API
import { ManyBuilder } from '<<Builder contract import>>'
import { ObjectId } from '<<value-objects import>>'
import { Order, OrderProps } from '<<entities import>>'
import { OrderStatus } from '<<entities import>>'

export const OrderBuilder: ManyBuilder<OrderProps, Order> = {
  build: (model) => {
    // Capture `now` once so timestamps in a single build don't drift.
    const NOW = new Date()

    // Full defaults object, typed as Props so missing/renamed fields fail to compile.
    const storage: OrderProps = {
      uid: new ObjectId(faker.datatype.uuid()), // v7; v8+: faker.string.uuid()
      customerUid: new ObjectId(faker.datatype.uuid()), // v7; v8+: faker.string.uuid()
      total: faker.datatype.number({ min: 1, max: 1000 }), // v7; v8+: faker.number.int({ … })
      status: OrderStatus.Pending,
      note: null,
      createdAt: NOW,
      modifiedAt: NOW,
    }

    // Overrides win — the test pins ONLY the fields it asserts on.
    return new Order({ ...storage, ...model })
  },

  buildMany: (number, overrides) => {
    return [...Array(number)].map(() => OrderBuilder.build(overrides))
  },
}

// --- Composition: an aggregate/related builder calls its dependency's builder ---
//
// import { CartBuilder } from './CartBuilder'
// import { LineItemBuilder } from './LineItemBuilder'
//
// export const CartAggregateBuilder: Builder<CartAggregateProps, CartAggregate> = {
//   build: (model) =>
//     new CartAggregate({
//       root: CartBuilder.build(),          // default nested object, fully overridable
//       items: LineItemBuilder.buildMany(2),
//       ...model,
//     }),
// }
//
// Usage in any layer's test:
//   const order = OrderBuilder.build({ status: OrderStatus.Paid }) // override what matters
//   const orders = OrderBuilder.buildMany(3)                        // many at once
//
// Remember to add the builder to the fakes barrel (e.g. tests/fakes/index.ts) so it's
// reachable through the project's alias (profile §7).
