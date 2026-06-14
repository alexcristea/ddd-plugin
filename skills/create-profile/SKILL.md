---
name: create-profile
description: Derive and maintain the per-project DDD profiles consumed by ddd:entity-design, ddd:repository-design, and ddd:usecase-design. Use when a target repo has no .claude/ddd/ profiles, when a design skill reports a missing profile, when project conventions change, or when onboarding the DDD skill suite onto a new codebase.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# create-profile — derive the per-project DDD profiles

The three design skills in this plugin are **project-agnostic methodologies**.
Everything repo-specific — base-class names and import paths, serialization
contracts, mock libraries, aliases, file placement, run commands — lives in a
**Project Profile** committed to the target repo. This skill derives those
profiles from the repo's existing code and writes them where the design skills
look for them.

**The committed profile is the deliverable.** Writing it into the target repo
(not into this plugin) is what makes it version-controlled alongside the
conventions it documents, shared with teammates and other agents, and found
automatically next session — instead of being silently re-derived every time.

---

## 1. The convention

One profile per design skill, in the target repo root:

```
.claude/ddd/entity-design.md        ← consumed by ddd:entity-design
.claude/ddd/repository-design.md    ← consumed by ddd:repository-design
.claude/ddd/usecase-design.md        ← consumed by ddd:usecase-design
```

Create only the profiles the user needs right now (usually the one whose design
skill routed here). Offer the others, but don't derive a repository profile in a
repo with no repositories.

---

## 2. Procedure

1. **Check what exists.** If `.claude/ddd/<skill>.md` is already present, this is
   an *update*, not a creation — diff it against the repo's current conventions
   and fix only the stale slots.
2. **Read the exemplars** for each profile being derived (§3). Prefer recent,
   idiomatic files over old ones; if two eras of a convention coexist, record
   both and which one new code should follow (see the mixed-era pattern in the
   worked example).
3. **Fill the matching template** from
   `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/<skill>.md`.
   Every `<<…>>` / `<…>` slot must end up either filled or explicitly marked
   "none". Use the worked Audora profiles in
   `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/` as
   the bar for completeness.
4. **Confirm ambiguous slots with the user** — anything the code doesn't settle
   (e.g. which mock idiom is preferred when both appear, whether `toJSON` is
   deprecated). Don't guess silently.
5. **Fill the "Live exemplars" section with real paths** from the target repo —
   1–2 recent files per concept that the design skill should open and imitate.
6. **Write the profile to `.claude/ddd/<skill>.md`** in the target repo and tell
   the user to commit it.
7. **Offer** to add a one-line pointer to the repo's root `CLAUDE.md` so the
   conventions are discoverable outside a `ddd:*` skill (Claude auto-loads
   `CLAUDE.md`, but not `.claude/ddd/*.md`). Default to suggesting a plain
   **mention** — e.g. *"DDD / Clean Architecture; layer conventions live in
   `.claude/ddd/`, loaded on demand by the `ddd:*` skills."* — which keeps the
   baseline context lean. Offer an **`@import`** (`@.claude/ddd/<skill>.md`) as the
   always-on upgrade, noting it makes that profile resident in every prompt; never
   import all profiles by default. **Only edit `CLAUDE.md` if the user agrees** —
   like the profile itself, this is opt-in, never automatic.

---

## 3. What to read per profile

| Profile | Derive from | Key slots |
|---|---|---|
| `entity-design.md` | One existing **Entity**, one **Value Object**, one **Builder** (plus their tests) | Base classes + import paths, identity/audit fields, serialization contract (`snapshot`/`toJSON`), VO factory conventions, directory + barrel layout, codegen command, builder location + alias, test placement, run command, domain-error hierarchy |
| `repository-design.md` | One existing **repository folder** (QueryBuilder / QueryRunner / Mapper / Repository) plus the **shared base classes** | Query-builder library, base-class names + what they provide, shared QueryRunner surface, SQL-assertion helper + dummy DB, Criteria/port type locations, schema/row aliases, mock library, run command |
| `usecase-design.md` | One existing **usecase plus its test** (ideally one simple, one permission-gated) | Entry method name(s), `Interactor` contract + base-class hierarchy, constructor dependency grouping, mock library, pre-validated-state bypass, steps/factories pattern, import aliases, builder/factory locations, test placement, run command |

---

## 4. Reference files

Blank templates (copy + fill):
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/entity-design.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/repository-design.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/templates/usecase-design.md`

Fully worked example set (the *Audora* monorepo — the completeness bar):
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/entity-design.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/repository-design.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/create-profile/references/examples/audora/usecase-design.md`
