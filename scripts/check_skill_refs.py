#!/usr/bin/env python3
"""Validate cross-references inside skill docs.

Two classes of reference rot are caught:

1. ${CLAUDE_PLUGIN_ROOT}/... paths that point at a file or directory which
   does not exist on disk.
2. ddd:<skill> mentions that name a skill directory which does not exist.

Placeholder paths (containing < > or { }, e.g. templates/<skill>.md or the
{value-object,entity,aggregate}.test.ts brace shorthand) are intentionally
skipped — they are illustrative, not literal.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"

PATH_RE = re.compile(r"\$\{CLAUDE_PLUGIN_ROOT\}(/[^\s`)\]]*)")
SKILL_REF_RE = re.compile(r"ddd:([a-z][a-z-]*)")

PLACEHOLDER_CHARS = set("<>{}")


def main() -> int:
    skill_dirs = {p.name for p in SKILLS.iterdir() if p.is_dir()}
    failures = []
    checked_paths = 0
    checked_refs = 0

    for doc in sorted(SKILLS.glob("*/SKILL.md")):
        text = doc.read_text()
        rel = doc.relative_to(ROOT)

        for m in PATH_RE.finditer(text):
            candidate = m.group(1).rstrip(".,")
            if PLACEHOLDER_CHARS & set(candidate):
                continue
            checked_paths += 1
            target = ROOT / candidate.lstrip("/")
            if not target.exists():
                failures.append(f"{rel}: missing path ${{CLAUDE_PLUGIN_ROOT}}{candidate}")

        for m in SKILL_REF_RE.finditer(text):
            name = m.group(1)
            checked_refs += 1
            if name not in skill_dirs:
                failures.append(f"{rel}: ddd:{name} has no skills/{name}/ directory")

    if failures:
        for f in sorted(set(failures)):
            print(f"FAIL: {f}", file=sys.stderr)
        return 1

    print(f"ok: {checked_paths} reference path(s) and {checked_refs} ddd: ref(s) resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())
