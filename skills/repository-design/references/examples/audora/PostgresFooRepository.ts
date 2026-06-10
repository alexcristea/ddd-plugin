/**
 * Worked example — Repository composition root (Audora profile).
 *
 * Thin: construct the builder(s) and the shared runner, hand them to the
 * QueryRunner via `super(...)`. All behavior lives in `FooQueryRunner`; this
 * class only wires the concrete Kysely instance. (`index.ts` re-exports this.)
 *
 * Need a context-specific variant — e.g. a read-only / fixed-result repo? Write
 * a SEPARATE class that `implements FoosRepository` and short-circuits; do NOT
 * subclass this one. (See `BackofficeUsersRepository` for that pattern.)
 */
import { FoosRepository } from '@core/boundaries'
import { Kysely } from 'kysely'
import { Schema } from '../schema'
import { queryRunner } from '../shared'
import { FooQueryBuilder } from './FooQueryBuilder'
import { FooQueryRunner } from './FooQueryRunner'

export class PostgresFooRepository extends FooQueryRunner implements FoosRepository {
  constructor(db: Kysely<Schema>) {
    const fooBuilder = new FooQueryBuilder(db)
    const runner = queryRunner()

    super(fooBuilder, runner)
  }
}
