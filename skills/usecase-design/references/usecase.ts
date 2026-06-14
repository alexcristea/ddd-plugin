// Generic usecase / interactor reference (neutral names; not compiled).
//
// A usecase is a THIN ORCHESTRATOR of the application layer. It implements an
// Interactor<Input, Output> contract (one public entry method), depends only on
// injected PORTS (interfaces), and coordinates domain objects + repositories to
// fulfil one application operation. It owns no SQL / HTTP / framework detail —
// those are adapter concerns. Adapt the base class, method names, grouping, error
// types, and factory conventions to the Project Profile (.claude/ddd/usecase-design.md).

import { Interactor } from '<interactor-contract-alias>' // profile §2/§5
import { CorePermissionValidation } from '<base-class-alias>' // profile §5 — the gate
import { ThingRepository, OwnerRepository, Clock, IdGenerator } from '<ports-alias>' // profile §2
import { ThingFactory } from '<factories-alias>' // profile §6 — builds entities from primitives
import { EntityNotFoundError, DuplicateEntityError } from '<errors-alias>' // profile §10 (entity skill)
import { Thing } from '<entities-alias>'

// --- Input / Output: the explicit seam the caller (a handler) depends on ------
export interface CreateThingInput {
  ownerId: string
  slug: string
}
export type CreateThingOutput = Thing

// Collaborators arrive grouped per the profile (here: one `dependencies` object).
interface Dependencies {
  thingRepository: ThingRepository
  ownerRepository: OwnerRepository
  clock: Clock
  idGen: IdGenerator
}

interface Factories {
  thingFactory: ThingFactory
}

// The usecase extends a validation/permission base (profile §5). The base runs the
// cross-cutting gate (authenticate identity -> load aggregate -> check permission)
// and then calls `executeTemplate`. The gate is written + tested ONCE, centrally —
// not re-implemented here.
export class CreateThingUsecase
  extends CorePermissionValidation
  implements Interactor<CreateThingInput, CreateThingOutput>
{
  constructor(
    private readonly _deps: Dependencies,
    private readonly _factories: Factories, // omit if the profile groups factories into deps
  ) {
    super()
  }

  // Names the permission the base-class gate enforces before executeTemplate runs.
  action(): string {
    return 'CREATE_THING'
  }

  // The business method. `execute` (on the base) runs the gate, then delegates here.
  // Pure orchestration: load -> guard -> build via factory -> persist -> return.
  async executeTemplate(input: CreateThingInput): Promise<CreateThingOutput> {
    // load via a port
    const owner = await this._deps.ownerRepository.retrieve(input.ownerId)

    // guard preconditions with TYPED domain errors (never a bare Error) so callers
    // and tests can match the type
    if (!owner) {
      throw new EntityNotFoundError('Owner', input.ownerId)
    }

    const existing = await this._deps.thingRepository.retrieveBySlug(input.slug)
    if (existing) {
      throw new DuplicateEntityError('Thing', input.slug)
    }

    // Build the entity through a FACTORY (not inline `new`); the entity owns its own
    // invariants — the usecase does not re-implement them.
    const thing = this._factories.thingFactory.make({
      uid: this._deps.idGen.next(),
      ownerId: owner.uid,
      slug: input.slug,
      now: this._deps.clock.now(),
    })

    // persist via the port, then return the Output
    await this._deps.thingRepository.save(thing)
    return thing
  }
}

// --- Steps (optional, profile §6) ---------------------------------------------
//
// When a unit of logic is reused across usecases or worth testing on its own,
// extract it into a Step — itself an injected collaborator with its own test:
//
//   interface Step<In, Out> { run(input: In): Promise<Out> }
//
//   export class ReserveSlugStep implements Step<string, void> {
//     constructor(private readonly _thingRepository: ThingRepository) {}
//     async run(slug: string): Promise<void> {
//       if (await this._thingRepository.retrieveBySlug(slug)) {
//         throw new DuplicateEntityError('Thing', slug)
//       }
//     }
//   }
//
// The usecase then receives steps in a second constructor group (profile §2) and
// composes them — it does NOT inline their logic.
</content>
