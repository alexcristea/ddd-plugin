/**
 * AUDORA EXAMPLE — parameterized scenarios + a factory dependency.
 * Distilled (abridged) from: packages/core/src/usecases/Comments/CreateComment/CreateComment.test.ts
 * See that file for the full set of mention/notification branches.
 *
 * Illustrates (profile: .claude/ddd/usecase-design.md — worked example: create-profile/references/examples/audora/usecase-design.md):
 *  - the THREE-ARG constructor (§2): `(params, steps, factories)` — note `{ commentFactory }`
 *  - GATE BYPASS (§4) with multiple setters: `sut.engagement`, `sut.currentUser`, `sut.currentMember`
 *  - `describe.each([...])('given the comment type is <%s>', (commentType, foreignKey) => {…})`
 *    to run the same behavior across an enum, building the right entity per case
 *  - asserting on a side-effecting service mock (emailService) with `toHaveBeenNthCalledWith`
 */

import {
  CommentMentionNotification,
  CommentsRepository,
  ControlExceptionRepository,
  EmailService,
  MembersRepository,
  TaskRepository,
} from '@core/boundaries'
import { EntityNotFoundError } from '@core/errors'
import { CommentFactory } from '@core/factories'
import { ValidateEngagementStep, ValidateIdentityStep, ValidateMemberPermissionsStep } from '@core/steps'
import { CommentType, TaskEntity, TaskType, TenantType } from '@entities/entities'
import { EngagementActions } from '@entities/permissions'
import { ObjectId } from '@entities/value-objects'
import {
  CommentEntityBuilder,
  MemberBuilder,
  OnboardingTaskBuilder,
  Soc2Type1EngagementBuilder,
  UserBuilder,
} from '@fake-data'
import { mock, mockReset } from 'jest-mock-extended'
import {
  ControlEntityBuilder,
  EvidenceRequestEntityBuilder,
  ExceptionEntityBuilder,
  IdentityClaimsBuilder,
} from '~/tests/shared'
import { CreateCommentRequest, CreateCommentUsecase } from './CreateComment'

describe(CreateCommentUsecase.name, () => {
  // params
  const tasksRepository = mock<TaskRepository>()
  const membersRepository = mock<MembersRepository>()
  const commentsRepository = mock<CommentsRepository>()
  const emailService = mock<EmailService>()
  const exceptionsRepository = mock<ControlExceptionRepository>()
  // factory (third constructor arg)
  const commentFactory = mock<CommentFactory>()
  // steps
  const validateIdentityStep = mock<ValidateIdentityStep>()
  const validateEngagementStep = mock<ValidateEngagementStep>()
  const validateMemberPermissionsStep = mock<ValidateMemberPermissionsStep>()

  const sut = new CreateCommentUsecase(
    { tasksRepository, membersRepository, commentsRepository, emailService, exceptionsRepository },
    { validateIdentityStep, validateEngagementStep, validateMemberPermissionsStep },
    { commentFactory },
  )

  afterEach(() => {
    mockReset(tasksRepository)
    mockReset(membersRepository)
    mockReset(commentsRepository)
    mockReset(emailService)
    mockReset(exceptionsRepository)
    mockReset(validateIdentityStep)
    mockReset(validateEngagementStep)
  })

  describe('action', () => {
    it('should return the view action', () => {
      expect(sut.action()).toStrictEqual(EngagementActions.View)
    })
  })

  describe('executeTemplate', () => {
    const UID = new ObjectId('UID')
    const NOW = new Date()
    const USER_UID = new ObjectId('USER_UID')
    const ENGAGEMENT_UID = new ObjectId('ENGAGEMENT_UID')
    const EVIDENCE_REQUEST_UID = new ObjectId('EVIDENCE_REQUEST_UID')
    const CONTROL_UID = new ObjectId('CONTROL_UID')
    const EXCEPTION_UID = new ObjectId('EXCEPTION_UID')
    const ONBOARDING_TASK_UID = new ObjectId('ONBOARDING_TASK_UID')

    const IDENTITY = IdentityClaimsBuilder.build({ userId: USER_UID.value, tenantType: TenantType.customer })

    const REQUEST: CreateCommentRequest = {
      engagementUid: ENGAGEMENT_UID,
      foreignKey: EVIDENCE_REQUEST_UID.value,
      type: CommentType.EVIDENCE_REQUEST,
      content: 'Comment',
      mentions: [],
    }
    const INPUT = { identity: IDENTITY, request: REQUEST }
    const runningTheSut = async () => await sut.executeTemplate(INPUT)

    const engagement = Soc2Type1EngagementBuilder.build({ uid: ENGAGEMENT_UID })
    sut.engagement = engagement // gate bypass: aggregate already loaded

    describe('given the task does not exist', () => {
      beforeEach(() => {
        tasksRepository.retrieveOne.mockResolvedValue(null)
      })

      it('should throw entity not found error', async () => {
        await expect(runningTheSut).rejects.toStrictEqual(
          new EntityNotFoundError(TaskType.evidenceRequest, EVIDENCE_REQUEST_UID),
        )
        expect(tasksRepository.retrieveOne).toHaveBeenCalledWith({
          engagementUids: [ENGAGEMENT_UID],
          uids: [EVIDENCE_REQUEST_UID],
        })
      })
    })

    describe('given the task does exist', () => {
      const USER = UserBuilder.build({ uid: USER_UID })
      const USER_MEMBER = MemberBuilder.build({ root: USER, tenantType: IDENTITY.tenantType })
      const USER_B = UserBuilder.build({ uid: new ObjectId('USER_B') })

      beforeEach(() => {
        // gate bypass: the two principals the permission pipeline would resolve
        sut.currentUser = USER
        sut.currentMember = USER_MEMBER
        membersRepository.retrieveMany.mockResolvedValue([USER_MEMBER])
      })

      // Run the SAME behavior across every comment type, picking the matching
      // task builder per case. `<%s>` interpolates the param into the name.
      describe.each([
        [CommentType.EVIDENCE_REQUEST, EVIDENCE_REQUEST_UID],
        [CommentType.CONTROL, CONTROL_UID],
        [CommentType.EXCEPTION, EXCEPTION_UID],
        [CommentType.ONBOARDING_TASK, ONBOARDING_TASK_UID],
      ])('given the comment type is <%s>', (commentType, foreignKey) => {
        let TASK: TaskEntity<unknown>

        beforeEach(() => {
          REQUEST.type = commentType
          REQUEST.foreignKey = foreignKey.value

          switch (commentType) {
            case CommentType.CONTROL:
              TASK = ControlEntityBuilder.build({ uid: foreignKey })
              break
            case CommentType.EVIDENCE_REQUEST:
              TASK = EvidenceRequestEntityBuilder.build({ uid: foreignKey })
              break
            case CommentType.EXCEPTION:
              TASK = ExceptionEntityBuilder.build({ uid: foreignKey })
              break
            case CommentType.ONBOARDING_TASK:
              TASK = OnboardingTaskBuilder.build({ uid: foreignKey })
              break
          }

          tasksRepository.retrieveOne.mockResolvedValue(TASK)
        })

        describe('given there are no mentions', () => {
          const COMMENT = CommentEntityBuilder.build({
            uid: UID,
            engagementUid: ENGAGEMENT_UID,
            type: commentType,
            foreignKey,
            content: REQUEST.content,
            createdBy: USER.uid,
            mentions: [],
            createdAt: NOW,
            modifiedAt: NOW,
          })

          beforeEach(() => {
            REQUEST.mentions = []
            // the injected FACTORY is mocked like any collaborator:
            commentFactory.make.mockReturnValue(COMMENT)
          })

          it('should persist the comment built by the factory', async () => {
            await runningTheSut()

            expect(commentsRepository.save).toHaveBeenCalledTimes(1)
            expect(commentsRepository.save).toHaveBeenCalledWith(COMMENT)
            // no mentions -> no notification emails
            expect(emailService.sendCommentMentionNotification).not.toHaveBeenCalled()
          })
        })

        describe('given there are mentions', () => {
          const COMMENT = CommentEntityBuilder.build({
            uid: UID,
            engagementUid: ENGAGEMENT_UID,
            type: commentType,
            foreignKey,
            content: REQUEST.content,
            createdBy: USER.uid,
            mentions: [USER_B.uid],
            createdAt: NOW,
            modifiedAt: NOW,
          })

          beforeEach(() => {
            REQUEST.mentions = [{ id: USER_B.uid.value }]
            commentFactory.make.mockReturnValue(COMMENT)
            membersRepository.retrieveMany.mockResolvedValue([USER_MEMBER, MemberBuilder.build({ root: USER_B })])
          })

          it('should notify each mentioned member', async () => {
            await runningTheSut()

            // assert a side-effecting service was called per mention, in order
            expect(emailService.sendCommentMentionNotification).toHaveBeenCalledTimes(1)
            expect(emailService.sendCommentMentionNotification).toHaveBeenNthCalledWith(
              1,
              expect.objectContaining<Partial<CommentMentionNotification>>({
                to: expect.objectContaining({ uid: USER_B.uid }),
                from: USER,
                comment: COMMENT,
              }),
            )
          })
        })
      })
    })
  })
})
