/**
 * GENERIC factory unit-test template (library-neutral, no project specifics).
 *
 * A domain *factory* is a production object that builds entities from
 * primitives — typically `make(props)` and sometimes `clone(entity, changes)`.
 * It is a SUT like a usecase: inject its collaborators (a clock, an id
 * generator) as mocks and assert on the entity it produces.
 *
 * Teaching reference, not runnable — replace names/aliases per Project Profile.
 *
 *   class ThingFactory {
 *     constructor(deps: { idGen: IdGenerator; clock: Clock }) {}
 *     make(props): Thing { ... }
 *     clone(original: Thing, changes: Partial<...>): Thing { ... }
 *   }
 */

import { mock } from 'jest-mock-extended'
import { IdGenerator, Clock } from '<deps-alias>'
import { Thing, ThingStatus } from '<entities-alias>'
import { ThingFactory } from './ThingFactory'

describe(ThingFactory.name, () => {
  const UID = 'UID'
  const OWNER_ID = 'OWNER_ID'
  const NAME = 'thing-name'

  const idGen = mock<IdGenerator>()
  const clock = mock<Clock>()

  const sut = new ThingFactory({ idGen, clock })

  describe('make', () => {
    const NOW = new Date('2024-01-31')

    beforeEach(() => {
      // `Once` because each `make` call consumes exactly one of each.
      idGen.next.mockReturnValueOnce(UID)
      clock.now.mockReturnValueOnce(NOW)
    })

    it('should build a fully specified entity', () => {
      const thing = sut.make({
        ownerId: OWNER_ID,
        name: NAME,
        status: ThingStatus.Ready,
      })

      const expected = new Thing({
        uid: UID,
        ownerId: OWNER_ID,
        name: NAME,
        status: ThingStatus.Ready,
        note: null,
        createdAt: NOW,
        modifiedAt: NOW,
      })

      expect(thing).toStrictEqual(expected)
    })

    it('should apply defaults for omitted optional fields', () => {
      const thing = sut.make({ ownerId: OWNER_ID, name: NAME, status: ThingStatus.Ready })

      // assert the defaulting behavior explicitly
      expect(thing.note).toBeNull()
      expect(thing.createdAt).toBe(NOW)
    })
  })

  describe('clone', () => {
    const CREATED_AT = new Date('2024-01-01')
    const MODIFIED_AT = new Date('2024-01-15')
    const NEW_MODIFIED_AT = new Date('2024-02-01')

    const original = new Thing({
      uid: UID,
      ownerId: OWNER_ID,
      name: NAME,
      status: ThingStatus.Ready,
      note: 'original',
      createdAt: CREATED_AT,
      modifiedAt: MODIFIED_AT,
    })

    beforeEach(() => {
      clock.now.mockReturnValueOnce(NEW_MODIFIED_AT)
    })

    it('should return a new entity with changes applied and modifiedAt bumped', () => {
      const cloned = sut.clone(original, { name: 'renamed', status: ThingStatus.Archived })

      expect(cloned).toStrictEqual(
        new Thing({
          uid: UID,
          ownerId: OWNER_ID,
          name: 'renamed',
          status: ThingStatus.Archived,
          note: 'original', // unchanged fields carried over
          createdAt: CREATED_AT, // createdAt preserved
          modifiedAt: NEW_MODIFIED_AT, // modifiedAt refreshed from the clock
        }),
      )
    })

    it('should NOT mutate the original entity', () => {
      const snapshot = { ...original }

      sut.clone(original, { name: 'something-else', status: ThingStatus.Archived })

      expect({ ...original }).toStrictEqual(snapshot)
    })

    it('should allow setting nullable fields to null', () => {
      const cloned = sut.clone(original, { note: null })

      expect(cloned.note).toBeNull()
    })
  })
})

/**
 * Notes
 * -----
 * - Mock the clock/id-gen with `mockReturnValueOnce` — one per produced entity.
 * - Build the EXACT `new Entity({...})` you expect and `toStrictEqual` it.
 * - For `clone`, the high-value cases are: changes applied, untouched fields
 *   carried over, `createdAt` preserved, `modifiedAt` refreshed, original not
 *   mutated, and nullable transitions both ways.
 */
