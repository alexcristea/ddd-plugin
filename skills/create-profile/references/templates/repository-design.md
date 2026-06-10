# Project Profile — <project name> (blank template)

Copy this file to `.claude/ddd/repository-design.md` **in the target repo** and
fill every slot by reading **one existing repository folder** plus the shared
base classes. Anything left as `<…>` is unresolved — confirm it with the user
before relying on it.

## 0. Scope
- Where repositories live: `<path, e.g. packages/backend/src/repository/>`.
- Query-builder library: `<Kysely | Knex | Drizzle | raw … + version if it matters>`.
- One repository = one folder containing the four files in §2 + an `index.ts` barrel.

## 1. The port (boundary interface)
- Repository interfaces named `<*Repository>`, declared in `<path, e.g. packages/core/src/boundaries>`.
- Read methods take a single **Criteria** object; write methods take domain entities.
- Method set to expect: `<save / saveMany / retrieveOne / retrieveMany / delete / countMany / …>`.

## 2. The four collaborators + naming
| Layer | Class / file name pattern | Notes |
|---|---|---|
| QueryBuilder | `<FooQueryBuilder>` | extends the base in §5; pure SQL, no execution |
| QueryRunner | `<FooQueryRunner>` | implements the port; build → run → map |
| Mapper | `<FooMapper>` | static `fromRow` / `toRow` |
| Repository | `<PostgresFooRepository>` | composition root, `extends <FooQueryRunner>` |
| barrel | `index.ts` | re-exports the public repository |
- **File casing:** `<PascalCase | camelCase>` (state the canonical choice even if the repo is inconsistent).
- **Placement:** co-located in the repository's folder.

## 3. Criteria types
- Defined in `<path>`; named `<*RetrieveCriteria>`.
- Plain-partial shape: `<yes/no + example>`.
- Discriminated status filter (`inStatus` XOR `notInStatus`) available as `<RetrieveCriteria<Status, Props> | n/a>`.
- Pagination type: `<PaginationOptions { offset; limit } | …>`.

## 4. Base query-builder classes (the duplication seam)
- Abstract base: `<BaseQueryBuilder<DB, Table>>` at `<path>`.
- Helpers it provides: `<_setWhereInArray, _setWhereNotInArray, _setWhereInObjectIds, _setWhereNotInObjectIds, _setWhereJsonInArray, _setQueryPaginationOptions, _setOrderBy>`.
- Empty-list sentinel: abstract `<_setEmptyList(query)>` — concrete subclasses implement it.
- Id-table convenience subclass: `<BaseIdTableQueryBuilder<Table>>` → `_setEmptyList` = `<where('id','is',null)>`.
- When a builder **joins** other tables, it extends `<BaseQueryBuilder>` directly and writes its own sentinel.

## 5. Shared QueryRunner (execution + mapping)
- Class `<QueryRunner>` at `<path>`; concrete runners are constructed with `(<...builders>, queryRunner)`.
- Methods: `<runMany(query, mapper) / runOne(query, mapper, default?) / runOneWithDefault(query, mapper, default) / execute(query) / executeOne(query) …>`.
- Construction helper: `<queryRunner() factory | new QueryRunner()>`.

## 6. Shared utilities
- JSON write cast: `<rowWithJSONFields(row, fields) → cast(… as jsonb)>`.
- Chunked bulk writes: `<makeBatches(arr, CHUNK_SIZE), CHUNK_SIZE = ?>`.
- Nullable / id mappers: `<mapRowNullable, mapNullable, mapNullableColumnToObjectId, stringToObjectIdArray, stringArrayToObjectIdArray>`.
- Barrel re-export for the above + test helpers: `<path to shared/index>`.

## 7. Schema / row types
- Central schema file: `<path, e.g. schema.ts>` exposing a `<Schema>` interface (one entry per table).
- Row aliases: read = `<Selectable<FooTable> → FooRow>`, write = `<Insertable<FooTable> → NewFooRow>`.
- Column helpers: `<JSONColumnType<T>, DateColumn = ColumnType<Date,Date,Date>, Nullable<T>>`.
- Aggregate row types: `<FooAggregateTable = FooTable & { bar: BarRow }; NewFooAggregateRow = { foo; bar }>`.

## 8. Test helpers
- SQL-assertion helper: `<expectQuery(query).toStrictEqual(SQL\`…\`)>` at `<path>`; normalizes `<whitespace, :n→?>` and checks bindings (`<dates → ISO>`).
- Expected-SQL author: `<sql-template-strings (import SQL) | …>`.
- Dummy DB (no connection): `<dummyDb>` at `<path>`.
- Mock library: `<jest-mock-extended (mock/mockReset) | …>`.
- Both the dummy DB and `expectQuery` are re-exported from `<shared barrel>`.

## 9. Test-data builders / fixtures
- Entity builders: `<XBuilder.build({ overrides }) / buildMany(n)>` from `<alias, e.g. @fakes / @fake-data>`.
- Row factories used inline in builder tests: `<make<Foo>Row() helper convention>`.

## 10. Import aliases / module map
| Alias | Resolves to | Holds |
|---|---|---|
| `<@core/*>` | `<…>` | boundaries (Criteria, ports), errors |
| `<@entities/*>` | `<…>` | entities, value objects (`ObjectId`) |
| `<../schema>` | schema file | row types |
| `<../shared>` | shared barrel | base classes, runner, `expectQuery`, `dummyDb`, utilities |
| `<@fakes / @fake-data>` | `<…>` | builders |

## 11. Run command
- Single file: `<yarn workspace <pkg> test <relative path> | …>`.
- Watch / coverage: `<…>`.
- Test config: `<preset, testMatch, moduleNameMapper notes>`.

## 12. Live exemplars (real files to imitate)
- Simple id-table repo: `<path>`.
- Aggregate / joined repo: `<path>`.
- Status-filter (`inStatus`/`notInStatus`) repo: `<path>`.
- Base-class test: `<path>`.
