/**
 * Worked example — QueryRunner (Audora profile).
 *
 * Implements the port. Each method is the same shape: build a query with the
 * builder, hand it to the shared QueryRunner to execute, map rows via the
 * Mapper. It never calls `.execute()` on a query directly. A repo that writes an
 * aggregate would take sibling builders too (see `MemberQueryRunner`, which also
 * receives a `UserQueryBuilder` and saves the user row before the member row).
 */
import { FoosRepository, FoosRetrieveCriteria, PaginationOptions } from '@core/boundaries'
import { Foo } from '@entities/entities'
import { QueryRunner } from '../shared'
import { FooMapper } from './FooMapper'
import { FooQueryBuilder } from './FooQueryBuilder'

export class FooQueryRunner implements FoosRepository {
  private _fooQueryBuilder: FooQueryBuilder
  private _queryRunner: QueryRunner

  constructor(fooQueryBuilder: FooQueryBuilder, queryRunner: QueryRunner) {
    this._fooQueryBuilder = fooQueryBuilder
    this._queryRunner = queryRunner
  }

  async save(foo: Foo) {
    const query = this._fooQueryBuilder.buildSaveQuery(FooMapper.toRow(foo))
    await this._queryRunner.execute(query)
  }

  async saveMany(foos: Foo[]) {
    if (!foos.length) {
      return
    }
    const query = this._fooQueryBuilder.buildSaveManyQuery(foos.map(FooMapper.toRow))
    await this._queryRunner.execute(query)
  }

  async retrieveOne(criteria: FoosRetrieveCriteria) {
    const query = this._fooQueryBuilder.buildRetrieveManyQuery(criteria, { offset: 0, limit: 1 })
    return await this._queryRunner.runOne(query, FooMapper.fromRow)
  }

  async retrieveMany(criteria: FoosRetrieveCriteria, options?: PaginationOptions) {
    const query = this._fooQueryBuilder.buildRetrieveManyQuery(criteria, options)
    return await this._queryRunner.runMany(query, FooMapper.fromRow)
  }

  async delete(foo: Foo) {
    const query = this._fooQueryBuilder.buildDeleteQuery(foo.uid.value)
    await this._queryRunner.execute(query)
  }
}
