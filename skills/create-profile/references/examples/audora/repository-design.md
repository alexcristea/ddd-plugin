# Project Profile — Audora (`@audora/backend`)

Repositories at `packages/backend/src/repository/`. Kysely-based ports-&-adapters
over Postgres (AWS RDS Data API). Apply this profile when adding or changing a
repository under that folder.

## 0. Scope
- Repositories live in `packages/backend/src/repository/Postgres<Name>Repository/`.
- Query-builder library: **Kysely** (RDS Data API dialect via `kysely-data-api`).
- One repo folder = `*QueryBuilder.ts`, `*QueryRunner.ts`, `*Mapper.ts`, `Postgres*Repository.ts`, `index.ts`.
- Cross-cutting code lives in `packages/backend/src/repository/shared/` (barrel: `../shared`).

## 1. The port (boundary interface)
- Interfaces named `*Repository`, in `packages/core/src/boundaries` (imported via `@core/boundaries`).
- Read methods take a single `*RetrieveCriteria`; writes take aggregates/entities.
- Typical method set: `save`, `saveMany`, `retrieveOne`, `retrieveMany`, `delete`, sometimes `countMany` / `retrieve(uid)`.
- Example: `MembersRepository` → `save / saveMany / retrieveOne / retrieveMany / delete`.

## 2. The four collaborators + naming
| Layer | Class / file | Notes |
|---|---|---|
| QueryBuilder | `FooQueryBuilder.ts` | extends a §4 base; pure Kysely query objects, no `.execute()` |
| QueryRunner | `FooQueryRunner.ts` | `implements FoosRepository`; build → run/execute → map |
| Mapper | `FooMapper.ts` | `static fromRow` / `static toRow` (+ `fromCountRow` when counting) |
| Repository | `PostgresFoosRepository.ts` | `extends FooQueryRunner`; constructs builder(s) + `queryRunner()` and calls `super(...)` |
| barrel | `index.ts` | `export * from './PostgresFoosRepository'` |
- **File casing — canonical: PascalCase** (`FooQueryBuilder.ts`). The repo has a
  few legacy camelCase folders (e.g. `controlToEvidenceRequestQueryBuilder.ts`) —
  do **not** copy that; new files are PascalCase.
- Repository class is singular-or-plural per the port (`PostgresMembersRepository`,
  `PostgresFilesRepository`); match the existing neighbours.
- Optional logging variant: `index.ts` may also export
  `Logging<Name>Repository = decorateClassWithLogger(Postgres<Name>Repository, {…}, [])`
  from `@backend/shared` — add it only if neighbours have it.

## 3. Criteria types
- Defined in `packages/core/src/boundaries` (e.g. `MembersRepository.ts`, `shared.ts`); named `*RetrieveCriteria`.
- **Plain partial** (most repos): `export type FoosRetrieveCriteria = Partial<{ uids: ObjectId[]; companyUids: ObjectId[]; … }>`.
- **Discriminated status filter** in `boundaries/shared.ts`:
  ```ts
  interface InStatusFilter<S>    { inStatus: S[];  notInStatus?: never }
  interface NotInStatusFilter<S> { inStatus?: never; notInStatus: S[] }
  type RetrieveCriteria<S, Props> = Partial<Props> & Partial<StatusFilter<S>>
  ```
  Used by e.g. `FilesRetrieveCriteria = RetrieveCriteria<FileStatus, FilePropsFilter>`.
- Pagination: `PaginationOptions { offset: number; limit: number }` from `@core/boundaries`.

## 4. Base query-builder classes (the duplication seam)
- Abstract base: `BaseQueryBuilder<DB extends object, Table extends keyof DB>` in `shared/BaseQueryBuilder.ts`.
  Provides (all `protected`): `_setWhereInArray`, `_setWhereNotInArray`,
  `_setWhereInObjectIds`, `_setWhereNotInObjectIds`, `_setWhereJsonInArray`
  (`@>` JSON-contains), `_setQueryPaginationOptions`, `_setOrderBy`. Declares
  abstract `_setEmptyList(query)`.
- Three-state semantics baked into the helpers: `undefined` → query unchanged;
  `[]` → `_setEmptyList`; non-empty → `where col in (...)`.
- Id-table subclass: `BaseIdTableQueryBuilder<Table extends keyof TablesWithIds<Schema>>`
  in `shared/BaseIdTableQueryBuilder.ts` — implements `_setEmptyList` as
  `query.where('id', 'is', null)`. **Extend this for single-table (`id`-keyed) builders** (e.g. `FilesQueryBuilder extends BaseIdTableQueryBuilder<'files'>`).
- **Joined builders** extend `BaseQueryBuilder<Schema, 'foos' | 'bars'>` directly and
  write their own sentinel (e.g. `MemberQueryBuilder` joins `users` and uses
  `where('engagement_id', 'is', null)`).
- `_setWhereInObjectIds` unwraps `ObjectId` → `id.value` then delegates to `_setWhereInArray`.

## 5. Shared QueryRunner (execution + mapping)
- `QueryRunner` class in `shared/QueryRunner.ts`. Methods:
  - `runMany(query, rowToEntity)` → `Entity[]`
  - `runOne(query, rowToEntity, value?)` → mapped entity, else `value ?? null`
  - `runOneWithDefault(query, rowToEntity, value)` → mapped entity, else `value`
  - `execute(query)` → raw rows; `executeOne(query)` → first row (**`@deprecated`** — prefer `execute`)
  - `executeBatches(builder, batches)` for chunked work
- Construct via the `queryRunner()` factory (also `@deprecated` but still used by every repo) or `new QueryRunner()`.
- Concrete runner ctor: `constructor(fooQueryBuilder: FooQueryBuilder, queryRunner: QueryRunner)` (add sibling builders for aggregate writes, e.g. `MemberQueryRunner` also takes `UserQueryBuilder`).

## 6. Shared utilities (`../shared`)
- `rowWithJSONFields(row, ['labels', …])` → wraps fields in ``sql`cast(${v} as jsonb)` ``. Use in every `buildSave*Query` that writes a json column.
- `makeBatches(arr, CHUNK_SIZE)` + `CHUNK_SIZE = 500` (`shared/utils.ts`) for `saveMany`.
- `mapRowNullable` / `mapNullable` (NULL→`undefined`) in `shared/commonMappers.ts`; `mapNullableColumnToObjectId`; `stringToObjectIdArray`, `stringArrayToObjectIdArray`.
- Everything above + `expectQuery`, `dummyDb` are re-exported from `shared/index.ts` (`../shared`).

## 7. Schema / row types
- `packages/backend/src/repository/schema.ts` exports the `Schema` interface (one entry per table) consumed as `Kysely<Schema>`.
- Per table: `type FooTable = { … }`, `export type FooRow = Selectable<FooTable>`, `export type NewFooRow = Insertable<FooTable>`.
- Column helpers: `JSONColumnType<T>` (json columns), `DateColumn = ColumnType<Date, Date, Date>`, `Nullable<T>` from `@entities/value-objects`.
- Aggregates: `type FooAggregateTable = FooTable & { bar: BarRow }`,
  `export type FooAggregateRow = Selectable<FooAggregateTable>`,
  `export type NewFooAggregateRow = { foo: NewFooRow; bar: NewBarRow }`. Aggregate
  selects use ``sql<BarRow>`row_to_json(bars)`.as('bar')`` after an `innerJoin`.

## 8. Test helpers
- **SQL assertion:** `expectQuery(query).toStrictEqual(SQL\`…\`)` (`shared/expectQuery.ts`). It `.compile()`s the query, normalizes whitespace, rewrites `:1`/`:2` → `?`, and separately asserts the parameter bindings (Dates → ISO with `T`/`Z` stripped). Whitespace-insensitive, so format the expected SQL for readability.
- **Expected SQL:** `import SQL from 'sql-template-strings'` — interpolate bound values with `${...}` (use `id.value`, not the `ObjectId`).
- **Dummy DB:** `dummyDb` (`shared/makeDummyDb.ts`) — a `Kysely<Schema>` on the RDS Data API dialect with empty creds; **never connects**. Construct builders with it: `new FooQueryBuilder(dummyDb)`.
- **Mocks:** `jest-mock-extended` — `mock<FooQueryBuilder>()`, `mock<QueryRunner>()`, reset with `mockReset(x)` in `afterEach`.

## 9. Test-data builders / fixtures
- Entity/aggregate builders from `@fake-data` (also seen as `@fakes`): `UserBuilder`, `MemberBuilder`, `IntegrationBuilder`, … `XBuilder.build({ overrides })`; many have `buildMany(n, overrides)`. Faker-backed defaults.
- Builder tests author rows inline with a local `function makeFooRow(): NewFooRow { … }` using `@faker-js/faker` (`faker.datatype.uuid()`, `new Date()`).
- Constants in `UPPER_SNAKE_CASE` (`const USER_UID = new ObjectId('USER_UID')`).

## 10. Import aliases / module map
| Alias | Resolves to | Holds |
|---|---|---|
| `@core/boundaries` | `packages/core/src/boundaries` | `*Repository` ports, `*RetrieveCriteria`, `PaginationOptions` |
| `@core/errors` | `packages/core/src/errors` | `NotImplementedError`, … |
| `@entities/entities` | `packages/entities/src/entities` | enums + entities (`MemberRole`, `UserStatus`, …) |
| `@entities/aggregates` | `packages/entities/src/aggregates` | aggregates (`Member`, …) |
| `@entities/value-objects` | `packages/entities/src/value-objects` | `ObjectId`, `Nullable`, `OptionalPromise` |
| `../schema` | `repository/schema.ts` | `Schema`, `*Row`, `New*Row` |
| `../shared` | `repository/shared/index.ts` | base classes, `QueryRunner`/`queryRunner`, `expectQuery`, `dummyDb`, `rowWithJSONFields`, mappers |
| `@fake-data` / `@fakes` | entity fakes | builders |
| `@backend/shared` | backend shared | `decorateClassWithLogger`, method loggers |

## 11. Run command
- Single file: `yarn workspace @audora/backend test <relative path>` (or from `packages/backend`: `yarn test <path>`).
- Watch: `yarn test:watch`; coverage: `yarn test:coverage`.
- Config: `preset: ts-jest`, `testMatch: ["**/*.test.ts"]` (never `.spec.ts`), `moduleNameMapper` per §10.

## 12. Live exemplars (real files to imitate)
- Single id-table + status filter: `repository/PostgresFilesRepository/FilesQueryBuilder.ts` (+ `.test.ts`), `FilesQueryRunner.ts`, `FileMapper.ts`.
- Aggregate / joined (writes parent + child, `row_to_json`): `repository/PostgresMembersRepository/*` (`MemberQueryBuilder.ts`, `MemberQueryRunner.ts`, `MemberMapper.ts`, `PostgresMembersRepository.ts`).
- Interface-variant repository (no subclassing): `repository/PostgresUsersRepository/BackofficeUsersRepository.ts`.
- Base-class behavior (the three-state helpers, sentinel): `repository/shared/BaseQueryBuilder.test.ts`, `BaseIdTableQueryBuilder.test.ts`.
- Runner interaction tests: `repository/PostgresIntegrationsRepository/IntegrationQueryRunner.test.ts`.
