/**
 * Worked example — QueryBuilder (Audora profile).
 *
 * Illustrative `Foo` entity: a single `id`-keyed table with a JSON `labels`
 * column and a `status` enum. Adapted from the real `FilesQueryBuilder` /
 * `MemberQueryBuilder`. Teaching code — not wired into the build.
 *
 * Assumed declarations elsewhere (see profile §3, §7):
 *   // packages/core/src/boundaries/FoosRepository.ts
 *   export type FoosRetrieveCriteria = RetrieveCriteria<FooStatus, {
 *     uids: ObjectId[]; companyUids: ObjectId[]; names: string[]
 *   }>
 *   // packages/backend/src/repository/schema.ts
 *   export type FooTable = {
 *     id: string; company_id: string; name: string;
 *     labels: JSONColumnType<string[]>; status: FooStatus;
 *     created_at: DateColumn; modified_at: DateColumn;
 *   }
 *   export type FooRow = Selectable<FooTable>
 *   export type NewFooRow = Insertable<FooTable>
 */
import { FoosRetrieveCriteria, PaginationOptions } from '@core/boundaries'
import { Kysely, sql } from 'kysely'
import { NewFooRow, Schema } from '../schema'
import { BaseIdTableQueryBuilder, rowWithJSONFields } from '../shared'

const TABLE_NAME = 'foos'

// Single id-table → extend BaseIdTableQueryBuilder so `_setEmptyList` is provided
// (it emits `where "id" is null`, an always-false predicate). A builder that
// JOINs other tables would extend BaseQueryBuilder<Schema, 'foos' | 'bars'>
// directly and implement its own sentinel.
export class FooQueryBuilder extends BaseIdTableQueryBuilder<typeof TABLE_NAME> {
  private _db: Kysely<Schema>

  constructor(db: Kysely<Schema>) {
    super()
    this._db = db
  }

  // --- writes: cast the json column, upsert on the primary key ---

  buildSaveQuery(row: NewFooRow) {
    return this._db
      .insertInto(TABLE_NAME)
      .values(rowWithJSONFields(row, ['labels'])) // string -> cast(... as jsonb)
      .onConflict((col) =>
        col.column('id').doUpdateSet({
          name: sql`excluded.name`,
          labels: sql`excluded.labels`,
          status: sql`excluded.status`,
          modified_at: sql`excluded.modified_at`,
        }),
      )
  }

  buildSaveManyQuery(rows: NewFooRow[]) {
    return this._db
      .insertInto(TABLE_NAME)
      .values(rows.map((row) => rowWithJSONFields(row, ['labels'])))
      .onConflict((col) =>
        col.column('id').doUpdateSet({
          name: sql`excluded.name`,
          labels: sql`excluded.labels`,
          status: sql`excluded.status`,
          modified_at: sql`excluded.modified_at`,
        }),
      )
  }

  buildDeleteQuery(id: string) {
    return this._db.deleteFrom(TABLE_NAME).where('id', '=', id)
  }

  // --- reads: one Criteria field -> one inherited `where` helper ---

  buildRetrieveManyQuery(criteria: FoosRetrieveCriteria, options?: PaginationOptions) {
    let query = this._db.selectFrom(TABLE_NAME).selectAll()

    query = this._setWhereInObjectIds(query, 'id', criteria.uids)
    query = this._setWhereInObjectIds(query, 'company_id', criteria.companyUids)
    query = this._setWhereInArray(query, 'name', criteria.names)
    query = this._setWhereInArray(query, 'status', criteria.inStatus) // discriminated:
    query = this._setWhereNotInArray(query, 'status', criteria.notInStatus) // only one is set

    query = this._setQueryPaginationOptions(query, options)
    query = this._setOrderBy(query, 'created_at', 'asc')

    return query
  }
}
