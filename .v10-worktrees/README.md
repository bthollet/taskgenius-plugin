# Task Genius v10 — Worktree Briefs

This directory holds **self-contained briefs** for the 5 worktrees that
execute v10 Phase 1-4. Each brief is meant to be handed to a single agent
(or developer) who will create a worktree, do the work, and merge.

The full v10 plan lives at `~/.claude/plans/dynamic-mixing-pie.md` (in the
user's Claude config). Each brief here references the main plan but is
written to be readable on its own — an agent picking up brief D should not
need to read the entire v10 plan to start working.

## The 5 worktrees

| # | Brief | Phase | Branch | Calendar | Depends on |
|---|---|---|---|---|---|
| **A** | [worktree-a-banners.md](./worktree-a-banners.md) | 1 (9.14.0) | `refactor/v10-phase1-banners` | ~1 wk | Phase 0 (✅ done) |
| **B** | [worktree-b-archiver.md](./worktree-b-archiver.md) | 1 (9.14.0) | `refactor/v10-phase1-archiver` | ~1 wk | Phase 0 (✅ done) |
| **C** | [worktree-c-readonly.md](./worktree-c-readonly.md) | 2 (9.15.0) | `refactor/v10-phase2-readonly` | ~1 wk | A merged to master |
| **D** | [worktree-d-cliff.md](./worktree-d-cliff.md) | 3 (10.0.0) | `refactor/v10-phase3-cliff` | ~1 wk | C merged to master |
| **E** | [worktree-e-cleanup.md](./worktree-e-cleanup.md) | 4 (10.0.1) | `refactor/v10-phase4-cleanup` | ~1 wk | D merged to master |

## How to spawn agents

**Parallel start (recommended):** spawn agents A and B simultaneously, both
branched off `refactor/v10-phase0`. They modify disjoint files. Once A merges
to master, spawn C. Then D after C, then E after D.

**Solo execution:** the single-developer path is `A → B → C → D.2 → D.1 → D.3
→ D.4 → D.5 → E`. The worktree split is informational; you can use one working
tree if you prefer.

## Phase 0 status (the ground each worktree stands on)

Phase 0 is **complete** on `refactor/v10-phase0`. 6 commits, 71 new passing
tests, 10 of 12 DoD items checked. The 2 deferred items (delete TaskView.ts,
fold settings-migration.ts into the registry) are documented in
[../PHASE0_DEFERRED.md](../PHASE0_DEFERRED.md) and explicitly assigned to
worktree D sub-PRs (D.4 and D.2 respectively).

Phase 0 commits on `refactor/v10-phase0`:
- `dd3fe89a` — W0 test infrastructure (buildOrchestrator + InMemoryStorage + localforage mock)
- `1de55f4c` — W2/W2-bis/W3 (onunload race fixed, rebuild last-resort, worker timeouts)
- `fe4c976f` — W4 (typed cache scope map + invariants checker + LocalStorageCache version fix)
- `12481c17` — W1 (MigrationRegistry with version-keyed tombstones)
- `d583e967` — W5 (critical-path integration tests: roundtrip / settingsChange / cache invariants sequence)
- `e90fc537` — Phase 0 docs (PHASE0_DEFERRED.md, WORKTREE_PLAN.md)

## Decisions resolved (defaults — user can override before any worktree commits)

The 5 open questions from the main plan have been answered with sensible
defaults so worktrees can start without waiting on more decisions:

1. **Deprecation list:** ship exactly the 14 features listed in the main plan
   (Workflow, Habit, Reward, Timer, Gantt, Quadrant, Timeline Sidebar,
   File-as-Task, Holiday detector, Electron quick-capture, 4 quick-capture
   modal variants, Working-On view, Flagged view, Habit view). Pull-back can
   happen at sub-PR review time.

2. **Sub-plugin commitment:** YES, 4 new repos
   (`task-genius-workflow`, `task-genius-habits`, `task-genius-timer`,
   `task-genius-calendar-sync`). Each is small (~3-6k LOC). They share the
   same tooling as the main plugin; the boundary is "share vault files,
   nothing else" (no DataflowOrchestrator coupling).

3. **Default hotkeys:** SHIP the 5 proposed bindings
   (`Mod+Shift+T` capture, `Mod+Shift+G` open view, `Mod+Shift+I` inbox,
   `Mod+Shift+F` forecast, `Mod+Alt+P` priority, `Mod+Enter` mark done on
   task line). Document in CHANGELOG that v10 sets defaults for the first
   time. Users can opt out via Obsidian's hotkey settings.

4. **Cliff version:** 9.14 → 9.15 → 10.0 over 4 weeks (the original
   proposal). Faster is better; the deprecation period exists to give beta
   testers time, not as a UX runway.

5. **Beta tester recruitment:** pin a GitHub Discussion explicitly recruiting
   testers. Don't depend on a pre-existing pool. The Discussion goes up the
   day Worktree A starts; recruitment runs in parallel with banner work.

If the user wants to override any of these, they can do so before the
relevant worktree commits to a particular answer — most decisions come into
play in Worktree D (Phase 3), so the runway is ~3-4 weeks.

## See also

- [`../PHASE0_DEFERRED.md`](../PHASE0_DEFERRED.md) — the 2 W6 items deferred from Phase 0
- [`../WORKTREE_PLAN.md`](../WORKTREE_PLAN.md) — the original umbrella worktree plan (this directory subsumes it; WORKTREE_PLAN.md kept for reference)
- [`../PLAN.md`](../PLAN.md) — the original v10 widgets requirements doc (predates this refactor effort)
- `~/.claude/plans/dynamic-mixing-pie.md` — the full v10 refactor plan (in the user's Claude config)
