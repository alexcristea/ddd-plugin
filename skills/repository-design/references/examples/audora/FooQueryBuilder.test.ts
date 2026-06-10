/**
 * Worked example — QueryBuilder test (Audora profile).
 *
 * The point of these tests: assert the *generated SQL* (text + bindings) without
 * a database. `expectQuery` compiles the Kysely query, normalizes whitespace and
 * `:n` markers, and checks the parameter bindings separately — so format the
 * expected SQL for readability and interpolate bound values with `${...}`
 * (always `id.value`, never the ObjectId).
 *
 * Coverage shown: save (incl. jsonb cast), save-many, delete, and — the part
 * that hides bugs — the three Criteria states (undefined / empty / populated)
 * plus inStatus vs notInStatus and pagination.
 */
import { FooStatus } from '@entities/entities'
import { ObjectId } from '@entities/value-objects'
import { faker } from '@faker-js/faker'
import SQL from 'sql-template-strings'
import { NewFooRow } from '../schema'
import { dummyDb, expectQuery } from '../shared'
import { FooQueryBuilder } from './FooQueryBuilder'

describe(FooQueryBuilder.name, () => {
  const sut = new FooQueryBuilder(dummyDb)

  const UID = new ObjectId('UID')
  const COMPANY_UID = new ObjectId('COMPANY_UID')
  const NAME = 'compliance'
  const STATUS = FooStatus.Active

  describe('buildSaveQuery', () => {
    it('should build the query with the labels column cast to jsonb', () => {
      const ROW = makeFooRow()
      const query = sut.buildSaveQuery(ROW)

      expectQuery(query).toStrictEqual(SQL`
        insert into "foos"
          ("id", "company_id", "name", "labels", "status", "created_at", "modified_at")
        values
          (${ROW.id}, ${ROW.company_id}, ${ROW.name}, cast(${ROW.labels} as jsonb), ${ROW.status}, ${ROW.created_at}, ${ROW.modified_at})
        on conflict ("id")
        do update set
          "name" = excluded.name,
          "labels" = excluded.labels,
          "status" = excluded.status,
          "modified_at" = excluded.modified_at
      `)
    })
  })

  describe('buildSaveManyQuery', () => {
    it('should build a multi-row insert', () => {
      const ROW_1 = makeFooRow()
      const ROW_2 = makeFooRow()

      const query = sut.buildSaveManyQuery([ROW_1, ROW_2])

      expectQuery(query).toStrictEqual(SQL`
        insert into "foos"
          ("id", "company_id", "name", "labels", "status", "created_at", "modified_at")
        values
          (${ROW_1.id}, ${ROW_1.company_id}, ${ROW_1.name}, cast(${ROW_1.labels} as jsonb), ${ROW_1.status}, ${ROW_1.created_at}, ${ROW_1.modified_at}),
          (${ROW_2.id}, ${ROW_2.company_id}, ${ROW_2.name}, cast(${ROW_2.labels} as jsonb), ${ROW_2.status}, ${ROW_2.created_at}, ${ROW_2.modified_at})
        on conflict ("id")
        do update set
          "name" = excluded.name,
          "labels" = excluded.labels,
          "status" = excluded.status,
          "modified_at" = excluded.modified_at
      `)
    })
  })

  describe('buildDeleteQuery', () => {
    it('should build the query', () => {
      const query = sut.buildDeleteQuery(UID.value)

      expectQuery(query).toStrictEqual(SQL`
        delete from "foos" where "id" = ${UID.value}
      `)
    })
  })

  describe('buildRetrieveManyQuery', () => {
    it('given a populated criteria, filters on every field and paginates', () => {
      const query = sut.buildRetrieveManyQuery(
        { uids: [UID], companyUids: [COMPANY_UID], names: [NAME], inStatus: [STATUS] },
        { limit: 10, offset: 100 },
      )

      expectQuery(query).toStrictEqual(SQL`
        select * from "foos"
        where "id" in (${UID.value})
          and "company_id" in (${COMPANY_UID.value})
          and "name" in (${NAME})
          and "status" in (${STATUS})
        order by "created_at" asc
        limit ${10}
        offset ${100}
      `)
    })

    it('given notInStatus, negates the status filter', () => {
      const query = sut.buildRetrieveManyQuery({ notInStatus: [STATUS] })

      expectQuery(query).toStrictEqual(SQL`
        select * from "foos" where "status" not in (${STATUS}) order by "created_at" asc
      `)
    })

    it('given an empty array, emits the impossible-predicate sentinel (matches nothing)', () => {
      const query = sut.buildRetrieveManyQuery({ companyUids: [] })

      expectQuery(query).toStrictEqual(SQL`
        select * from "foos" where "id" is null order by "created_at" asc
      `)
    })

    it('given an empty criteria, applies no filters', () => {
      const query = sut.buildRetrieveManyQuery({})

      expectQuery(query).toStrictEqual(SQL`
        select * from "foos" order by "created_at" asc
      `)
    })
  })
})

function makeFooRow(): NewFooRow {
  return {
    id: faker.datatype.uuid(),
    company_id: faker.datatype.uuid(),
    name: faker.lorem.word(),
    labels: JSON.stringify(['a', 'b']),
    status: FooStatus.Active,
    created_at: new Date(),
    modified_at: new Date(),
  }
}
