---
name: repository-design
description: Design and test persistence repositories (the adapter layer of ports-&-adapters / Clean Architecture) on a SQL query builder. Decouple query construction from execution, drive queries from a Criteria object at the boundary, remove duplication with base query-builder classes, map rows ↔ domain entities, and test the generated SQL against an expected raw query. Use when adding or changing a repository, query builder, query runner, or mapper.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Designing & testing repositories (ports-&-adapters)

This skill builds and tests the **persistence adapter** that implements a domain
**repository port**. It teaches a layering that keeps SQL construction separate
from SQL execution, drives every query from a typed **Criteria** object, and
verifies the generated SQL with a string-level assertion — no real database.

It is the persistence-layer member of a skill family: **`ddd:entity-design`**
(the domain entities a Mapper produces) and **`ddd:usecase-design`** (the
application layer that calls the port). It does **not** design entities, test
usecases, or test HTTP handlers — defer those to the sibling skills.

The methodology here is generic. Everything that varies per repository — base
class names, the SQL-assertion helper, the dummy DB, import aliases, where
Criteria types and builders live, file naming — lives in a **Project Profile**.
Load that first (§3).

---

## 1. When to use / when not

**Use** for designing or testing:
- A **repository adapter** that implements a port interface (`*Repository`) over a SQL query builder (Kysely, Knex, etc.).
- Its **query builder** (pure SQL construction), **query runner** (execution + mapping), and **mapper** (row ↔ entity).

**Do not use** for:
- Usecase / step / factory unit tests → use **`ddd:usecase-design`**.
- Entity / value-object invariant tests (no persistence).
- Tests that hit a real database or run migrations (these are integration tests; this skill mocks the DB entirely).

---

## 2. The repository pattern (foundation)

A repository is split into **four collaborators** plus a barrel export. Read an
existing repository folder and identify each before writing anything.

| Layer | File (profile names the casing) | Responsibility | Touches the DB? |
|---|---|---|---|
| **QueryBuilder** | `FooQueryBuilder` | Turns a **Criteria** (or primitives) into query-builder objects (`select`/`insert`/`update`/`delete`). Extends a shared base class for `where`/pagination/ordering helpers. | **No** — returns un-executed query objects |
| **QueryRunner** | `FooQueryRunner` | Implements the repository **port**. Calls the builder, hands the query to the shared runner to execute, maps rows via the Mapper. Orchestrates multi-step writes. | Indirectly (via shared runner) |
| **Mapper** | `FooMapper` | Static `fromRow` (row → domain entity) and `toRow` (entity → row). JSON (de)serialization, id/date wrapping, nested-aggregate assembly. | No |
| **Repository** | `PostgresFooRepository` | Thin **composition root**. Constructs the builder(s) + shared runner and passes them to the QueryRunner via `super(...)`. | No (wires only) |
| **index.ts** | barrel | Re-exports the public repository (and any logging-decorated variant). | — |

**The dependency-flow trace** (commit this to memory — it is the whole pattern):

```
port method            FooQueryRunner.retrieveMany(criteria, options)
  → build              const query = fooQueryBuilder.buildRetrieveManyQuery(criteria, options)   // no DB
  → execute + map      return queryRunner.runMany(query, FooMapper.fromRow)                       // DB here
  → domain entities    Foo[]
```

Writes mirror it: `Mapper.toRow(entity)` → `builder.buildSaveQuery(row)` → `runner.execute(query)`.

**Procedure:** open the repo folder → name the four files → for the QueryRunner,
list the port methods (each becomes one build+run pair) → for the QueryBuilder,
list the Criteria fields (each becomes one `where` helper call) → derive tests
from §9.

---

## 3. Step 0 — load the Project Profile

Read the profile that matches the repo before writing code:

1. Look for `.claude/ddd/repository-design.md` in the target repo root. When
   present, it is the source of truth for every project-specific slot referenced
   below.
2. If it is missing, follow **`ddd:create-profile`** to derive one by reading
   **one existing repository folder** plus the shared base classes, confirm
   ambiguous slots with the user, and **write it to
   `.claude/ddd/repository-design.md` in the target repo** — so it is found next
   time and shared with the team.
3. For a fully worked example of a completed profile, see
   `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/repository-design.md`.

The profile supplies: the query-builder library; base-class names and what they
provide; the shared QueryRunner's method set; the SQL-assertion helper and dummy
DB; where Criteria/port types live; the schema/row type aliases; import aliases;
builder/fixture locations; file placement + naming; mock library; run command;
and live exemplars to imitate.

---

## 4. The Criteria boundary

The port's read methods take a single **Criteria** object — not a long positional
argument list. This is the seam that keeps callers ignorant of SQL.

Two shapes occur (the profile says where these types live):

**(a) Plain partial** — every field optional, all combinable:
```ts
export type FoosRetrieveCriteria = Partial<{
  uids: ObjectId[]
  companyUids: ObjectId[]
  names: string[]
}>
```

**(b) Discriminated status filter** — enforces `inStatus` XOR `notInStatus` at the type level:
```ts
interface InStatusFilter<S>    { inStatus: S[];  notInStatus?: never }
interface NotInStatusFilter<S> { inStatus?: never; notInStatus: S[] }
type StatusFilter<S> = InStatusFilter<S> | NotInStatusFilter<S>
type RetrieveCriteria<S, Props> = Partial<Props> & Partial<StatusFilter<S>>
```

**The rule that drives the builder: one Criteria field → one `where` helper call.**
The builder reads each field and conditionally appends a clause. The three-state
semantics of array filters are the part everyone gets wrong — make them explicit
and test all three (§9):

| Criteria value | SQL effect |
|---|---|
| `undefined` (field absent) | **no clause** — do not filter on this column |
| `[]` (empty array) | **match nothing** — emit an impossible predicate (the empty-list sentinel, §6) |
| `[a, b]` (non-empty) | `where col in (a, b)` |

A retrieve-many builder is therefore a flat list of helper calls, e.g.:
```ts
buildRetrieveManyQuery(criteria: FoosRetrieveCriteria, options?: PaginationOptions) {
  let query = this._buildSelectFoosQuery()
  query = this._setWhereInObjectIds(query, 'id', criteria.uids)
  query = this._setWhereInObjectIds(query, 'company_id', criteria.companyUids)
  query = this._setWhereInArray(query, 'name', criteria.names)
  query = this._setWhereInArray(query, 'status', criteria.inStatus)
  query = this._setWhereNotInArray(query, 'status', criteria.notInStatus)
  query = this._setQueryPaginationOptions(query, options)
  query = this._setOrderBy(query, 'created_at', 'asc')
  return query
}
```

---

## 5. Base classes & removing duplication

The `where`/pagination/ordering helpers live on a **shared abstract base query
builder**, not copied into each repo. Every concrete builder extends it. The
profile names these classes; the typical shape:

- `BaseQueryBuilder<DB, Table>` — protected helpers: `_setWhereInArray`,
  `_setWhereNotInArray`, `_setWhereInObjectIds`/`_setWhereNotInObjectIds`
  (unwrap value-object ids to primitives, then delegate), `_setWhereJsonInArray`
  (JSON-contains `@>`), `_setQueryPaginationOptions`, `_setOrderBy`. It declares
  one **abstract** method: `_setEmptyList(query)` — the empty-list sentinel.
- A concrete subclass supplies `_setEmptyList`. For tables keyed by `id`, a
  ready-made `BaseIdTableQueryBuilder` implements it as `where('id','is',null)`
  (an always-false predicate). Builders that **join** other tables (so the row
  type isn't a single id-table) extend `BaseQueryBuilder` directly and implement
  their own sentinel (e.g. `where('engagement_id','is',null)`).

```
BaseQueryBuilder (abstract _setEmptyList)
  ├── BaseIdTableQueryBuilder        // _setEmptyList → where id is null
  │     └── FilesQueryBuilder, UserQueryBuilder, …  (single id-table)
  └── MemberQueryBuilder, …          // joins users; own _setEmptyList
```

**Variation at the repository level is interface-based, not subclassing.** When a
context needs different behavior (e.g. a back-office repo that returns a fixed
admin and throws on writes), write a **separate class that implements the same
port** and short-circuits — do **not** subclass the Postgres repository. Keep the
inheritance for query *builders* (mechanical SQL reuse) and composition for
repository *behavior*.

---

## 6. The Mapper

Two static methods, pure, no DB:

- `fromRow(row): Entity` — wrap primitive ids in value objects (`new ObjectId(row.id)`),
  parse dates (`new Date(row.created_at)`), pass through already-parsed JSON
  columns, and for **aggregates** call the child mapper on the nested row
  (`UserMapper.fromRow(row.user)` where the join used `row_to_json(users) as user`).
- `toRow(entity): Row` — the inverse: `id.value`, `JSON.stringify(arrayField)`,
  and for aggregates return a `{ parent, child }` shape the runner can split.

The **empty-list sentinel** (§5) and **JSON casting on write** (§7) are the two
spots where row/entity asymmetry hides bugs — test them explicitly.

---

## 7. Shared utilities cheatsheet

The profile names the exact helpers; these recur:

- **JSON write cast** — inserting a stringified JSON value into a `jsonb` column
  needs an explicit cast. A `rowWithJSONFields(row, ['labels'])` helper wraps the
  named fields in `cast(… as jsonb)`. Use it in every `buildSave*Query`.
- **Chunked bulk writes** — `saveMany` splits into batches (`makeBatches(rows, CHUNK_SIZE)`)
  to stay under the driver's parameter limit, then runs each batch.
- **Nullable mappers** — `mapRowNullable` / `mapNullable` (NULL → `undefined`),
  `mapNullableColumnToObjectId` (NULL → `undefined`, else wrap), and
  `string(Array)ToObjectIdArray` for serialized id lists.
- **Schema/row types** — a central `schema.ts` declares one interface per table
  and derives `FooRow = Selectable<FooTable>` (read shape) and
  `NewFooRow = Insertable<FooTable>` (write shape), with `JSONColumnType<T>` for
  json columns and a `DateColumn` alias. Aggregates compose:
  `FooAggregateTable = FooTable & { bar: BarRow }`.

---

## 8. The shared QueryRunner

A single stateless class executes queries and applies the mapper, so runners
never call `.execute()` directly. Typical surface (profile confirms names):

| Method | Use |
|---|---|
| `runMany(query, Mapper.fromRow)` | retrieve-many → `Entity[]` |
| `runOne(query, Mapper.fromRow, default?)` | retrieve-one → `Entity \| null` (or default) |
| `runOneWithDefault(query, Mapper.fromRow, default)` | retrieve-one with a non-null fallback |
| `execute(query)` | writes / deletes (no mapping) |

The concrete `FooQueryRunner` is constructed with `(fooQueryBuilder, queryRunner)`
(plus any sibling builders for aggregate writes) and implements the port method
by method: build → run/execute → return.

---

## 9. Testing recipe

Framework + libraries come from the profile (commonly Jest + a type-driven mock
library + a faker-backed builder set). Four test kinds, each isolated:

**(a) QueryBuilder test — assert the generated SQL.** Construct the builder with
the **dummy DB** (a credential-less query-builder instance — never connects).
Build a query and compare it to an expected raw SQL string with the project's
**SQL-assertion helper**, which compiles the query, normalizes whitespace and
parameter markers, and separately checks the parameter **bindings**:

```ts
import SQL from 'sql-template-strings'
import { dummyDb, expectQuery } from '<<shared>>'

const sut = new FooQueryBuilder(dummyDb)

it('builds the retrieve-many query', () => {
  const query = sut.buildRetrieveManyQuery({ companyUids: [COMPANY_UID] })
  expectQuery(query).toStrictEqual(SQL`
    select * from "foos" where "company_id" in (${COMPANY_UID.value}) order by "created_at" asc
  `)
})
```
Cover, per filterable field, the **three Criteria states** (§4): undefined → no
clause, empty → sentinel, populated → `in (...)`. Also cover save (incl. the
`cast(… as jsonb)`), save-many, and delete.

**(b) Base-class test — protected helpers once, centrally.** Expose the protected
methods via a tiny `Testable<<Base>>` subclass, then assert each helper's three
states. Do **not** re-test these in every concrete builder.

**(c) QueryRunner test — interaction, DB mocked.** Mock the builder and the shared
runner; assert the runner calls the right builder method with the right args (and
that a stubbed row maps to the right entity):

```ts
const queryBuilder = mock<FooQueryBuilder>()
const queryRunner = mock<QueryRunner>()
const sut = new FooQueryRunner(queryBuilder, queryRunner)
afterEach(() => { mockReset(queryBuilder); mockReset(queryRunner) })

it('save → builds the save query from the mapped row', async () => {
  const entity = FooBuilder.build()
  await sut.save(entity)
  expect(queryBuilder.buildSaveQuery).toHaveBeenCalledTimes(1)
  expect(queryBuilder.buildSaveQuery).toHaveBeenCalledWith(FooMapper.toRow(entity))
})
```

**(d) Mapper test — round-trip.** `fromRow` builds the right entity (incl. nested
aggregate); `toRow` produces the right row (incl. `JSON.stringify`). Assert with
strict deep-equality.

**Branch-coverage checklist:** every filterable Criteria field × {undefined,
empty, populated}; `inStatus` vs `notInStatus`; pagination present/absent;
save / save-many / delete; mapper both directions; nested aggregate assembly.

---

## 10. Condensed skeleton

Replace `<<…>>` with profile values. (Full worked files: `${CLAUDE_PLUGIN_ROOT}/skills/repository-design/references/examples/`.)

```ts
// FooQueryBuilder.ts ─ pure SQL, no execution
export class FooQueryBuilder extends <<BaseIdTableQueryBuilder>><'foos'> {
  constructor(private _db: Kysely<Schema>) { super() }

  buildSaveQuery(row: NewFooRow) {
    return this._db.insertInto('foos')
      .values(rowWithJSONFields(row, ['labels']))                 // jsonb cast
      .onConflict((c) => c.column('id').doUpdateSet({ /* … */ }))
  }

  buildRetrieveManyQuery(criteria: FoosRetrieveCriteria, options?: PaginationOptions) {
    let q = this._db.selectFrom('foos').selectAll()
    q = this._setWhereInObjectIds(q, 'id', criteria.uids)         // one field → one helper
    q = this._setWhereInArray(q, 'status', criteria.inStatus)
    q = this._setWhereNotInArray(q, 'status', criteria.notInStatus)
    q = this._setQueryPaginationOptions(q, options)
    return this._setOrderBy(q, 'created_at', 'asc')
  }
}

// FooQueryRunner.ts ─ implements the port; build → run/execute → map
export class FooQueryRunner implements FoosRepository {
  constructor(private _qb: FooQueryBuilder, private _runner: QueryRunner) {}
  retrieveMany = (c: FoosRetrieveCriteria, o?: PaginationOptions) =>
    this._runner.runMany(this._qb.buildRetrieveManyQuery(c, o), FooMapper.fromRow)
  save = async (foo: Foo) => { await this._runner.execute(this._qb.buildSaveQuery(FooMapper.toRow(foo))) }
}

// PostgresFooRepository.ts ─ composition root
export class PostgresFooRepository extends FooQueryRunner implements FoosRepository {
  constructor(db: Kysely<Schema>) { super(new FooQueryBuilder(db), queryRunner()) }
}
```

Assertions used throughout the tests: `expectQuery(q).toStrictEqual(SQL\`…\`)`,
`toStrictEqual`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`,
`resolves.toStrictEqual`, `rejects.toStrictEqual(new SomeError(...))`.

---

## 11. Reference files

Project profile (the portability seam, owned by `ddd:create-profile`):
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/repository-design.md` — blank fill-in template.
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/repository-design.md` — a fully worked profile.

Worked example (Audora aliases; illustrative `Foo` entity):
- `${CLAUDE_PLUGIN_ROOT}/skills/repository-design/references/examples/audora/FooQueryBuilder.ts` + `FooQueryBuilder.test.ts`
- `${CLAUDE_PLUGIN_ROOT}/skills/repository-design/references/examples/audora/FooQueryRunner.ts` + `FooQueryRunner.test.ts`
- `${CLAUDE_PLUGIN_ROOT}/skills/repository-design/references/examples/audora/FooMapper.ts` + `FooMapper.test.ts`
- `${CLAUDE_PLUGIN_ROOT}/skills/repository-design/references/examples/audora/PostgresFooRepository.ts`

When working in a profiled repo, also open the 1–2 real repositories named in the
profile as live exemplars, and the shared base-class test.
