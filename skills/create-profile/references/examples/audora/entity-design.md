# Project Profile — Audora (`@audora/entities`)

Domain-model layer at `packages/entities/src/`. Pure objects — no injected ports, no
DB/network. Apply this profile when designing or unit-testing entities, value objects,
aggregates, collections, or their builders under `packages/entities/`. (Usecases that
consume these live in `@audora/core` → use `ddd:usecase-design`.)

## 1. Base classes & import paths
| Concept | Base class | Import path / alias | Notes |
|---|---|---|---|
| Entity | `Entity` + `EntityProps` | `@entities/entities` (`src/entities/Entity/Entity.ts`) | **protected** ctor; subclass calls `super(props)`. |
| Value Object | `ValueObject` | `@entities/value-objects` (`src/value-objects/ValueObject/ValueObject.ts`) | `abstract get snapshot(): any`; `toJSON()` delegates. |
| Aggregate | `Aggregate<Root>` | `@entities/aggregates` (`src/aggregates/Aggregate.ts`) | abstract class, one member `get root(): Root`; concretes `implements` it. |
| Collection | `Collection<T>` | `@entities/shared` (`src/shared/Collection.ts`) | `extends Array<T>`; protected ctor `super(...items)`. |
- **Abstract base test helper:** `TestableValueObject` (`src/value-objects/ValueObject/TestableValueObject.ts`) — minimal subclass returning injected data as `snapshot`; used by `ValueObject.test.ts`.
- `src/shared/Object.ts` provides `KeyPaths<T>` / `getValueAtKeyPath` deep-navigation utils (rarely needed in new VOs/entities).

## 2. Identity & audit fields
- **Identity:** `uid: ObjectId` (from `@entities/value-objects`). Entity equality is by `uid`.
- **Audit:** `createdAt: Date` (readonly), `modifiedAt: Date` (mutable, has setter). Both live on `EntityProps`.
- Aggregates may carry their own `uid` + audit fields (e.g. `Member`) **in addition** to wrapping a root entity — they don't extend `Entity`, they `implements Aggregate<Root>`.

## 3. Serialization contract
- **Modern VOs** (`extends ValueObject`, e.g. `ExternalEvidence`, `Email`): implement `get snapshot()` returning `Object.freeze({ … })` (enums serialized as their string values); `toJSON()` is inherited and returns the snapshot. Test both: `expect(sut.snapshot).toStrictEqual({…})` and `expect(sut.toJSON()).toStrictEqual(sut.snapshot)`.
- **Legacy VOs** (predate the base, e.g. `ObjectId`): do **not** `extends ValueObject`; expose `value`, `toString()`, `equals()`, and their own `toJSON()`; **no** `snapshot`. Don't "upgrade" them unless asked — match the neighbouring file.
- **Entities:** `toJSON()` unwraps value objects to primitives (`id: this.uid.value`, `companyUid: this._companyUid.value`) and includes `createdAt`/`modifiedAt`. **Note:** `Entity.toJSON()` is marked `@deprecated` ("will be removed") — implement it to match siblings, but don't build new logic on it.

## 4. Value-object factory & equality conventions
- Nullable guard: `static make(uid?: Nullable<string>): Nullable<ObjectId>` — returns `null` for null/empty/whitespace, else `new`.
- Direct wrapper: `static withString(uid: string)`.
- Rehydrate from snapshot: `static restore(snapshot)` (seen on `ExternalEvidenceSource`).
- Equality: `equals(other: Nullable<T>): boolean` comparing the underlying value.
- `Nullable<T>` comes from `@entities/value-objects` (`value-objects/types.ts`).

## 5. Directory layout & barrels
- **Per-concept dir:** `src/{entities,value-objects,aggregates}/<PascalCase>/` containing `<PascalCase>.ts`, its `<PascalCase>.test.ts`, related enums/types (`UserRole.ts`, `types.ts`), and an `index.ts` re-exporting them (`export * from './User'`).
- **Top-level barrels:** `src/entities/index.ts`, `src/value-objects/index.ts`, `src/aggregates/index.ts` each `export *` every concept dir. `value-objects/index.ts` also exports `./ValueObject`, `./validationErrors`, `./types`.
- **Props/Snapshot:** declared in the class file (`interface Props`, `interface Snapshot`); export the alias (`export type ExternalEvidenceProps = Props`) when other layers build/persist it.

## 6. Codegen
- **Command:** `npm run generate` (plop; `plopfile.mjs`). Two generators: `entity`, `value-object`.
- **Templates:** `templates/entity/*.hbs`, `templates/value-object/*.hbs` (+ `export-entity.ts.hbs` / `export-value-object.ts.hbs` appended to the top-level barrel). Generates the dir, class, colocated `.test.ts`, and `index.ts`.
- **Generated stub:** the class constructor `throw new Error('Not implemented')` — replace with the real design.

## 7. Test-data builders
- **Location:** `packages/entities/tests/fakes/` (each `*Builder.ts`, barrelled in `tests/fakes/index.ts`).
- **In-package alias:** `~/tests/fakes` (jest `moduleNameMapper` `^~/tests/(.*)` → `<rootDir>/tests/$1`). Used by entity/aggregate tests *inside* this package (e.g. `FileAggregate.test.ts` imports `FileBuilder` from `~/tests/fakes`).
- **Cross-package alias:** `@fake-data` → `../entities/tests/fakes/index.ts`, configured in each consumer's `tsconfig.json` paths (`packages/core`, `packages/backend`, `packages/shared`). **Not** a package subpath export — `package.json` has no `exports` field; the fakes are reached purely via tsconfig/jest path aliases.
- **API:** object literals typed `Builder<Props, Model>` / `ManyBuilder<Props, Model>` — `build(overrides?)`, `buildMany(n, overrides?)`. Pattern: a `storage: Props` defaults object, then `new Model({ ...storage, ...model })`.
- **Faker:** `@faker-js/faker ^7.6.0` (v7 API — `faker.datatype.uuid()`, `faker.name.fullName()`, `faker.internet.email()`, `faker.system.fileName()`; note v7 spellings, not v8+).
- **Composition:** aggregate builders call root builders — `MemberBuilder` sets `root: UserBuilder.build()`.
- Builders import entities via `@entities/*` aliases and live outside `src/`, so they're excluded from coverage (`coveragePathIgnorePatterns`).

## 8. Test file placement + naming
- **Placement:** co-located next to the source file in the same dir.
- **Suffix:** `.test.ts` (never `.spec.ts`).
- **Suite:** `describe(SomeClass.name, () => { … })` — use `.name`, not a string.
- **Constants:** `UPPER_SNAKE_CASE` (`const UID = new ObjectId('uid')`, `const DATE = new Date('2024-01-31')`); a shared `props` object for entities.
- **Tables:** `it.each([[input, expected], …])('… when %s', …)` for state-dependent getters (see `User.test.ts` `isActive`, `ExternalEvidence.test.ts` `isApplicable`). `describe.each` for grouping scenarios.
- **Equality:** `toStrictEqual` for value/shape; `toEqual` for structural VO equality; assert `equals()` directly too.

## 9. Run command
- Single file: from `packages/entities/` run `yarn test <relative path>` (script is `jest ./src`); from root `yarn workspace @audora/entities test <path>`.
- Watch: `yarn test:watch`. Coverage (includes `tests/`): `yarn test:coverage`. Silent: `yarn test:silent`.
- Config (`jest.config.json`): `preset: ts-jest`, `testMatch: ["**/*.test.ts"]`, `modulePaths: ["<rootDir>/src/"]`, `moduleNameMapper` `@entities/*`, `~/tests/*`, `@core/*`, `@fakes`.

## 10. Domain-error hierarchy
- Lives under `src/value-objects/validationErrors/` → `mappingErrors` + `templateErrors`. Base `TemplateError implements Error` (`name`, `message`), `GenericTemplateError extends TemplateError`; error names are enums (`TemplateErrorName`).
- Use typed error classes (not bare `throw new Error('msg')`) for business-meaningful invariant failures so callers/tests can match the type. Most entities/VOs normalize cheaply in the constructor; reach for the hierarchy only for structured, caller-handled failures.

## 11. Live exemplars (real files to imitate)
- **Value object (modern, snapshot):** `src/value-objects/ExternalEvidence/ExternalEvidence.ts` (+ `.test.ts`); also `src/value-objects/Email/Email.ts`.
- **Value object (legacy scalar):** `src/value-objects/ObjectId/ObjectId.ts` (+ `.test.ts`) — `make`/`withString`/`equals`, table tests.
- **Entity:** `src/entities/User/User.ts` (+ `.test.ts`) — defaults coalescing, `isActive`, `toJSON`, `describe.each`/`it.each`.
- **Aggregate + collection:** `src/aggregates/Member/Member.ts`, `src/aggregates/Member/MemberCollection.ts`; minimal aggregate `src/aggregates/FileAggregate/FileAggregate.ts` (+ `.test.ts`, builder-driven).
- **Builder (+ composed):** `tests/fakes/UserBuilder.ts`, `tests/fakes/MemberBuilder.ts` (composes `UserBuilder`).
