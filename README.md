# ddd

Design and unit-test the layers of a DDD / Clean Architecture codebase. The methodology in each skill is project-agnostic; everything repo-specific (base classes, aliases, conventions, run commands) lives in a **per-project profile** committed to the target repo.

## Skills

| Skill | Layer | Use for |
|---|---|---|
| `ddd:create-profile` | — | Derive and maintain the per-project profiles the other skills consume. Run once per repo (and when conventions change). |
| `ddd:entity-design` | Domain model | Design + unit-test Entities, Value Objects, Aggregates, Collections, and their test-data Builders. |
| `ddd:repository-design` | Persistence adapter | Design + test repositories on a SQL query builder: QueryBuilder / QueryRunner / Mapper, Criteria-driven queries, SQL-string assertions. |
| `ddd:usecase-design` | Application | Design + unit-test usecases / interactors: the Interactor contract, steps & factories, base-class validation gate; mock every injected port, given/scenario trees, builder-backed test data. |

## The profile convention

Each consuming repo holds its profiles at:

```
.claude/ddd/entity-design.md
.claude/ddd/repository-design.md
.claude/ddd/usecase-design.md
```

The design skills read these first. If one is missing, `ddd:create-profile` derives it from the repo's existing code (one exemplar per concept), confirms ambiguous slots with you, and writes it into the repo — commit it so teammates and future sessions get it for free. Blank templates and a fully worked example set (the *audora* project) live under `skills/create-profile/references/`.

## How the profile gets discovered

Claude Code auto-loads only one kind of file into context: **`CLAUDE.md`** (project root, nested subdirectories, and your user-global `~/.claude/CLAUDE.md`). Everything else — including these `.claude/ddd/*.md` profiles — is read **on demand**, when something points Claude at it.

For this plugin, that "something" is each skill's **Step 0**: invoking `ddd:entity-design` (or a sibling) is what makes Claude load the matching profile. This is deliberate — the profile stays out of your baseline context and loads only when the relevant skill fires.

The trade-off: the conventions **won't apply during ad-hoc edits** when no `ddd:*` skill is running. If you want them always-on, add a one-line bridge to the target repo's root `CLAUDE.md` — a mention, or an `@import` that pulls a profile into every session:

```md
## Architecture
DDD / Clean Architecture. Layer conventions live in `.claude/ddd/` and are
loaded on demand by the `ddd:*` skills. @.claude/ddd/entity-design.md
```

Use skills for deep, on-demand methodology; use `CLAUDE.md` for the always-on baseline. (Importing all three profiles adds them to every prompt — import only what you want resident, and let the skills load the rest.)

## Install

From the [over-engineering-plugins marketplace](https://github.com/alexcristea/over-engineering-plugins):

```
/plugin marketplace add alexcristea/over-engineering-plugins
/plugin install ddd@over-engineering-plugins
```

Or directly from this repo:

```
/plugin install alexcristea/ddd-plugin
```
