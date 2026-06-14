# Project Profile — <PROJECT NAME>

> Fill one of these per repository. It captures everything project-specific that
> the generic `SKILL.md` defers to. Copy this file to
> `.claude/ddd/usecase-design.md` **in the target repo** and complete every slot.
> Derive values by reading one existing usecase and its test in the target repo.

## 1. Entry method(s)
- **Public entry method:** `<<execute>>` — the single `Interactor` method.
- **Inner business method (if any):** `<<executeTemplate>>` — called by the public method after a base-class validation pipeline; tests usually target this directly. (Leave blank if the usecase has no base-class gate.)

## 2. Constructor dependency grouping
How collaborators are passed to the constructor. Examples:
- `new Sut(dependencies)` — single object, **or**
- `new Sut(dependencies, steps)` — **or**
- `new Sut(dependencies, steps, factories)`

State the exact grouping and which kinds of collaborator go in each object:
- `dependencies`: `<<repositories, services, generators/clocks, gateways>>`
- `steps`: `<<smaller invokable collaborators, if used>>`
- `factories`: `<<entity factories, if passed separately>>`

## 3. Test-double library
- **Library:** `<<jest-mock-extended | plain jest.fn() | sinon | …>>`
- **Create a mock:** `<<mock<T>()>>`
- **Reset between tests:** `<<mockReset(x) in afterEach | jest.resetAllMocks()>>`
- **Deep mocking used?** `<<no | yes (mockDeep) — when>>`

## 4. Pre-validated state injection (the gate bypass)
If usecases inherit a validation/permission pipeline, how do tests inject the
state it would have produced, so the business method can be tested in isolation?
- Setters available on the SUT: `<<sut.aggregate = …, sut.currentUser = …, sut.currentMember = …>>`
- Where the pipeline itself is tested (so it is NOT re-tested per usecase): `<<path, e.g. usecases/core/*>>`

## 5. Base-class hierarchy
List the base usecase classes and what each validates/provides:
- `<<CoreIdentityValidation>>` — `<<authenticates identity>>`
- `<<CoreMemberPermissionValidation / CoreUserPermissionValidation>>` — `<<…>>`
- Convenience bases: `<<BaseXUsecase…>>`

## 6. Auxiliary collaborator ("steps") pattern
- **Does the project decompose usecases into smaller invokable units?** `<<yes/no>>`
- **Interface:** `<<Step<In, Out> with run(input)>>`
- **In tests:** mock them like any other dependency; each has its own co-located test.

## 7. Import aliases / module map
| Alias | Resolves to | Holds |
|---|---|---|
| `<<@core/*>>` | `<<src/*>>` | boundaries, steps, errors, factories, types |
| `<<@entities/*>>` | `<<…>>` | entities, value-objects, permissions |
| `<<@fake-data>>` | `<<…>>` | entity builders |
| `<<~/tests/*>>` | `<<…>>` | project-local builders |

## 8. Builder / fixture locations
- Entity builders: `<<alias + names: UserBuilder, …>>`
- Project-local builders: `<<alias + names: …>>`
- Builder API: `<<build(overrides) / buildMany(n, overrides)>>`

## 9. File placement + naming
- **Placement:** `<<co-located next to source>>`
- **Suffix:** `<<.test.ts (never .spec.ts)>>`
- **Suite name:** `<<describe(Sut.name, …)>>`
- **Constants:** `<<UPPER_SNAKE_CASE>>`
- **Act wrapper:** `<<const runningTheSut = async () => await sut.<<entry>>(INPUT)>>`

## 10. Run command
- Single file: `<<yarn workspace <pkg> test <path>>>`
- Watch / coverage: `<<…>>`
- Config notes: `<<preset, testMatch, moduleNameMapper>>`

## 11. Live exemplars (real files to imitate)
- `<<path/to/SimpleUsecase.test.ts>>`
- `<<path/to/ComplexUsecase.test.ts>>`
