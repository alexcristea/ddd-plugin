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
