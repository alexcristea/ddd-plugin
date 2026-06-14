---
name: usecase-design
description: Design and unit-test domain usecases / interactors in DDD / Clean Architecture projects — model the Interactor contract (one entry method, injected ports), compose steps and factories, keep cross-cutting validation in a base-class gate, then unit-test by mocking every injected port with given/scenario trees and builder-backed data. Use when designing, refactoring, or writing unit tests for a usecase, interactor, step, or domain factory.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Designing & unit-testing domain usecases (DDD / Clean Architecture)

This skill designs and unit-tests the **application layer** of a Clean
Architecture codebase — **usecases / interactors**, the **steps** they compose,
and the **factories** that build entities from primitives. It is the layer that
orchestrates the domain model (`ddd:entity-design`) by calling **ports**
implemented in the persistence layer (`ddd:repository-design`); it owns no SQL,
HTTP, or framework detail of its own.

The design half and the test half share one foundation: **the Interactor
contract**. Knowing the contract is what makes both the implementation correct
and the test correct.

The methodology here is generic. Everything that varies per repository —
method names, base-class hierarchy, mock library, import aliases, where builders
and factories live, how to inject pre-validated state — lives in a **Project
Profile**. Load that first (§3).

---

## 1. When to use / when not

**Use** for designing or unit-testing:
- **Usecases / interactors** — the application-service layer (one public entry method, injected collaborators).
- **Steps** — smaller invokable collaborators a usecase composes (if the project has them).
- **Factories** — objects that build domain entities from primitives.

**Do not use** for:
- Entity / value-object / aggregate design or invariant tests → use **`ddd:entity-design`**.
- Repository / query-builder / mapper design or tests → use **`ddd:repository-design`**.
- Integration tests, or HTTP-handler / controller tests that touch a real DB, network, or framework runtime.

A unit test here mocks **every** collaborator and asserts behavior in pure
isolation. A usecase here orchestrates ports and domain objects — it never
reaches for infrastructure directly.

---

## 2. The usecase pattern (foundation)

Whether designing or testing, first establish the contract. A usecase in this
architecture is:

- A class implementing an **`Interactor<Input, Output>`-style interface** — it has **exactly one public entry method** (commonly `execute`; the exact name is in the profile).
- Constructed with **all collaborators injected** — repositories, services, generators/clocks, gateways, and factories. These are frequently grouped into one or more constructor argument objects (e.g. `(dependencies)`, or `(dependencies, steps)`, or `(dependencies, steps, factories)` — see profile).
- Often extending a **validation/permission base class** that runs a cross-cutting pipeline (authenticate identity → load aggregate → check permission) *before* delegating to an inner business method.

This contract drives both the implementation and the test:

| From the contract | What it tells the design | What it tells the test |
|---|---|---|
| The single entry method | The one orchestration you write. | The one function you call in **Act** (`runningTheSut`). |
| Each injected collaborator | A port you depend on (interface, not concretion). | One mock to create, stub, and assert against. |
| Input type | What the method accepts and validates. | What you build (via builders) and pass in. |
| Output type / side effects | What you return and which collaborators you call. | What you assert on (return value + collaborator calls). |

**Procedure:** open (or sketch) the usecase → list its constructor params (every
one is an injected port / a mock) → fix its entry method → note its Input/Output
→ design with §4, test with §5.

---

## 3. Step 0 — load the Project Profile

Read the profile that matches the repo before designing or testing:

1. Look for `.claude/ddd/usecase-design.md` in the target repo root. When present,
   it is the source of truth for every project-specific slot referenced below.
2. If it is missing, **do not create one automatically.** Proceed with this
   skill's generic methodology, deriving the project-specific slots for *this
   session* by reading the repo's existing exemplars directly (one existing
   usecase plus its test — ideally one simple, one permission-gated). Once done,
   you may **suggest** the user run **`ddd:create-profile`** to capture those
   conventions in a committed `.claude/ddd/usecase-design.md` for next time — but
   only create that file when they ask.
3. For a fully worked example of a completed profile, see
   `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/usecase-design.md`.

The profile supplies: entry-method name(s), constructor dependency grouping,
base-class hierarchy, the validation-pipeline bypass, the steps/factories pattern
(if any), test-double library, import aliases, builder/factory locations, file
placement + naming, and the run command.

---

## 4. Designing a usecase / interactor

Design the usecase from its contract (§2), keeping it a **thin orchestrator**:

1. **Declare the contract.** `class FooUsecase implements Interactor<FooInput, FooOutput>`
   (profile names the interface). Define the `Input`/`Output` types explicitly —
   they are the seam the caller (a handler) depends on.
2. **Inject ports, not concretions.** Take every collaborator through the
   constructor in the profile's grouping (`dependencies`, optionally `steps`,
   `factories`). Depend on the **interface** (`FooRepository`, `Clock`,
   `IdGenerator`) so the test can mock it and the persistence layer can swap
   implementations.
3. **Put cross-cutting validation in the base class, not the body.** If the
   project has a validation/permission base (profile §5), extend it: the gate
   (authenticate identity → load aggregate → check permission) lives in the base
   and runs *before* your logic. Implement the **inner business method** (e.g.
   `executeTemplate`) that the public `execute` calls once the gate passes — so
   the gate is written and tested once, centrally (§8).
4. **Write the business method as orchestration:** load via repositories → guard
   each precondition (throw a typed domain error, §4.6) → drive domain objects
   (let entities/aggregates enforce their own invariants — **don't re-implement
   entity logic here**) → persist via the port → return the `Output`.
5. **Decompose into Steps** when a unit of logic is reused across usecases or is
   worth testing independently (profile §6). A Step is just another injected
   collaborator (`Step<In, Out>` with `run(input)`); compose, don't inline.
6. **Build entities through factories, throw typed errors.** Construct entities
   from primitives via the project's **domain factories** (not inline `new`), and
   raise the project's `*Error` types on guard violations — never a bare
   `throw new Error('msg')` in a business path, so callers and tests can match the
   type.
7. **Keep infrastructure out.** No SQL, HTTP, env, or framework calls — those are
   adapter concerns. One transaction boundary per usecase; reads are idempotent.

See `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/usecase.ts` for an
annotated, library-neutral interactor. Domain **factories** (the production
objects that construct entities) are designed and tested like a SUT — see
`${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/factory.test.ts`.

---

## 5. The generic test recipe

1. **Recognize the contract** (§2): entry method + injected collaborators.
2. **Co-locate the test file** and name it per the profile (e.g. `Foo.ts` → `Foo.test.ts`).
3. **Create one mock per collaborator** at suite scope (see §6).
4. **Instantiate the SUT once** at suite scope, injecting the mocks in the profile's grouping.
5. **Reset mocks between tests** (`afterEach`/`beforeEach`, per profile).
6. **Inject pre-validated state if needed** (§8) — for usecases gated by a validation pipeline.
7. **Build a scenario tree**: nested `describe('given …')`, parameterized `describe.each`, one `it('should …')` per behavior.
8. **Act through a `runningTheSut` wrapper** calling the entry method.
9. **Assert** on: return value (deep-equal), collaborator interactions (called-with / called-times), and thrown domain errors.
10. **Cover the error paths** — every guard/throw in the usecase gets its own `given`.

---

## 6. Mocking cheatsheet

Two dominant idioms (the profile names which the repo uses):

**`jest-mock-extended` (type-driven, preferred when available):**
```ts
import { mock, mockReset } from 'jest-mock-extended'

const fooRepository = mock<FooRepository>()   // every method auto-stubbed
fooRepository.retrieve.mockResolvedValue(foo) // async return
fooRepository.retrieve.mockRejectedValue(err) // async throw
clock.now.mockReturnValue(NOW)                // sync return
uid.next.mockReturnValueOnce(UID)             // single-use return

afterEach(() => mockReset(fooRepository))      // clear history + impls
```

**Plain Jest doubles (fallback):**
```ts
const fooRepository = { retrieve: jest.fn(), save: jest.fn() }
afterEach(() => jest.resetAllMocks())
```

The four return shapes you need: `mockResolvedValue` / `mockRejectedValue`
(promises), `mockReturnValue` / `mockReturnValueOnce` (sync, e.g. clocks and
id-generators). Avoid deep auto-mocking unless the profile says otherwise.

---

## 7. Builders / factories for test data

Never hand-assemble domain entities inline. Use the project's **builders**
(test-data factories), which fill sensible random defaults and accept overrides:

```ts
const user = UserBuilder.build({ uid: USER_UID })   // override only what matters
const users = UserBuilder.buildMany(3)              // many at once
```

Typical builder interface:
```ts
interface Builder<Model, Params = Model> { build(overrides?: Partial<Params>): Model }
interface ManyBuilder<Model, Params = Model> extends Builder<Model, Params> {
  buildMany(count: number, overrides?: Partial<Params>): Model[]
}
```

Override **only** the fields the test asserts on; leave the rest as defaults so
the test states its intent. The profile lists where builders live and their
import alias. Capture `const NOW = new Date()` once so timestamps don't drift
within a build (see `ddd:entity-design` §11 for the builder contract in full).
Domain **factories** — the production objects that construct entities — are
themselves tested like a SUT: see
`${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/factory.test.ts`.

---

## 8. Isolating from cross-cutting validation

Many usecases inherit a base class that runs a validation/permission pipeline
(authenticate identity → load aggregate → check permissions) *before* the
business logic (designed in §4.3). **Do not re-test that pipeline in every
usecase** — it has its own tests. Instead, test the business logic in isolation:

- Call the **inner business method** directly (the profile names it — e.g. an `executeTemplate` invoked by the public `execute`), **and/or**
- **Set the already-validated state** the pipeline would have produced, via the base class's setters (e.g. the loaded aggregate, the current user, the current member — exact names in the profile).

This keeps each usecase test focused on *its* logic, with the gate covered once,
centrally. See the profile for the exact bypass and
`${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/examples/` for it in action.

---

## 9. Condensed skeleton

Derived directly from the §2 contract. Replace `<<…>>` with profile values.

```ts
// imports: SUT, mock lib, error types, builders — all via the profile's aliases

describe(Sut.name, () => {
  // 1. constants (UPPER_SNAKE_CASE): ids, dates, primitives
  const NOW = new Date('2021-01-01')

  // 2. one mock per injected collaborator (§2/§6)
  const fooRepository = mock<FooRepository>()
  const barService = mock<BarService>()

  // 3. SUT once, mocks injected in the profile's grouping
  const sut = new Sut(
    { fooRepository, barService },
    /* steps/factories objects if the profile uses them */
  )

  // 4. reset between tests
  afterEach(() => { mockReset(fooRepository); mockReset(barService) })

  describe(/* <<entry or inner method>> */ 'execute', () => {
    const INPUT = { /* built with builders */ }
    const runningTheSut = async () => await sut.execute(INPUT)

    beforeEach(() => {
      // inject pre-validated state if the usecase is gated (§8)
      // sut.<<aggregate>> = AGGREGATE ; sut.<<currentUser>> = USER
    })

    describe('given <a precondition>', () => {
      beforeEach(() => { fooRepository.retrieve.mockResolvedValue(null) })

      it('should throw <DomainError>', async () => {
        await expect(runningTheSut()).rejects.toStrictEqual(new EntityNotFoundError('Foo'))
        expect(fooRepository.retrieve).toHaveBeenCalledWith(/* args */)
      })
    })

    describe('given <the happy precondition>', () => {
      beforeEach(() => { fooRepository.retrieve.mockResolvedValue(foo) })

      it('should persist and return the result', async () => {
        const expected = /* builder or `new Entity({...})` */
        await expect(runningTheSut()).resolves.toStrictEqual(expected)
        expect(fooRepository.save).toHaveBeenCalledTimes(1)
        expect(fooRepository.save).toHaveBeenCalledWith(expected)
      })
    })
  })
})
```

Assertions used throughout: `toStrictEqual`, `resolves.toStrictEqual`,
`rejects.toStrictEqual(new SomeError(...))`, `toHaveBeenCalledTimes`,
`toHaveBeenCalledWith`, `toHaveBeenNthCalledWith`.

---

## 10. Reference files

Generic, library-neutral templates (read these first):
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/usecase.ts` — annotated interactor implementation with neutral names.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/usecase.test.ts` — annotated usecase test with neutral names.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/factory.test.ts` — annotated factory test (`make`/`clone`, immutability).

Project profile (owned by `ddd:create-profile`):
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/usecase-design.md` — blank fill-in template (the portability seam).
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/usecase-design.md` — a fully worked profile.

Worked examples for the Audora profile:
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/examples/audora/usecase-simple.test.ts` — identity-gated read.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/examples/audora/usecase-complex.test.ts` — permission-gated, nested `given`s, error paths.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/examples/audora/usecase-parameterized.test.ts` — `describe.each` + factory dependency.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-design/references/examples/audora/step.test.ts` — a composed Step collaborator.

When working in a profiled repo, also point yourself at 1–2 real, recent usecases
and test files named in the profile as live exemplars.
</content>
