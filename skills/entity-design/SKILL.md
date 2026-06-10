---
name: entity-design
description: Design and unit-test the domain-model layer of a DDD / Clean Architecture project — Entities, Value Objects, Aggregates, Collections, and their test-data Builders, following the project's base-class contracts and conventions. Use when designing, refactoring, or writing unit tests for an entity, value object, aggregate, collection, or builder. Load the project profile from .claude/ddd/entity-design.md in the target repo first; if missing, run ddd:create-profile.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Designing & testing the domain model (DDD / Clean Architecture)

This skill builds and unit-tests the **innermost layer** of a Clean Architecture
codebase — the domain model: **Entities, Value Objects, Aggregates, and
Collections** — plus the **test-data Builders** other layers depend on. It is the
companion to `ddd:usecase-tests`, which sits one layer up (usecases/steps/factories);
this skill owns the objects those usecases manipulate.

The methodology here is generic. Everything that varies per repository — base-class
names and import paths, the serialization contract, factory conventions, where
builders live, the codegen command, file placement, the run command — lives in a
**Project Profile**. Load that first.

---

## 1. When to use / when not

**Use** for:
- Designing or refactoring an **Entity** (identity + lifecycle), **Value Object**
  (immutable value), **Aggregate** (consistency boundary around a root), or
  **Collection** (typed list with domain queries).
- Writing their **unit tests** — these test invariants directly, with **no mocking**.
- Writing or updating the **Builders** (test-data factories / "fakes") that other
  layers import to construct domain objects in their own tests.

**Do not use** for:
- Usecase / interactor / step / domain-factory tests → use **`ddd:usecase-tests`**.
- HTTP-handler, controller, or repository-adapter tests that touch a DB or network.
- Permission / transition **matrix** testing (the `assert*`/`MatrixBuilder` pattern) —
  that is an adjacent permissions concern, owned by `ddd:usecase-tests`.

A domain-model unit test instantiates the real object and asserts on its behavior;
it never mocks a collaborator (there are none — the model has no injected ports).

---

## 2. Step 0 — load the Project Profile

Read the profile that matches the repo **before** designing or testing anything:

1. Look for `.claude/ddd/entity-design.md` in the target repo root. When present,
   it is the source of truth for every project-specific slot referenced below.
2. If it is missing, follow **`ddd:create-profile`** to derive one from the repo
   (one existing Entity, one Value Object, one Builder), confirm ambiguous slots
   with the user, and **write it to `.claude/ddd/entity-design.md` in the target
   repo** — so it is found next time and shared with the team.
3. For a fully worked example of a completed profile, see
   `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/entity-design.md`.

The profile supplies: base-class names + import paths, identity/audit fields, the
serialization contract (`snapshot`/`toJSON`), value-object factory conventions,
directory + barrel layout, the codegen command, builder location + import alias,
test placement/naming, and the run command.

---

## 3. The four building blocks — decision guide

Pick the building block from the object's nature, not its data:

| Ask | If yes → | Why |
|---|---|---|
| Does it have a distinct identity that persists across changes to its fields, and a lifecycle (created, modified)? | **Entity** | Two entities with identical fields are still different things; equality is by `uid`. |
| Is it defined entirely by its values, interchangeable when its values match, and conceptually immutable? | **Value Object** | No identity; equality is by value. Wraps and validates a concept (an email, an id, a money amount). |
| Is it a consistency boundary that owns a **root** entity plus related entities/data that must be loaded and reasoned about together? | **Aggregate** | The root is the only external entry point; the aggregate guarantees the cluster's invariants. |
| Is it a typed list of one of the above that needs **domain query methods**? | **Collection** | A first-class list (e.g. `MemberCollection`) with named lookups, not a bare `T[]`. |

When unsure between Entity and Value Object: if you would ever ask "is this the *same
one* as before?" it is an Entity; if you only ask "are these *equal*?" it is a Value
Object.

---

## 4. Base-class contracts

The profile gives the real names and import paths; the **shapes** are universal.

**Entity** — identity + audit fields, protected constructor, serialization:
```ts
interface EntityProps { uid: <Id>; createdAt: Date; modifiedAt: Date }

abstract class Entity {
  protected readonly _uid: <Id>
  protected readonly _createdAt: Date
  protected _modifiedAt: Date            // mutable: entities change over time
  get uid(): <Id>                        // identity — equality is by this
  get createdAt(): Date
  get modifiedAt(): Date; set modifiedAt(v: Date)
  abstract toJSON(): any                 // serialization (may be @deprecated — check profile)
  protected constructor(props: EntityProps) { /* assigns the three */ }
}
```

**Value Object** — no identity, immutable, serializes via a snapshot:
```ts
abstract class ValueObject {
  abstract get snapshot(): any           // the serializable, frozen shape
  toJSON(): any { return this.snapshot } // delegates to snapshot
}
```

**Aggregate** — a root accessor over a cluster:
```ts
abstract class Aggregate<Root> { abstract get root(): Root }
// concrete: class FooAggregate implements Aggregate<Foo> { get root(): Foo … }
```

**Collection** — a typed Array subclass:
```ts
abstract class Collection<T> extends Array<T> { protected constructor(items: T[]) { super(...items) } }
```

> **Mixed-era caveat (record it in the profile):** older Value Objects may predate the
> `ValueObject` base — they don't `extends ValueObject`, expose `value` + `equals()` +
> their own `toJSON()`, and have no `snapshot`. Newer ones extend `ValueObject` and
> implement `snapshot`. Match whichever the *neighbouring* file uses; don't "upgrade"
> a legacy VO unless asked.

---

## 5. Designing a Value Object

1. Declare a `Props` interface (constructor input) and, when extending the base, a
   `Snapshot` interface (serializable shape — enums become strings).
2. Store fields as `private readonly` (use a non-readonly field only for the rare
   field with a setter, e.g. a status that legitimately transitions).
3. **Normalize / validate in the constructor** — `trim()`, `toLowerCase()`, reject
   invalid input by throwing a domain error (§8). The constructor is the invariant gate.
4. Expose values through getters; add derived getters for domain questions
   (`get isApplicable()`).
5. Implement `get snapshot()` returning `Object.freeze({ … })`; inherit `toJSON()`.
6. Add **static factory methods** for the project's conventions (profile §4) —
   commonly a nullable guard (`make(x?) → VO | null`), a direct constructor wrapper
   (`withString(x)`), and a `restore(snapshot)` for rehydration. Add `equals(other)`
   for value comparison.
7. Export the `Props`/`Snapshot` types if other layers construct or persist the VO.

See `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/value-object.ts`.

## 6. Designing an Entity

1. `interface FooProps extends EntityProps { … }` — base identity/audit fields plus
   domain fields; mark genuinely optional ones `?`.
2. `constructor(props: FooProps) { super(props); … }` — call `super(props)` first,
   then assign domain fields, **coalescing optionals to defaults** (`props.roles || []`,
   `props.status || Status.Pending`, `props.x ?? null`).
3. Private fields with **getters for all, setters only for mutable** fields —
   encapsulation is the boundary. Readonly identity-ish fields get no setter.
4. Add derived getters for domain state (`get isActive()`).
5. Implement `toJSON()` (unwrap value objects to primitives, e.g. `this.uid.value`) —
   unless the profile marks it deprecated/unused.

See `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/entity.ts`.

## 7. Designing an Aggregate / Collection

- **Aggregate:** `class FooAggregate implements Aggregate<Foo>`. Take a `{ root, … }`
  props object; hold the root and related entities/data as `private readonly`
  (a lazily-loaded field like file `contents` may be mutable). Expose `get root()` and
  getters for the cluster; keep behavior thin — it composes, it doesn't re-implement
  entity logic.
- **Collection:** `class FooCollection extends Collection<Foo>`, `super(items)` in the
  constructor, then add named domain queries (`firstMemberWithRole(roles)`) on top of
  the inherited `Array` methods. Return `null`/`undefined` per the project's nullable
  convention, not a thrown error, for "not found".

See `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/aggregate.ts`.

## 8. Validation & domain errors

- **Cheap normalization / invariants** live in the constructor (trim, lowercase,
  range checks) and throw on violation.
- **Structured failures** use the project's **domain-error classes** (a `*Error`
  hierarchy), never bare `throw new Error('msg')` in business-meaningful paths — so
  callers and tests can match the type. The profile names the hierarchy and where it
  lives. Tests assert with `rejects/toThrow(new SpecificError(...))`.

## 9. Scaffolding a new entity / value object

If the project has codegen (profile §6 — e.g. plop: `<<run command>>`), use it: it
creates the concept directory, the class file, the colocated test, the per-concept
`index.ts`, and appends to the top-level barrel. The generated class throws
`Not implemented` from the constructor — replace that with the real design (§5/§6).

Otherwise follow the conventions by hand (profile §5): one PascalCase directory per
concept, the class file named after it, a per-concept `index.ts` re-exporting the
class (and its enums/types), and a line added to the layer's top-level barrel.

## 10. Unit-testing the model

The recipe (no mocks — instantiate the real object):

1. **Co-locate** the test (`Foo.ts` → `Foo.test.ts`, profile §8) and name the suite
   `describe(Foo.name, …)` — use `.name`, not a string literal.
2. **Constants** in `UPPER_SNAKE_CASE` (ids, dates, primitives). Build a shared `props`
   object for entities; pass inline literals for VOs.
3. **Construction** — assert each field is read back correctly.
4. **Normalization / defaults** — assert the constructor trimmed/lowercased/defaulted
   (e.g. omit an optional, expect its default).
5. **Value equality** (VOs) — equal-by-value with `toEqual`; assert `equals()` both ways.
6. **Serialization** — assert `snapshot` (frozen shape) and that `toJSON()` deep-equals
   it; for entities assert `toJSON()` unwraps value objects to primitives
   (`toStrictEqual({ id: UID.value, … })`).
7. **State mutation** — set a mutable field via its setter, assert the getter reflects it.
8. **State-dependent logic** — drive derived getters / branching with
   `it.each([...])` / `describe.each([...])` over `[input, expected]` tuples.
9. **Abstract base** — to test the base class itself, subclass it with a minimal
   `TestableX` (profile names it) that supplies the abstract member, then assert the
   base behavior.
10. **Entities/Aggregates in tests** — prefer **Builders** (§11) to construct them
    (especially aggregate roots); reserve raw `new Foo(props)` for the entity's own test.
11. **Run & iterate** — run the test file with the profile §9 command and iterate until
    green. For new behavior, write the failing test first (TDD), then implement §5/§6.

Use `toStrictEqual` for value/shape equality and `it.each`/`describe.each` for tables.
See `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/{value-object,entity,aggregate}.test.ts`.

## 11. Builders — test-data "mocks" for other layers

Domain objects are constructed in tests through **Builders** (a.k.a. fakes): object
literals that fill sensible faker-random defaults and accept partial overrides. This
is what the user means by "mocks used by other layers" — usecase/handler/repository
tests across the monorepo import these instead of hand-assembling entities.

Contract (profile §7 names the file + alias):
```ts
interface Builder<Props, Model>      { build(overrides?: Partial<Props>): Model }
interface ManyBuilder<Props, Model> extends Builder<Props, Model> {
  buildMany(count: number, overrides?: Partial<Props>): Model[]
}
```

Canonical implementation — defaults object, override-merge, real constructor:
```ts
export const FooBuilder: ManyBuilder<FooProps, Foo> = {
  build: (model) => {
    const storage: FooProps = { /* every field, faker defaults */ }
    return new Foo({ ...storage, ...model })   // overrides win
  },
  buildMany: (n, overrides) => [...Array(n)].map(() => FooBuilder.build(overrides)),
}
```

Rules:
- **One builder per entity / aggregate / value object** that other tests need.
- **Defaults come from faker**; capture `const NOW = new Date()` once so timestamps
  don't drift within a build.
- **Compose** builders for nested objects (an aggregate builder calls its root's
  builder: `root: UserBuilder.build()`), overridable via the override-merge.
- **In a test, override only the fields the test asserts on** — leave the rest random
  so the test states its intent.
- Add the builder to the fakes **barrel** and consume it through the project's alias
  (profile §7 — e.g. `@fake-data` cross-package, a local `~/tests/fakes` in-package).

See `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/builder.ts`.

## 12. Condensed skeletons

Replace `<<…>>` with profile values.

**Value Object**
```ts
import { ValueObject } from '<<vo-base>>'
interface Props { value: string }
interface Snapshot { value: string }
export class <<Foo>> extends ValueObject {
  private readonly _value: string
  constructor(params: Props) { super(); this._value = params.value.trim() }   // normalize
  get value() { return this._value }
  equals(other: <<Foo>> | null) { return this._value === other?.value }
  get snapshot(): Snapshot { return Object.freeze({ value: this._value }) }
  static make(v?: string | null) { return v?.trim() ? new <<Foo>>({ value: v }) : null }
}
export type <<Foo>>Props = Props
```

**Entity**
```ts
import { Entity, EntityProps } from '<<entity-base>>'
export interface <<Foo>>Props extends EntityProps { name: string; status?: <<Status>> }
export class <<Foo>> extends Entity {
  private _name: string
  private _status: <<Status>>
  constructor(props: <<Foo>>Props) {
    super(props)
    this._name = props.name
    this._status = props.status || <<Status>>.Default
  }
  get name() { return this._name }; set name(v: string) { this._name = v }
  get status() { return this._status }; set status(v: <<Status>>) { this._status = v }
  get isActive() { return this._status === <<Status>>.Active }
  toJSON() { return { id: this.uid.value, name: this._name, status: this._status,
                      createdAt: this._createdAt, modifiedAt: this._modifiedAt } }
}
```

**Value Object test**
```ts
import { <<Foo>> } from './<<Foo>>'
describe(<<Foo>>.name, () => {
  it('should normalize on construction', () => {
    expect(new <<Foo>>({ value: '  x  ' }).value).toStrictEqual('x')
  })
  it('should serialize to its snapshot', () => {
    const sut = new <<Foo>>({ value: 'x' })
    expect(sut.snapshot).toStrictEqual({ value: 'x' })
    expect(sut.toJSON()).toStrictEqual(sut.snapshot)
  })
  it('should compare by value', () => {
    expect(new <<Foo>>({ value: 'x' }).equals(new <<Foo>>({ value: 'x' }))).toBe(true)
  })
})
```

**Entity / Aggregate test**
```ts
import { <<FooBuilder>> } from '<<fakes-alias>>'
import { <<Foo>> } from './<<Foo>>'
describe(<<Foo>>.name, () => {
  const NOW = new Date('2021-01-01')
  const UID = new <<Id>>('UID')
  const props = { uid: UID, name: 'NAME', createdAt: NOW, modifiedAt: NOW }

  it('should create a new instance', () => {
    const sut = new <<Foo>>(props)
    expect(sut.uid).toStrictEqual(UID)
    expect(sut.name).toStrictEqual('NAME')
  })

  const cases: [<<Status>>, boolean][] = [ /* [input, expected] */ ]
  it.each(cases)('should compute isActive when status is %s', (status, expected) => {
    const sut = new <<Foo>>(props); sut.status = status
    expect(sut.isActive).toStrictEqual(expected)
  })
})
```

## 13. Reference files

Generic, library-neutral templates (read first):
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/value-object.ts` / `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/value-object.test.ts`
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/entity.ts` / `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/entity.test.ts`
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/aggregate.ts` / `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/aggregate.test.ts`
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/builder.ts`

Project profile (owned by `ddd:create-profile`):
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/entity-design.md` — blank fill-in template (the portability seam).
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/entity-design.md` — a fully worked profile (`@audora/entities`).

Worked examples for the Audora profile (real files, `.txt`-suffixed):
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/examples/audora/ObjectId.ts.txt` / `.test.ts.txt` — legacy scalar VO + table tests.
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/examples/audora/ExternalEvidence.ts.txt` / `.test.ts.txt` — `ValueObject` with `snapshot`.
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/examples/audora/User.ts.txt` / `.test.ts.txt` — entity + serialization & `describe.each`.
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/examples/audora/Member.ts.txt` / `MemberCollection.ts.txt` — aggregate + collection.
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/examples/audora/FileAggregate.test.ts.txt` — builder-driven aggregate test.
- `${CLAUDE_PLUGIN_ROOT}/skills/entity-design/references/examples/audora/UserBuilder.ts.txt` / `MemberBuilder.ts.txt` — builder + composed builder.

When working in a profiled repo, also open 1–2 real, recent files named in the profile's exemplar list as live patterns to imitate.
