# Project Profile — Audora (`@audora/core`)

Domain layer at `packages/core/src/`. Ports-&-adapters; ~200 co-located Jest
tests. Apply this profile when writing tests under `packages/core/`.

## 1. Entry method(s)
- **Public entry method:** `execute(input)` — declared by `Interactor<Input, Output>` in `@core/boundaries` (`UseCase.ts`).
- **Inner business method:** `executeTemplate(input)` — abstract method each usecase implements; the base class's `execute()` runs the validation pipeline then calls it. **Tests target `executeTemplate` directly** (plus a tiny `action()` test). Steps implement `Step<In, Out>` with `run(input)`.

## 2. Constructor dependency grouping
- `new Sut(params, steps)` for most usecases.
- `new Sut(params, steps, factories)` when the usecase uses an entity factory (e.g. `CreateCommentUsecase` takes `{ commentFactory }` as a third arg).
- **`params`** = repositories, services, generators (`DateGenerator`, `UIDGenerator`), email/event services.
- **`steps`** = `Validate*Step`, `MakeDefaultStepDueDateStep`, etc.
- **`factories`** = `*Factory` from `@core/factories`.
- Steps are constructed `new SomeStep({ ...deps })` (single object) and implement `Step<In, Out>`.

## 3. Test-double library
- **Library:** `jest-mock-extended`.
- **Create a mock:** `mock<SomeInterface>()`.
- **Reset:** `mockReset(x)` inside `afterEach` (or `beforeEach`), one call per mock. No `mockDeep`.
- Returns: `mockResolvedValue` / `mockRejectedValue` (async), `mockReturnValue` / `mockReturnValueOnce` (sync — clocks, id-gens, sync steps). Use `mockReset().mockResolvedValueOnce(...)` to script sequenced calls (see complex example).

## 4. Pre-validated state injection (the gate bypass)
Base usecases run identity → engagement/aggregate → permission validation in
`execute()` before `executeTemplate()`. Tests skip that by calling
`executeTemplate(INPUT)` directly **and** setting the state the pipeline would
have produced via public setters on the SUT:
- `sut.engagement = ENGAGEMENT`
- `sut.currentUser = USER`
- `sut.currentMember = MEMBER`
Set only the ones the usecase's logic reads.
- The pipeline itself is tested centrally under `packages/core/src/usecases/core/*` (`CoreIdentityValidation`, `CoreMemberPermissionValidation`, `CoreUserPermissionValidation`) and per-step under `packages/core/src/steps/*` — **do not** re-test it in each usecase.

## 5. Base-class hierarchy
- `CoreIdentityValidation` — authenticates the identity (`validateIdentityStep`).
- `CoreMemberPermissionValidation` (extends above) — also validates engagement + member permissions.
- `CoreUserPermissionValidation` (extends Identity) — validates company-level user permissions.
- `BaseIdentityUsecase` / `BaseMemberPermissionUsecase` / `BaseUserPermissionUsecase` — implement `execute()` → validate → `executeTemplate()`.
- Domain bases: `BaseEngagementUsecase`, `BaseControlUsecase`, `BaseExceptionUsecase`, etc. — add `permissions()`, `task()`, `validateTransition()`. Each concrete usecase implements `action()` (the authorization action) + `executeTemplate()`.

## 6. Auxiliary collaborator ("steps") pattern
- **Yes** — usecases compose `Step<In, Out>` objects (`run(input)`), co-located under `packages/core/src/steps/<Name>Step/`.
- In usecase tests, steps are mocked (`mock<ValidateControlStep>()`, then `step.run.mockResolvedValue(...)`).
- Each step has its own co-located `*.test.ts` (instantiate with mocked deps, call `sut.run(input)`).

## 7. Import aliases / module map
(from `packages/core/jest.config.json` + `tsconfig.json`)

| Alias | Resolves to | Holds |
|---|---|---|
| `@core/*` | `packages/core/src/*` | `@core/boundaries`, `@core/steps`, `@core/errors`, `@core/factories`, `@core/types` |
| `@entities/*` | `packages/entities/src/*` | `@entities/entities`, `@entities/value-objects`, `@entities/permissions` |
| `@fake-data` | `packages/entities/tests/fakes/index.ts` | entity builders |
| `~/tests/*` | `packages/core/tests/*` | core-local builders (`~/tests/shared`) |

## 8. Builder / fixture locations
- **Entity builders** (`@fake-data`): `UserBuilder`, `MemberBuilder`, `Soc2Type1EngagementBuilder`, `CommentEntityBuilder`, `OnboardingTaskBuilder`, …
- **Core-local builders** (`~/tests/shared`): `IdentityClaimsBuilder`, `ControlEntityBuilder`, `CriterionBuilder`, `CompensatingCriterionBuilder`, `ExceptionEntityBuilder`, `EvidenceRequestEntityBuilder`, `AuditTemplateBuilder`, `CompanyBuilder`, `IntegrationBuilder`, … (see `packages/core/tests/shared/index.ts`).
- **API:** `XBuilder.build({ overrides })`; `ManyBuilder`s also have `buildMany(n, overrides)`. Backed by `@faker-js/faker` defaults.
- `IdentityClaimsBuilder` is a plain `Builder` (returns an object, no `buildMany`).

## 9. File placement + naming
- **Placement:** co-located next to the source file in the same folder.
- **Suffix:** `.test.ts` (never `.spec.ts`).
- **Suite:** `describe(SutClass.name, () => { … })` — use `.name`, not a string.
- **Method groups:** `describe('executeTemplate', …)`, `describe('action', …)`; scenarios via `describe('given …', …)`; `describe.each([...])('given <%s>', …)` for parameterized cases.
- **Constants:** `UPPER_SNAKE_CASE` (`const NOW = new Date('2021-04-20')`, `const USER_UID = new ObjectId('USER_UID')`).
- **Act wrapper:** `const runningTheSut = async () => await sut.executeTemplate(INPUT)`.
- **Errors:** `await expect(runningTheSut()).rejects.toStrictEqual(new EntityNotFoundError('Control', CONTROL_UID))`.

## 10. Run command
- Single file: `yarn workspace @audora/core test <relative path>` (or from the package dir: `yarn test <path>`).
- Watch: `yarn test:watch`; coverage: `yarn test:coverage`.
- Config: `preset: ts-jest`, `testMatch: ["**/*.test.ts"]`, moduleNameMapper per §7.

## 11. Live exemplars (real files to imitate)
- Simple: `packages/core/src/usecases/Users/GetCurrentUserUsecase/GetCurrentUserUsecase.test.ts`
- Complex: `packages/core/src/usecases/Controls/CreateControl/CreateControlUsecase.test.ts`
- Parameterized + factory: `packages/core/src/usecases/Comments/CreateComment/CreateComment.test.ts`
- Step: `packages/core/src/steps/ValidateControlStep/ValidateControlStep.test.ts`
- Factory: `packages/core/src/factories/FileFactory/FileFactory.test.ts`
