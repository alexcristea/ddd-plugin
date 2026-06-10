/**
 * GENERIC usecase unit-test template (library-neutral, no project specifics).
 *
 * This file is a *teaching reference*, not runnable code — the imports are
 * illustrative. Replace names/aliases with the values from your Project Profile
 * (.claude/ddd/usecase-tests.md). It demonstrates the universal shape:
 *
 *   contract  -> mocks + SUT
 *   gate      -> inject pre-validated state (if the usecase is gated)
 *   scenarios -> nested describe('given ...') tree
 *   assert    -> return value + collaborator interactions + error paths
 *
 * The SUT below, `CreateThingUsecase`, implements an Interactor with a single
 * entry method and is constructed with injected collaborators:
 *
 *   class CreateThingUsecase {
 *     constructor(deps: { thingRepository; ownerRepository; clock; idGen }) {}
 *     // public gate runs validation, then calls the inner business method:
 *     async executeTemplate(input): Promise<Thing> { ... }
 *   }
 */

import { mock, mockReset } from 'jest-mock-extended' // §5 — or plain jest.fn()
import { ThingRepository, OwnerRepository, Clock, IdGenerator } from '<deps-alias>'
import { EntityNotFoundError, DuplicateEntityError } from '<errors-alias>'
import { Thing } from '<entities-alias>'
import { OwnerBuilder, ThingBuilder, InputBuilder } from '<builders-alias>'
import { CreateThingUsecase } from './CreateThingUsecase'

describe(CreateThingUsecase.name, () => {
  // --- constants: ids, dates, primitives (UPPER_SNAKE_CASE) -----------------
  const NOW = new Date('2021-01-01')
  const THING_UID = 'THING_UID'
  const OWNER_UID = 'OWNER_UID'
  const SLUG = 'a-slug'

  // --- one mock per injected collaborator (derived from the contract, §2) ---
  const thingRepository = mock<ThingRepository>()
  const ownerRepository = mock<OwnerRepository>()
  const clock = mock<Clock>()
  const idGen = mock<IdGenerator>()

  // --- SUT instantiated once, mocks injected in the profile's grouping ------
  const sut = new CreateThingUsecase({ thingRepository, ownerRepository, clock, idGen })

  // --- reset call history + impls between tests -----------------------------
  afterEach(() => {
    mockReset(thingRepository)
    mockReset(ownerRepository)
    mockReset(clock)
    mockReset(idGen)
  })

  // A trivial, separate assertion for the authorization action (if present).
  describe('action', () => {
    it('should return the create action', () => {
      expect(sut.action()).toStrictEqual('CREATE_THING')
    })
  })

  // The business method. We call executeTemplate directly to skip the gate.
  describe('executeTemplate', () => {
    const INPUT = InputBuilder.build({ ownerId: OWNER_UID, slug: SLUG })

    // Single Act wrapper — the one entry point from the contract.
    const runningTheSut = async () => await sut.executeTemplate(INPUT)

    beforeEach(() => {
      // §7 — inject the state the validation pipeline would have produced, so
      // this test exercises ONLY the business logic. Names come from profile.
      // sut.aggregate = AGGREGATE
      // sut.currentUser = USER
      clock.now.mockReturnValue(NOW)
      idGen.next.mockReturnValue(THING_UID)
    })

    // ---- error path: first guard --------------------------------------------
    describe('given the owner does not exist', () => {
      beforeEach(() => {
        ownerRepository.retrieve.mockResolvedValue(null)
      })

      it('should throw an entity not found error', async () => {
        await expect(runningTheSut()).rejects.toStrictEqual(new EntityNotFoundError('Owner', OWNER_UID))

        expect(ownerRepository.retrieve).toHaveBeenCalledTimes(1)
        expect(ownerRepository.retrieve).toHaveBeenCalledWith(OWNER_UID)
        // nothing was persisted on the failure path:
        expect(thingRepository.save).not.toHaveBeenCalled()
      })
    })

    // ---- deeper scenario tree: owner exists ---------------------------------
    describe('given the owner exists', () => {
      const owner = OwnerBuilder.build({ uid: OWNER_UID })

      beforeEach(() => {
        ownerRepository.retrieve.mockResolvedValue(owner)
      })

      describe('given the slug is already taken', () => {
        beforeEach(() => {
          thingRepository.retrieveBySlug.mockResolvedValue(ThingBuilder.build({ slug: SLUG }))
        })

        it('should throw a duplicate entity error', async () => {
          await expect(runningTheSut()).rejects.toStrictEqual(new DuplicateEntityError('Thing', SLUG))
        })
      })

      describe('given the slug is free', () => {
        beforeEach(() => {
          thingRepository.retrieveBySlug.mockResolvedValue(null)
        })

        // The happy path: build the EXACT expected entity and assert on it.
        const expected = new Thing({
          uid: THING_UID,
          ownerId: OWNER_UID,
          slug: SLUG,
          createdAt: NOW,
          modifiedAt: NOW,
        })

        it('should persist the thing', async () => {
          await runningTheSut()

          expect(thingRepository.save).toHaveBeenCalledTimes(1)
          expect(thingRepository.save).toHaveBeenCalledWith(expected)
        })

        it('should return the created thing', async () => {
          await expect(runningTheSut()).resolves.toStrictEqual(expected)
        })
      })
    })
  })
})

/**
 * Notes
 * -----
 * - One behavior per `it`. Group preconditions with nested `describe('given …')`.
 * - Build expectations with `new Entity({...})` or a builder; compare with
 *   `toStrictEqual` (deep, type-strict).
 * - Assert BOTH the return value AND the collaborator interactions that matter.
 * - For parameterized cases use `describe.each([...])('given <%s>', (x) => {…})`.
 * - For sequenced calls to the same mock, script them:
 *     repo.retrieveOne.mockReset().mockResolvedValueOnce(a).mockResolvedValueOnce(b)
 *   then assert `toHaveBeenNthCalledWith(2, …)`.
 */
