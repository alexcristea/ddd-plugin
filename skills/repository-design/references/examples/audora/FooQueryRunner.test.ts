/**
 * Worked example — QueryRunner test (Audora profile).
 *
 * Interaction test, DB fully mocked. Mock the builder and the shared runner;
 * assert the runner delegates correctly: the right builder method, with the
 * right (mapped) args, and that a stubbed row is mapped to the right entity. We
 * do NOT assert SQL here — that is the QueryBuilder test's job.
 */
import { mock, mockReset } from 'jest-mock-extended'
import { FooBuilder } from '@fakes'
import { QueryRunner } from '../shared'
import { FooMapper } from './FooMapper'
import { FooQueryBuilder } from './FooQueryBuilder'
import { FooQueryRunner } from './FooQueryRunner'

describe(FooQueryRunner.name, () => {
  const queryBuilder = mock<FooQueryBuilder>()
  const queryRunner = mock<QueryRunner>()

  const sut = new FooQueryRunner(queryBuilder, queryRunner)

  afterEach(() => {
    mockReset(queryBuilder)
    mockReset(queryRunner)
  })

  describe('save', () => {
    it('builds the save query from the mapped row', async () => {
      const foo = FooBuilder.build()

      await sut.save(foo)

      expect(queryBuilder.buildSaveQuery).toHaveBeenCalledTimes(1)
      expect(queryBuilder.buildSaveQuery).toHaveBeenCalledWith(FooMapper.toRow(foo))
    })
  })

  describe('retrieveMany', () => {
    const CRITERIA = { companyUids: [] }

    it('maps the rows the runner returns into entities', async () => {
      const foo = FooBuilder.build()
      const row = FooMapper.toRow(foo)
      queryRunner.runMany.mockResolvedValue([foo])

      const result = await sut.retrieveMany(CRITERIA)

      expect(queryBuilder.buildRetrieveManyQuery).toHaveBeenCalledWith(CRITERIA, undefined)
      // the runner is handed the mapper, not a pre-mapped result
      expect(queryRunner.runMany).toHaveBeenCalledWith(expect.anything(), FooMapper.fromRow)
      expect(result).toStrictEqual([foo])
      expect(row).toBeDefined()
    })
  })

  describe('delete', () => {
    it('builds the delete query with the entity id', async () => {
      const foo = FooBuilder.build()

      await sut.delete(foo)

      expect(queryBuilder.buildDeleteQuery).toHaveBeenCalledTimes(1)
      expect(queryBuilder.buildDeleteQuery).toHaveBeenCalledWith(foo.uid.value)
    })
  })
})
