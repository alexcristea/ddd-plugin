# Project Profile — <PROJECT NAME>

> Fill one of these per repository. It captures everything project-specific that the
> generic `SKILL.md` defers to. Copy this file to `.claude/ddd/entity-design.md`
> **in the target repo** and complete every slot. Derive values by reading one
> existing Entity, one Value Object, and one Builder in the target repo.

## 1. Base classes & import paths
| Concept | Base class | Import path / alias | Notes |
|---|---|---|---|
| Entity | `<<Entity>>` + `<<EntityProps>>` | `<<@x/entities>>` | protected ctor? |
| Value Object | `<<ValueObject>>` | `<<@x/value-objects>>` | abstract member? |
| Aggregate | `<<Aggregate<Root>>>` | `<<@x/aggregates>>` | interface or class? |
| Collection | `<<Collection<T>>>` | `<<@x/shared>>` | extends Array? |
- **Abstract base test helper:** `<<TestableValueObject>>` (minimal subclass used to test the base).

## 2. Identity & audit fields
- **Identity field + type:** `<<uid: ObjectId>>` (equality is by this).
- **Audit fields:** `<<createdAt (readonly), modifiedAt (mutable)>>` — or "none".

## 3. Serialization contract
- **Value objects:** `<<abstract get snapshot(); toJSON() delegates>>` | `<<toJSON() only (legacy)>>`.
- **Frozen?** `<<snapshot returns Object.freeze({...})>>`.
- **Entities:** `<<toJSON() unwraps VOs to primitives>>` — and is it `<<@deprecated>>`?
- **Mixed-era note:** `<<which VOs are legacy (no base) vs modern (extends base)>>`.

## 4. Value-object factory & equality conventions
- Nullable guard: `<<static make(x?) → VO | null>>`
- Direct wrapper: `<<static withString(x)>>`
- Rehydrate: `<<static restore(snapshot)>>`
- Equality: `<<equals(other): boolean>>`

## 5. Directory layout & barrels
- **Per-concept dir:** `<<PascalCase dir, class file matches dir name, index.ts re-exports>>`.
- **Top-level barrels:** `<<src/entities/index.ts, src/value-objects/index.ts, src/aggregates/index.ts>>`.
- **Props/Snapshot interfaces:** `<<declared in the class file; Props exported when persisted/built elsewhere>>`.

## 6. Codegen
- **Generator command:** `<<npm run generate (plop) | none>>`.
- **Templates location:** `<<templates/entity, templates/value-object>>`.
- **Generated stub behavior:** `<<ctor throws 'Not implemented'>>`.

## 7. Test-data builders
- **Location:** `<<packages/.../tests/fakes>>`.
- **Cross-package alias:** `<<@fake-data → .../tests/fakes/index.ts (tsconfig paths, NOT a package export)>>`.
- **In-package alias:** `<<~/tests/fakes>>`.
- **API:** `<<Builder<Props, Model>.build(overrides); ManyBuilder.buildMany(n, overrides)>>`.
- **Faker package/version:** `<<@faker-js/faker ^x.y>>`.
- **Composition:** `<<aggregate builders call root builders, e.g. MemberBuilder → UserBuilder>>`.

## 8. Test file placement + naming
- **Placement:** `<<co-located next to source>>`.
- **Suffix:** `<<.test.ts (never .spec.ts)>>`.
- **Suite:** `<<describe(Class.name, …)>>` — use `.name`.
- **Constants:** `<<UPPER_SNAKE_CASE>>`.
- **Tables:** `<<it.each / describe.each over [input, expected]>>`.

## 9. Run command
- Single file: `<<yarn workspace <pkg> test <path>>>` (or from package dir: `<<yarn test <path>>>`).
- Watch / coverage: `<<yarn test:watch / yarn test:coverage>>`.
- Config: `<<preset, testMatch, moduleNameMapper>>`.

## 10. Domain-error hierarchy
- **Base + location:** `<<*Error classes under value-objects/validationErrors | errors/>>`.
- **Usage:** `<<throw typed errors in invariant paths; tests match the type>>`.

## 11. Live exemplars (real files to imitate)
- Value object: `<<path/to/SomeVO.ts (+ .test.ts)>>`
- Entity: `<<path/to/SomeEntity.ts (+ .test.ts)>>`
- Aggregate + collection: `<<path/to/SomeAggregate.ts, SomeCollection.ts>>`
- Builder (+ composed): `<<path/to/SomeBuilder.ts>>`
