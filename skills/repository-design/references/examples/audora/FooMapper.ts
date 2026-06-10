/**
 * Worked example — Mapper (Audora profile).
 *
 * Two pure static methods. `fromRow` wraps primitive ids in value objects and
 * parses dates; the json `labels` column arrives already-parsed. `toRow` is the
 * inverse and `JSON.stringify`s arrays for the jsonb column. (An *aggregate*
 * mapper would also call a child mapper here — e.g. `BarMapper.fromRow(row.bar)`
 * where the join used `row_to_json(bars) as bar` — and return a `{ foo, bar }`
 * shape from `toRow`. See `MemberMapper` for that variant.)
 */
import { Foo } from '@entities/entities'
import { ObjectId } from '@entities/value-objects'
import { FooRow, NewFooRow } from '../schema'

export class FooMapper {
  static fromRow(row: FooRow): Foo {
    return new Foo({
      uid: new ObjectId(row.id),
      companyUid: new ObjectId(row.company_id),

      name: row.name,
      labels: row.labels, // jsonb -> already parsed string[]
      status: row.status,

      createdAt: new Date(row.created_at),
      modifiedAt: new Date(row.modified_at),
    })
  }

  static toRow(entity: Foo): NewFooRow {
    return {
      id: entity.uid.value,
      company_id: entity.companyUid.value,

      name: entity.name,
      labels: JSON.stringify(entity.labels), // string[] -> json string (cast in the builder)
      status: entity.status,

      created_at: entity.createdAt,
      modified_at: entity.modifiedAt,
    }
  }
}
