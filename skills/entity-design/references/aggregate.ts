// Generic Aggregate + Collection reference (neutral names; not compiled).
//
// AGGREGATE: a consistency boundary around a ROOT entity plus related entities/data
// that are loaded and reasoned about together. The root is the only external entry
// point. It `implements Aggregate<Root>` (it does NOT extend Entity). Composition is
// mostly readonly; behavior is thin — it composes, it doesn't re-implement the root's
// logic.
//
// COLLECTION: a first-class typed list (extends Array<T>) that adds named domain
// queries on top of the inherited Array methods.

import { Aggregate } from '<<aggregate-base import>>' // profile §1
import { Collection } from '<<collection-base import>>'
import { ObjectId } from '<<value-objects import>>'

// --- the root entity and a related entity are imported from the entities layer ---
import { Cart } from '<<entities import>>'
import { LineItem } from '<<entities import>>'

interface Props {
  root: Cart
  items: LineItem[]
  // A lazily-loaded field may be mutable + nullable until populated.
  appliedCoupon?: string | null
}

export class CartAggregate implements Aggregate<Cart> {
  private readonly _root: Cart
  private readonly _items: LineItem[]
  private _appliedCoupon: string | null

  constructor(props: Props) {
    this._root = props.root
    this._items = props.items
    this._appliedCoupon = props.appliedCoupon ?? null
  }

  // Required by Aggregate<Cart>.
  get root(): Cart {
    return this._root
  }

  get items(): LineItem[] {
    return this._items
  }

  get appliedCoupon(): string | null {
    return this._appliedCoupon
  }
  set appliedCoupon(coupon: string | null) {
    this._appliedCoupon = coupon
  }

  // Thin aggregate behavior that spans the cluster.
  get itemCount(): number {
    return this._items.length
  }
}

// --- Collection ---

export class LineItemCollection extends Collection<LineItem> {
  constructor(items: LineItem[]) {
    super(items) // Collection's protected ctor spreads into the Array
  }

  // Named domain query. Return null (project nullable convention) for "not found",
  // not a thrown error.
  firstForProduct(productUid: ObjectId): LineItem | null {
    return this.find((item) => item.productUid.equals(productUid)) ?? null
  }
}
