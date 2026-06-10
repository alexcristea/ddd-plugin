---
name: usecase-tests
description: Write unit tests for domain usecases in DDD / Clean Architecture projects — recognize the Interactor contract, mock every injected port, isolate the usecase from cross-cutting validation, build given/scenario trees, and use builders for test data. Use when writing or updating usecase, step, or factory unit tests. Load the project profile from .claude/ddd/usecase-tests.md in the target repo first; if missing, run ddd:create-profile.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Unit-testing domain usecases (DDD / Clean Architecture)

This skill writes **unit tests** for the domain/application layer of a Clean
Architecture codebase. It is grounded in the **usecase pattern**: knowing the
contract is what makes the test correct. It does **not** generate usecase
implementations.

The methodology here is generic. Everything that varies per repository —
method names, mock library, import aliases, where builders live, how to inject
pre-validated state — lives in a **Project Profile**. Load that first.

---

## 1. When to use / when not

**Use** for unit tests of:
- Usecases / interactors (the application-service layer).
- Steps / smaller invokable collaborators a usecase composes (if the project has them).
- Factories (objects that build domain entities from primitives).

**Do not use** for:
- Integration tests, HTTP-handler/controller tests, or repository-adapter tests that touch a real DB or network.
- Entity/value-object tests (those test invariants directly, no mocking).

A unit test here mocks **every** collaborator and asserts behavior in pure isolation.

---

## 2. The usecase pattern (foundation)

Before writing a single assertion, read the usecase and extract its contract.
A usecase in this architecture is:

- A class implementing an **`Interactor<Input, Output>`-style interface** — i.e. it has **exactly one public entry method** (commonly `execute`; the exact name is in the profile).
- Constructed with **all collaborators injected** — repositories, services, generators/clocks, gateways, and factories. These are frequently grouped into one or more constructor argument objects (e.g. `(dependencies)`, or `(dependencies, steps)`, or `(dependencies, steps, factories)` — see profile).

This contract drives the entire test:

| From the contract | What it tells the test |
|---|---|
| The single entry method | The one function you call in **Act** (`runningTheSut`). |
| Each injected collaborator | One mock to create, stub, and assert against. |
| Input type | What you build (via builders) and pass in. |
| Output type / side effects | What you assert on (return value + collaborator calls). |

**Procedure:** open the usecase → list its constructor params (every one becomes
a mock) → find its entry method → note its Input/Output → derive the skeleton in §8.

---

## 3. Step 0 — load the Project Profile

Read the profile that matches the repo before writing tests:

1. Look for `.claude/ddd/usecase-tests.md` in the target repo root. When present,
   it is the source of truth for every project-specific slot referenced below.
2. If it is missing, follow **`ddd:create-profile`** to derive one by reading
   **one existing usecase test** in the repo, confirm ambiguous slots with the
   user, and **write it to `.claude/ddd/usecase-tests.md` in the target repo** —
   so it is found next time and shared with the team.
3. For a fully worked example of a completed profile, see
   `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/usecase-tests.md`.

The profile supplies: entry-method name(s), constructor dependency grouping,
test-double library, how to inject pre-validated state, base-class hierarchy,
the "steps"/collaborator pattern (if any), import aliases, builder locations,
file placement + naming, and the run command.

---

## 4. The generic recipe

1. **Recognize the contract** (§2): entry method + injected collaborators.
2. **Co-locate the test file** and name it per the profile (e.g. `Foo.ts` → `Foo.test.ts`).
3. **Create one mock per collaborator** at suite scope (see §5).
4. **Instantiate the SUT once** at suite scope, injecting the mocks in the profile's grouping.
5. **Reset mocks between tests** (`afterEach`/`beforeEach`, per profile).
6. **Inject pre-validated state if needed** (§7) — for usecases gated by a validation pipeline.
7. **Build a scenario tree**: nested `describe('given …')`, parameterized `describe.each`, one `it('should …')` per behavior.
8. **Act through a `runningTheSut` wrapper** calling the entry method.
9. **Assert** on: return value (deep-equal), collaborator interactions (called-with / called-times), and thrown domain errors.
10. **Cover the error paths** — every guard/throw in the usecase gets its own `given`.

---

## 5. Mocking cheatsheet

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

## 6. Builders / factories for test data

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
import alias. (Domain **factories** — the production objects that construct
entities — are themselves tested like a SUT: see `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/factory.test.ts`.)

---

## 7. Isolating from cross-cutting validation

Many usecases inherit a base class that runs a validation/permission pipeline
(authenticate identity → load aggregate → check permissions) *before* the
business logic. **Do not re-test that pipeline in every usecase** — it has its
own tests. Instead, test the business logic in isolation:

- Call the **inner business method** directly (the profile names it — e.g. an `executeTemplate` invoked by the public `execute`), **and/or**
- **Set the already-validated state** the pipeline would have produced, via the base class's setters (e.g. the loaded aggregate, the current user, the current member — exact names in the profile).

This keeps each usecase test focused on *its* logic, with the gate covered once,
centrally. See the profile for the exact bypass and `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/examples/` for it in action.

---

## 8. Condensed skeleton

Derived directly from the §2 contract. Replace `<<…>>` with profile values.

```ts
// imports: SUT, mock lib, error types, builders — all via the profile's aliases

describe(Sut.name, () => {
  // 1. constants (UPPER_SNAKE_CASE): ids, dates, primitives
  const NOW = new Date('2021-01-01')

  // 2. one mock per injected collaborator (§2/§5)
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
      // inject pre-validated state if the usecase is gated (§7)
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

## 9. Reference files

Generic, library-neutral templates (read these first):
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/usecase.test.ts` — annotated usecase test with neutral names.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/factory.test.ts` — annotated factory test (`make`/`clone`, immutability).

Project profile (owned by `ddd:create-profile`):
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/usecase-tests.md` — blank fill-in template (the portability seam).
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/usecase-tests.md` — a fully worked profile.

Worked examples for the Audora profile:
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/examples/audora/usecase-simple.test.ts` — identity-gated read.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/examples/audora/usecase-complex.test.ts` — permission-gated, nested `given`s, error paths.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/examples/audora/usecase-parameterized.test.ts` — `describe.each` + factory dependency.
- `${CLAUDE_PLUGIN_ROOT}/skills/usecase-tests/references/examples/audora/step.test.ts` — a composed Step collaborator.

When working in a profiled repo, also point yourself at 1–2 real, recent test
files named in the profile as live exemplars.
