/**
 * AUDORA EXAMPLE — permission-gated usecase, deep scenario tree, error paths.
 * Distilled from: packages/core/src/usecases/Controls/CreateControl/CreateControlUsecase.test.ts
 *
 * Illustrates (profile: .claude/ddd/usecase-design.md — worked example: create-profile/references/examples/audora/usecase-design.md):
 *  - `(params, steps)` constructor grouping (§2): repositories+generators in params, Validate*Step + MakeDefaultStepDueDateStep in steps
 *  - the GATE BYPASS (§4): test `executeTemplate` directly and set `sut.engagement = ENGAGEMENT`
 *    instead of driving the full validateMemberPermissions pipeline (tested in usecases/core/*)
 *  - one `mockReset` per mock in `afterEach` (§3)
 *  - a tiny `action` test alongside the `executeTemplate` tests (§9)
 *  - nested `describe('given …')` forming a decision tree, one error per guard (§4 recipe step 10)
 *  - sequenced same-mock calls via `mockReset().mockResolvedValueOnce(...)` + `toHaveBeenNthCalledWith`
 *  - building the EXACT expected entity with `new ControlEntity({...})` and `toStrictEqual`
 */

import {
  CompensatingCriterionRepository,
  ControlRepository,
  CriterionRepository,
  CriterionToControlRepository,
  DateGenerator,
  MembersRepository,
  UIDGenerator,
} from '@core/boundaries'
import { DuplicateEntityError, EntityNotFoundError, InvalidEntityStateError } from '@core/errors'
import {
  MakeDefaultStepDueDateStep,
  ValidateEngagementStep,
  ValidateIdentityStep,
  ValidateMemberPermissionsStep,
} from '@core/steps'
import { CriterionToControl } from '@core/types'
import { ControlEntity, ControlStatus, MemberRole, TaskType, UserStatus } from '@entities/entities'
import { EngagementActions } from '@entities/permissions'
import { ObjectId } from '@entities/value-objects'
import { MemberBuilder, Soc2Type1EngagementBuilder, UserBuilder } from '@fake-data'
import { mock, mockReset } from 'jest-mock-extended'
import {
  CompensatingCriterionBuilder,
  ControlEntityBuilder,
  CriterionBuilder,
  IdentityClaimsBuilder,
} from '~/tests/shared'
import { CreateControlUsecase } from './CreateControlUsecase'

describe(CreateControlUsecase.name, () => {
  const NOW = new Date('2021-04-20')
  const CONTROL_UID = new ObjectId('CONTROL_UID')
  const ENGAGEMENT_UID = new ObjectId('ENGAGEMENT_UID')
  const USER_UID = new ObjectId('USER_UID')

  const CONTROL_SLUG = 'controlSlug'
  const TITLE = 'title'
  const DESCRIPTION = 'description'
  const AUDIT_PROGRAM = 'auditProgram'
  const TEST_DETAILS = 'testDetails'
  const CRITERION_ID_1 = 'criterionId1'
  const CRITERION_ID_2 = 'criterionId2'
  const CRITERIA_IDS = [CRITERION_ID_1, CRITERION_ID_2]
  const ANALYST_UID = new ObjectId('ANALYST_UID')
  const REVIEWER_UID = new ObjectId('REVIEWER_UID')
  const ANALYST_USER_UID = new ObjectId('ANALYST_USER_UID')
  const REVIEWER_USER_UID = new ObjectId('REVIEWER_USER_UID')

  const DEFAULT_DUE_DATE = new Date('2023-05-02')
  const AUDIT_REPORT_DATE = new Date('2023-05-09')
  const AUDIT_AS_OF_DATE = new Date('2023-05-08')

  // params: repositories + generators
  const criteriaRepository = mock<CriterionRepository>()
  const controlsRepository = mock<ControlRepository>()
  const dateGenerator = mock<DateGenerator>()
  const uidGenerator = mock<UIDGenerator>()
  const membersRepository = mock<MembersRepository>()
  const criterionToControlsRepository = mock<CriterionToControlRepository>()
  const compensatingCriteriaRepository = mock<CompensatingCriterionRepository>()

  // steps: validation pipeline + a domain step
  const makeDefaultStepDueDateStep = mock<MakeDefaultStepDueDateStep>()
  const validateIdentityStep = mock<ValidateIdentityStep>()
  const validateEngagementStep = mock<ValidateEngagementStep>()
  const validateMemberPermissionsStep = mock<ValidateMemberPermissionsStep>()

  const sut = new CreateControlUsecase(
    {
      dateGenerator,
      uidGenerator,
      criteriaRepository,
      controlsRepository,
      membersRepository,
      criterionToControlsRepository,
      compensatingCriteriaRepository,
    },
    {
      makeDefaultStepDueDateStep,
      validateEngagementStep,
      validateIdentityStep,
      validateMemberPermissionsStep,
    },
  )

  afterEach(() => {
    mockReset(criterionToControlsRepository)
    mockReset(criteriaRepository)
    mockReset(controlsRepository)
    mockReset(membersRepository)
    mockReset(compensatingCriteriaRepository)
    mockReset(makeDefaultStepDueDateStep)
  })

  describe('action', () => {
    const runningTheSut = () => sut.action()

    it(`should return ${EngagementActions.AddControl}`, async () => {
      expect(runningTheSut()).toStrictEqual(EngagementActions.AddControl)
    })
  })

  describe('executeTemplate', () => {
    const IDENTITY = IdentityClaimsBuilder.build({ userId: USER_UID.value })
    const REQUEST = {
      engagementUid: ENGAGEMENT_UID,
      controlSlug: CONTROL_SLUG,
      title: TITLE,
      description: DESCRIPTION,
      criteriaIds: CRITERIA_IDS,
      auditProgram: AUDIT_PROGRAM,
      testDetails: TEST_DETAILS,
    }
    const INPUT = { identity: IDENTITY, request: REQUEST }

    const ENGAGEMENT = Soc2Type1EngagementBuilder.build({
      uid: ENGAGEMENT_UID,
      customData: {
        auditTimeline: {
          auditAsOfDate: AUDIT_AS_OF_DATE.toISOString(),
          auditReportDate: AUDIT_REPORT_DATE.toISOString(),
        },
      },
    })

    const runningTheSut = async () => await sut.executeTemplate(INPUT)

    beforeEach(() => {
      // GATE BYPASS (§4): set the aggregate the permission pipeline would load,
      // then test executeTemplate in isolation.
      sut.engagement = ENGAGEMENT
      makeDefaultStepDueDateStep.run.mockReturnValue({ dueDate: DEFAULT_DUE_DATE })
    })

    describe('given not all criteria exists', () => {
      beforeEach(() => {
        criteriaRepository.getByEngagementIdAndIds.mockResolvedValue([])
      })

      it('should throw an entity not found error', async () => {
        await expect(runningTheSut()).rejects.toStrictEqual(new EntityNotFoundError('Criterion'))

        expect(criteriaRepository.getByEngagementIdAndIds).toHaveBeenCalledTimes(1)
        expect(criteriaRepository.getByEngagementIdAndIds).toHaveBeenCalledWith(ENGAGEMENT_UID.value, CRITERIA_IDS)
      })
    })

    describe('given all criteria exists', () => {
      const CRITERION_1 = CriterionBuilder.build({ id: CRITERION_ID_1 })
      const CRITERION_2 = CriterionBuilder.build({ id: CRITERION_ID_2 })
      const CRITERIA = [CRITERION_1, CRITERION_2]

      beforeEach(() => {
        criteriaRepository.getByEngagementIdAndIds.mockResolvedValue(CRITERIA)
      })

      describe('given at least one criterion is compensated', () => {
        const compensatingCriterion = CompensatingCriterionBuilder.build({ criterionId: CRITERION_ID_1 })
        const compensatingCriteria = [compensatingCriterion]

        beforeEach(() => {
          compensatingCriteriaRepository.getByCriteriaIds.mockResolvedValue(compensatingCriteria)
        })

        it('should throw an invalid state error', async () => {
          await expect(runningTheSut()).rejects.toStrictEqual(new InvalidEntityStateError('Criterion', CRITERION_ID_1))

          expect(compensatingCriteriaRepository.getByCriteriaIds).toHaveBeenCalledTimes(1)
          expect(compensatingCriteriaRepository.getByCriteriaIds).toHaveBeenCalledWith(CRITERIA_IDS)
        })
      })

      describe('given no criterion is compensated', () => {
        beforeEach(() => {
          compensatingCriteriaRepository.getByCriteriaIds.mockResolvedValue([])
        })

        describe('given the slug already exists', () => {
          const control = ControlEntityBuilder.build({ taskId: CONTROL_SLUG })

          beforeEach(() => {
            controlsRepository.retrieveOne.mockResolvedValue(control)
          })

          it('should throw a duplicate entity error', async () => {
            await expect(runningTheSut()).rejects.toStrictEqual(new DuplicateEntityError('Control', CONTROL_SLUG))

            expect(controlsRepository.retrieveOne).toHaveBeenCalledTimes(1)
            expect(controlsRepository.retrieveOne).toHaveBeenCalledWith({
              engagementId: ENGAGEMENT_UID,
              taskIds: [CONTROL_SLUG],
            })
          })
        })

        describe('given the slug does not exist', () => {
          beforeEach(() => {
            controlsRepository.retrieveOne.mockResolvedValue(null)
          })

          describe('given the engagement analyst does not exist', () => {
            beforeEach(() => {
              membersRepository.retrieveOne.mockReset().mockResolvedValue(null)
            })

            it('should throw an invalid entity state error', async () => {
              await expect(runningTheSut()).rejects.toStrictEqual(new InvalidEntityStateError('Engagement', ENGAGEMENT_UID))

              expect(membersRepository.retrieveOne).toHaveBeenCalledTimes(1)
              expect(membersRepository.retrieveOne).toHaveBeenCalledWith({
                engagementUids: [ENGAGEMENT_UID],
                roles: [MemberRole.AuditorAnalyst],
                userNotInStatus: [UserStatus.Disabled],
              })
            })
          })

          describe('given the engagement analyst does exist', () => {
            const ANALYST_USER = UserBuilder.build({ uid: ANALYST_USER_UID })
            const ANALYST = MemberBuilder.build({ uid: ANALYST_UID, root: ANALYST_USER })

            beforeEach(() => {
              // Sequenced calls to the same mock: 1st = analyst, then reviewer below.
              membersRepository.retrieveOne.mockReset().mockResolvedValueOnce(ANALYST)
            })

            describe('given the engagement reviewer does not exist', () => {
              beforeEach(() => {
                membersRepository.retrieveOne.mockResolvedValueOnce(null)
              })

              it('should throw an invalid entity state error', async () => {
                await expect(runningTheSut()).rejects.toStrictEqual(new InvalidEntityStateError('Engagement', ENGAGEMENT_UID))

                expect(membersRepository.retrieveOne).toHaveBeenCalledTimes(2)
                expect(membersRepository.retrieveOne).toHaveBeenNthCalledWith(2, {
                  engagementUids: [ENGAGEMENT_UID],
                  roles: [MemberRole.AuditorReviewer],
                  userNotInStatus: [UserStatus.Disabled],
                })
              })
            })

            describe('given the engagement reviewer does exist', () => {
              const REVIEWER_USER = UserBuilder.build({ uid: REVIEWER_USER_UID })
              const REVIEWER = MemberBuilder.build({ uid: REVIEWER_UID, root: REVIEWER_USER })

              beforeEach(() => {
                membersRepository.retrieveOne.mockResolvedValue(REVIEWER)
                dateGenerator.next.mockReturnValue(NOW)
                uidGenerator.next.mockReturnValue(CONTROL_UID)
              })

              it('should determine the default due date', async () => {
                await runningTheSut()

                expect(makeDefaultStepDueDateStep.run).toHaveBeenCalledTimes(1)
                expect(makeDefaultStepDueDateStep.run).toHaveBeenCalledWith({
                  auditReportDate: AUDIT_REPORT_DATE,
                  taskType: TaskType.control,
                })
              })

              it('should save the control', async () => {
                const expected = new ControlEntity({
                  uid: CONTROL_UID,
                  taskId: CONTROL_SLUG,
                  title: TITLE,
                  description: DESCRIPTION,
                  engagementUid: ENGAGEMENT_UID,
                  auditProgram: AUDIT_PROGRAM,
                  status: ControlStatus.pendingEvidenceRequest,
                  testDetails: TEST_DETAILS,
                  analystUserUid: ANALYST_USER_UID,
                  reviewerUserUid: REVIEWER_USER_UID,
                  reporterUserUid: USER_UID,
                  relatedEvidenceRequestUids: [],
                  resolution: null,
                  resolutionDetails: null,
                  isIPERelevant: null,
                  ipeConsiderations: null,
                  frequency: null,
                  population: null,
                  samplingRationale: null,
                  dueDate: DEFAULT_DUE_DATE,
                  createdAt: NOW,
                  modifiedAt: NOW,
                })

                await runningTheSut()

                expect(controlsRepository.save).toHaveBeenCalledTimes(1)
                expect(controlsRepository.save).toHaveBeenCalledWith(expected)
              })

              it('should save the criterionToControl list', async () => {
                const expected: CriterionToControl[] = [
                  { controlId: CONTROL_UID.value, createdAt: NOW, criterionId: CRITERION_ID_1 },
                  { controlId: CONTROL_UID.value, createdAt: NOW, criterionId: CRITERION_ID_2 },
                ]

                await runningTheSut()

                expect(criterionToControlsRepository.saveMany).toHaveBeenCalledTimes(1)
                expect(criterionToControlsRepository.saveMany).toHaveBeenCalledWith(expected)
              })

              it('should return the control', async () => {
                const expected = new ControlEntity({
                  uid: CONTROL_UID,
                  taskId: CONTROL_SLUG,
                  title: TITLE,
                  description: DESCRIPTION,
                  engagementUid: ENGAGEMENT_UID,
                  auditProgram: AUDIT_PROGRAM,
                  status: ControlStatus.pendingEvidenceRequest,
                  testDetails: TEST_DETAILS,
                  analystUserUid: ANALYST_USER_UID,
                  reviewerUserUid: REVIEWER_USER_UID,
                  reporterUserUid: USER_UID,
                  relatedEvidenceRequestUids: [],
                  resolution: null,
                  resolutionDetails: null,
                  isIPERelevant: null,
                  ipeConsiderations: null,
                  frequency: null,
                  population: null,
                  samplingRationale: null,
                  dueDate: DEFAULT_DUE_DATE,
                  createdAt: NOW,
                  modifiedAt: NOW,
                })

                await expect(runningTheSut()).resolves.toStrictEqual(expected)
              })
            })
          })
        })
      })
    })
  })
})
