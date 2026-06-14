/**
 * AUDORA EXAMPLE — testing a Step collaborator.
 * Distilled from: packages/core/src/steps/ValidateControlStep/ValidateControlStep.test.ts
 *
 * Illustrates (profile: .claude/ddd/usecase-design.md — worked example: create-profile/references/examples/audora/usecase-design.md):
 *  - a Step<In, Out> SUT (§6): single `run(input)` entry method, plain object of deps in the constructor
 *  - mock its repository dependency with `mock<T>()` (§3)
 *  - `runningTheSut` wraps `sut.run(...)`; one `given`/`it` per outcome (§9)
 *  - error path asserts the exact domain error AND the repository query args
 *  - happy path returns the entity unchanged
 *
 * Note: when a USECASE composes this step, the usecase test mocks the whole
 * step (`mock<ValidateControlStep>()` + `step.run.mockResolvedValue(...)`) —
 * the step's own logic is covered here, once.
 */

import { mock } from 'jest-mock-extended'
import { ControlRepository } from '@core/boundaries'
import { EntityNotFoundError } from '@core/errors'
import { ControlEntityBuilder } from '~/tests/shared'
import { ValidateControlStep } from './ValidateControlStep'
import { ObjectId } from '@entities/value-objects'

describe(ValidateControlStep.name, () => {
  const CONTROL_UID = new ObjectId('CONTROL_UID')
  const ENGAGEMENT_UID = new ObjectId('ENGAGEMENT_UID')

  const controlsRepository = mock<ControlRepository>()

  const sut = new ValidateControlStep({ controlsRepository })

  const runningTheSut = async () => await sut.run({ engagementUid: ENGAGEMENT_UID, controlUid: CONTROL_UID })

  describe('given the control does not exist', () => {
    beforeEach(() => {
      controlsRepository.retrieveOne.mockResolvedValue(null)
    })

    it('should throw entity not found error', async () => {
      // NB: passing the function reference (not calling it) also works with rejects.
      await expect(runningTheSut).rejects.toStrictEqual(new EntityNotFoundError('Control', CONTROL_UID))

      expect(controlsRepository.retrieveOne).toHaveBeenCalledTimes(1)
      expect(controlsRepository.retrieveOne).toHaveBeenCalledWith({ uids: [CONTROL_UID], engagementId: ENGAGEMENT_UID })
    })
  })

  describe('given the control exists', () => {
    const control = ControlEntityBuilder.build({ uid: CONTROL_UID, engagementUid: ENGAGEMENT_UID })

    beforeEach(() => {
      controlsRepository.retrieveOne.mockResolvedValue(control)
    })

    it('should return the control', async () => {
      const actual = await runningTheSut()

      expect(actual).toEqual(control)
    })
  })
})
