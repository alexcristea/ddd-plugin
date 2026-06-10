/**
 * AUDORA EXAMPLE — simplest usecase test (identity-gated read).
 * Distilled from: packages/core/src/usecases/Users/GetCurrentUserUsecase/GetCurrentUserUsecase.test.ts
 *
 * Illustrates (profile: .claude/ddd/usecase-tests.md — worked example: create-profile/references/examples/audora/usecase-tests.md):
 *  - `mock<T>()` for the one injected step (§3)
 *  - SUT built with a single `steps`-style object (§2) — this usecase has no `params`
 *  - `describe(Sut.name)` + `describe(sut.executeTemplate.name)` (§9)
 *  - builders from two aliases: `@fake-data` (UserBuilder) and `~/tests/shared` (IdentityClaimsBuilder) (§8)
 *  - `mockReset` in beforeEach (§3); `runningTheSut` Act wrapper (§9)
 */

import { ValidateIdentityStep } from '@core/steps'
import { ObjectId } from '@entities/value-objects'
import { UserBuilder } from '@fake-data'
import { mock, mockReset } from 'jest-mock-extended'
import { IdentityClaimsBuilder } from '~/tests/shared'
import { GetCurrentUserUsecase } from './GetCurrentUserUsecase'

describe(GetCurrentUserUsecase.name, () => {
  const USER_UID = new ObjectId('USER_UID')

  // One mock per injected collaborator (here: a single step).
  const validateIdentityStep = mock<ValidateIdentityStep>()
  const sut = new GetCurrentUserUsecase({ validateIdentityStep })

  // Test data via builders — override only the field under test.
  const identity = IdentityClaimsBuilder.build({ userId: USER_UID.value })
  const user = UserBuilder.build({ uid: USER_UID })

  // This usecase is identity-gated only, so we drive the public `execute`
  // and stub the identity step to return the resolved user.
  const runningTheSut = async () => await sut.execute({ identity })

  beforeEach(() => {
    mockReset(validateIdentityStep)
  })

  describe(sut.executeTemplate.name, () => {
    beforeEach(() => {
      validateIdentityStep.run.mockResolvedValue(user)
    })

    it('should return the current user', async () => {
      const actual = await runningTheSut()

      expect(actual).toStrictEqual(user)
    })
  })
})
