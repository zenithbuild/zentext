# ADR 0002 — Memory Storage Location

**Status:** accepted for Stage 1 (promoted from proposed on 2026-07-06)
**Date:** 2026-07-05 (proposed); 2026-07-06 (accepted for Stage 1)
**Related:** [open-decisions.md](../open-decisions.md) #1, #6, [cloud-boundary.md](../cloud-boundary.md)

## Problem

Zentext needs a place to store per-project memory on the developer's machine. The
choice between in-repo (`.zentext/`) and out-of-repo (`~/.zentext/`) shapes the
sharing model, git hygiene, conflict behavior, and whether cloud sync is the only
cross-machine path. It also affects how memory is discovered, backed up, and
versioned. This is foundational and hard to change once users have data in a
location.

## Options

### Option A — In-repo (`.zentext/`)

Memory lives inside the project repository as files (e.g., JSON or markdown records
under `.zentext/`). It is versioned with git, shareable via `git clone`, and visible
to every tool that touches the repo.

### Option B — Out-of-repo (`~/.zentext/`)

Memory lives outside the repo, organized by project (e.g.,
`~/.zentext/projects/<project-id>/`). The repo stays clean. Sharing across machines
requires cloud sync or explicit export.

### Option C — Out-of-repo store + optional in-repo export

The canonical store is out-of-repo. `zentext` can export a portable, human-readable
bundle (e.g., `.zentext/context.md` or `.zentext/snapshot.json`) into the repo on
demand or on a hook. The export is git-trackable; the live store is not.

### Option D — In-repo store, gitignored by default

Memory lives in `.zentext/` inside the repo but is gitignored by default. Local
only, no git noise, no accidental commits. Sharing still needs cloud sync or
explicit export.

## Tradeoffs

| Aspect | A (in-repo) | B (out-of-repo) | C (out-of-repo + export) | D (in-repo, gitignored) |
|--------|------------|-----------------|--------------------------|--------------------------|
| Git noise | High (commits, conflicts, merge noise) | None | Controlled (export is opt-in) | None |
| Share via git clone | Yes (automatic) | No | Yes (via exported bundle) | No (gitignored) |
| Repo pollution | Yes (.zentext/ in tree) | No | Optional (.zentext/ export only) | Yes (.zentext/ exists but ignored) |
| Merge conflicts on memory | Possible | None | None (export is regenerated) | None |
| Cross-machine without cloud | Yes (via git) | No | Yes (commit the export) | No |
| Discoverability ("where is my memory?") | High (in repo) | Medium (need to know the path) | Medium | High |
| Backup | Git history | Manual or cloud sync | Git history of exports | Manual or cloud sync |
| Conflict with teammate memory | Likely (if both commit) | N/A (separate stores) | Avoidable (export is read-only snapshot) | N/A |
| Coupling store to git | Yes | No | No | Partially |

## Current recommendation

**Option C — Out-of-repo store + optional in-repo export.**

Rationale:
- The canonical store is out-of-repo (`~/.zentext/projects/<id>/`), keeping repos
  clean and avoiding git merge conflicts on memory records. Memory is internal to
  the user/machine, not part of the project artifact.
- `zentext export` (or `zentext repack --out .zentext/context.md`) writes a portable,
  human-readable snapshot into the repo on demand. This snapshot is git-trackable,
  so sharing via git clone is possible without coupling the live store to git.
- This decouples the storage model from the sharing model: live memory is local and
  fast; sharing is explicit and snapshot-based or via cloud sync (Stage 2).
- Avoids the in-repo failure mode where every agent write produces a git diff and
  merge conflicts when teammates both commit memory.

The export is a **read-only snapshot**, never the live store. Teammates who clone the
repo get a starting context; they do not get a live, auto-updating store. Live
sharing requires cloud sync (Stage 2) or re-export.

## Risks

- **Users expect memory to "just be in the repo."** The export step is friction.
  Mitigation: a `zentext init` option to auto-export on handoff, and clear docs.
  Some users may genuinely want Option A (in-repo, committed); consider supporting
  that as an explicit mode, not the default.
- **Two sources of truth confusion.** The live store and the exported snapshot can
  drift. Mitigation: the snapshot is clearly labeled as a point-in-time export with a
  timestamp; the CLI warns if it is stale relative to the live store.
- **Cross-machine without cloud requires manual export/import.** For solo users on
  one machine this is a non-issue. For multi-machine solo users, cloud sync (Stage 2)
  is the answer; manual export is the fallback.
- **Out-of-repo path is less discoverable.** Mitigation: `zentext status` shows the
  store path; `zentext init` prints it prominently.

## What evidence would change the decision

- If early users strongly prefer in-repo memory and find the export step annoying,
  offer in-repo as an explicit `--in-repo` mode at init.
- If git merge conflicts on in-repo memory are common in team pilots, that validates
  out-of-repo as the default.
- If users never use the export feature (because they rely on cloud sync), the
  export may become optional/secondary rather than a headline feature.
- If the store path is hard to remember or locate in practice, consider an in-repo
  pointer file (`.zentext-store` containing the absolute path) for discoverability.

## Accepted decision (Stage 1)

**Option C — Out-of-repo store + optional in-repo export.** The canonical store is
out-of-repo at `~/.zentext/projects/<project-id>/`. The in-repo artifact is produced
via `zentext repack --out .zentext/context.md`. There is **no separate `zentext export`
command in Stage 1** — export is a repack output target. The in-repo artifact is a
read-only, point-in-time snapshot, never the live store.

## Decision status

Accepted for Stage 1 on 2026-07-06, after the strategic foundation and the Stage 1 implementation plan were reviewed and merged into `main`. This is the working decision for Stage 1; it is not necessarily forever and remains revisitable as Stage 1 usage evidence accumulates. See [`open-decisions.md`](../open-decisions.md).

The validation hooks below remain open for later stages (multi-machine, multi-teammate
scenarios); they do not block Stage 1, which is single-user local. Changing the store
location later would require a migration, so the abstracted store API and
`schema_version` (per [`implementation/data-model-and-store.md`](../implementation/data-model-and-store.md)) mitigate that risk.
