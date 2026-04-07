# Phase 0 Deferred Items

Phase 0 of the v10 refactor (`refactor/v10-phase0` branch) completed 10 of 12
DoD items. The remaining 2 are documented here so Phase 3 owners pick them up
in the right sub-PR.

## Item 1: Delete `src/pages/TaskView.ts`

**Original DoD criterion:** "src/pages/TaskView.ts deleted; file gone;
`git grep \"from \\\".*pages/TaskView\\\"\" src/` empty; typecheck passes"

**Why deferred:** the user has uncommitted modifications in `src/pages/TaskView.ts`
(enhanced multi-cycle support in the "switch status" context menu). Deleting
the file in Phase 0 would lose those modifications.

**Resolution path** (assigned to Phase 3 sub-PR D.4 — view consolidation):

1. Read the dirty `src/pages/TaskView.ts` diff. The relevant block is the
   "switch status" submenu builder (around line ~1263-1440 in the dirty version).
2. Find the equivalent location in `src/pages/FluentTaskView.ts` and port the
   multi-cycle context menu logic. The new code reuses these helpers from
   `src/utils/status-cycle-resolver.ts`:
   - `findApplicableCycles(currentMark, statusCycles)`
   - `getAllStatusNames`
   - `getNextStatusPrimary`
   - `getAllStatusMarks`
3. Move `TASK_VIEW_TYPE` constant from `src/pages/TaskView.ts` to a new file
   `src/common/view-types.ts` so the constant survives the deletion (stale
   leaves in user vaults still need to be detached on next load — see
   `src/index.ts:1825` and `:2116`).
4. Update the two import sites of `TASK_VIEW_TYPE`:
   - `src/index.ts:72` (also remove the `TaskView` symbol from this import)
   - `src/components/features/fluent/FluentIntegration.ts:13`
5. Delete the `instanceof TaskView` block at `src/index.ts:2119` — unreachable
   since the class is no longer registered.
6. Delete `src/pages/TaskView.ts`.
7. Run typecheck + integration suite to confirm green.

## Item 2: Fold `src/utils/settings-migration.ts` into the registry

**Original DoD criterion:** "src/utils/settings-migration.ts deleted; folded into
registry; Migration.tombstone.test.ts covers the multi-cycle case"

**Why deferred:** the file has TWO non-migration runtime callers that need
proper relocation, not just deletion:
- `repairStatusCycles` is called every plugin load at `src/index.ts:2022`
- `migrateSettings` is called from the W1 fallback path at `src/index.ts:2007`

A naive delete would break both. The Phase 0 W1 work bundled the migration
logic into `legacy-bundle-0.ts` but kept the source file because the runtime
helpers still need a home.

**Resolution path** (assigned to Phase 3 sub-PR D.2 — command palette rewrite,
since D.2 owns the `index.ts` import block):

1. Move the runtime helpers to `src/utils/status-cycle-resolver.ts` (already
   exists, has the right name):
   - `repairStatusCycles`
   - `validateStatusCycle`
   - `sortCyclesByPriority`
   - `findDuplicateCycleIds`
2. Confirm `migrateToMultiCycle` is no longer imported anywhere outside of
   `src/utils/migration/steps/legacy-bundle-0.ts`. As of Phase 0 it's also
   imported by `src/__tests__/migration/legacy-bundle-0.test.ts`. Either:
   (a) move `migrateToMultiCycle` body inline into both call sites and delete
       the export, OR
   (b) move `migrateToMultiCycle` to a new home like
       `src/utils/migration/legacy-helpers.ts` and update the two importers.
   Recommendation: (a) — the body is small (~30 LOC) and inlining removes a
   moving part.
3. Update `src/index.ts:110-112` to import `repairStatusCycles` from its new
   home (`@/utils/status-cycle-resolver`).
4. Remove the W1 fallback in `src/index.ts:2003-2010` — the registry has
   atomic semantics, so the fallback path is dead defense in depth that nobody
   should ever hit. (If you're worried, leave a single-line warning that the
   registry returned !ok.)
5. Delete `src/utils/settings-migration.ts`.
6. Run typecheck + integration suite to confirm green.

## When to do this work

Both items belong in the very first sub-PRs of Worktree D (Phase 3, 10.0.0).
They are NOT for Phase 1 or Phase 2 — those phases are about adding warnings
without touching the underlying view layer.

## Why these were deferred (not just dropped)

Both items are real DoD criteria from the plan. Skipping them entirely would
mean Phase 0's "no observable behavior change + dead code removed" contract
is incomplete. They're deferred to Phase 3 because:
- Item 1 is blocked on user state we can't safely modify in Phase 0
- Item 2 needs a proper home for runtime helpers, which is more refactor than
  "delete"

Phase 3's natural workflow already touches both areas, so picking them up
there is cheap. Tracking them here ensures they don't get lost.
