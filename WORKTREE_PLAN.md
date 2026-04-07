# Task Genius v10 — Phase 1-4 Worktree Split

Operational follow-up to the v10 refactor plan
(`~/.claude/plans/dynamic-mixing-pie.md`). That document is the source of
truth for **what** to do in each phase. This document is the source of truth
for **how to parallelize** the work across multiple worktrees / developers.

**Phase 0 status:**
- 10 of 12 DoD items checked ✅
- 2 items deferred (see [PHASE0_DEFERRED.md](./PHASE0_DEFERRED.md))
- 5 commits on `refactor/v10-phase0`
- 71 new passing tests; full suite stable at 39 pre-existing failed suites

**Sub-plugins:** Phase 1-4 also produces 4 new repos
(`task-genius-workflow`, `task-genius-habits`, `task-genius-timer`,
`task-genius-calendar-sync`). Those are NOT worktrees of this repo — they're
independent repos. This document covers main-plugin worktrees only.

---

## Worktree principles

1. **One worktree per developer per concurrent task.** A worktree is
   `git worktree add ../tg-<phase>-<area> refactor/v10-<phase>-<area>` from
   the main repo.
2. **Worktrees branch off `refactor/v10-phase0`** until that branch merges to
   master. After merge they branch off master.
3. **Avoid concurrent worktrees touching the same files.** This document maps
   each phase's work to a "footprint" — the files it modifies — so collisions
   are predictable.
4. **Each worktree owns its own DoD subset.** Don't merge a worktree until its
   subset is green.
5. **Sub-plugin extraction is NOT worktree work.** Each extracted sub-plugin
   is a fresh repo. This doc only mentions them as dependencies.

---

## Conflict map

Which phases touch which key files:

| File | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|---|
| `src/index.ts` | onunload race fixed; W1 wiring | + banner registration | + read-only mode | **rewrite**: 16 commands, hotkeys, deletes 27 commands | drop aliases |
| `src/common/setting-definition.ts` | `_meta` field added | banner copy keys | none | **rewrite**: 25→7, 15→5 views | locale prune |
| `src/components/features/settings/SettingsModal.ts` | none | none | read-only flag | **rewrite**: `renderTabContent` 25→7 | none |
| `src/components/features/settings/tabs/*` | none | banner injection in 14 tabs | read-only mode in 14 tabs | **delete 14 tabs**, rewrite 7 | none |
| `src/components/features/quick-capture/modals/*` | none | none | none | **delete 4 modals**, rename 1 | none |
| `src/components/features/onboarding/*` | none | none | none | **delete 31 files**, add 4 | none |
| `src/utils/ObsidianUriHandler.ts:117` | none | none | none | switch to redirect map | none |
| `src/dataflow/Orchestrator.ts` | rebuild + onSettingsFieldsChanged | none | none | settings consolidation rewires scopes | none |
| `src/widgets/registerWidgets.ts` | none | none | none | + TableWidget, QuadrantWidget | none |
| `src/translations/locale/*` | none | en banner copy | en banner copy | en strings for new UI | **prune all 7 non-en** |
| `src/migration/v10/*` (new) | none | + Archiver scaffold | + ViewMigration scaffold | + tab/view migration steps | tombstones for v10-archive |
| `src/utils/migration/steps/*` | legacy bundle + sentinel | + v9.14 deprecation banners (no-op) | none | + v10 archive + view-cleanup | + v10.0.1 cleanup tombstones |

**The hot zone is `src/index.ts` and the settings tabs.** Phase 3 owns both
ends of the rewrite. Phase 1 and Phase 2 are mostly additive (banner injection,
read-only flagging) and can run in parallel with Phase 3 if scoped carefully.

---

## Worktree A — Phase 1 banners (9.14.0)

**Branch:** `refactor/v10-phase1-banners` off `refactor/v10-phase0`
**Owner:** 1 developer
**Calendar:** ~1 week

### Scope footprint

- `src/components/features/settings/components/DeprecationBanner.ts` (new)
- `src/common/deprecation-messages.ts` (new)
- `src/components/features/settings/tabs/WorkflowSettingsTab.ts` (banner injection)
- `src/components/features/settings/tabs/HabitSettingsTab.ts`
- `src/components/features/settings/tabs/RewardSettingsTab.ts`
- `src/components/features/settings/tabs/TaskTimerSettingsTab.ts`
- `src/components/features/settings/tabs/TimelineSidebarSettingsTab.ts`
- `src/components/features/settings/tabs/IcsSettingsTab.ts` (OAuth section only)
- `src/components/features/settings/tabs/IndexSettingsTab.ts` (file-as-task section)
- `src/components/features/settings/tabs/DesktopIntegrationSettingsTab.ts` (electron-quick-capture section)
- `src/components/features/settings/tabs/AboutSettingsTab.ts` (deprecations panel)
- `src/components/features/settings/index.ts` (export new component)
- `src/managers/changelog-manager.ts` (auto-open v10 announcement)
- `src/translations/locale/en.ts` (new banner copy)

### Tasks

1. Build the `DeprecationBanner` component (~60 LOC)
2. Build the `deprecation-messages.ts` strings file (~80 LOC)
3. Wire banner into 14 deprecated tab files (one-line call each)
4. Add the "Deprecations" collapsible to AboutSettingsTab (~50 LOC)
5. Wire ChangelogManager to auto-open the v10 announcement on first launch of 9.14.0
6. Update `CHANGELOG.md` and create the pinned GitHub Discussion (out of repo)

### Conflicts to watch

Phase 3 will rewrite the same 14 tabs. When Phase 1 merges first, Phase 3
needs to pull and resolve the banner injection (which gets deleted in Phase 3
anyway). Plan: Phase 3 starts AFTER Phase 1 is merged so the rebase is clean.

### DoD subset

- 14 tabs show banners in real-vault smoke test
- "Export this section" button in each banner calls a stub `Archiver` fn
- Changelog modal auto-opens once on 9.14.0 first launch
- No regression in existing tab rendering

---

## Worktree B — Phase 1 Archiver (parallel to A)

**Branch:** `refactor/v10-phase1-archiver` off `refactor/v10-phase0`
**Owner:** 1 developer (can be the same person as A, sequenced)
**Calendar:** ~1 week (overlaps with A)

### Scope footprint

- `src/migration/v10/Archiver.ts` (new, ~300 LOC)
- `src/migration/v10/index.ts` (new barrel)
- `src/__tests__/migration/v10/Archiver.test.ts` (new)

### Tasks

1. Implement `archiveWorkflows`, `archiveHabits`, `archiveRewards`,
   `archiveTimerData`, `archiveCalDavSources`, `archiveRemovedViews`,
   `archiveOrphans` as **pure functions** over `plugin.settings`
2. Each returns `{files: Map<string, string>, summary: string}` — strict no-IO
   contract
3. Test fixture: realistic settings with each section populated → assert
   archive contents are correct
4. **Do NOT wire into MigrationRegistry yet** — that's Phase 3

### Why a separate worktree

Worktree A modifies UI files; Worktree B modifies new files in
`src/migration/v10/`. Zero conflict. Both can land in 9.14.0 even though only
A is user-visible.

### DoD subset

- All 7 archive functions return correct shapes for known inputs
- `Archiver.test.ts` has 1 fixture per archive section
- Archiver functions work in jest WITHOUT a real vault (pure transformations)

---

## Worktree C — Phase 2 read-only (9.15.0)

**Branch:** `refactor/v10-phase2-readonly` off **master after A merges**
**Owner:** 1 developer
**Calendar:** ~1 week

### Scope footprint

- All 14 deprecated settings tab files (add `disabled` flag to inputs)
- `src/components/features/settings/components/DeprecationBanner.ts` (banner copy update: "moves to" → "read-only — export now")
- `src/index.ts` (deprecated commands wrap with first-use Notice)
- `src/common/deprecation-messages.ts` (add Notice strings)
- `src/managers/changelog-manager.ts` (10.0.0-beta.1 announcement)
- `manifest-beta.json` (bump to 10.0.0-beta.1)

### Tasks

1. Add a `readOnly` prop to each deprecated tab's render function; when true,
   every `Setting()` chain calls `.setDisabled(true)` and exports remain enabled
2. Wrap deprecated commands with one-shot Notice (per-session memory, not
   settings)
3. Cut 10.0.0-beta.1 via BRAT
4. Coordinate sub-plugin v0.1.0 releases (out of repo): `task-genius-workflow`,
   `task-genius-habits`, `task-genius-timer`

### Conflicts to watch

Same 14 tabs as Worktree A. **Worktree C must merge after A**, no concurrency.
Phase 3 rewrite of these tabs comes after C merges.

### DoD subset

- All deprecated tabs are visually disabled (inputs grayed out)
- Export buttons still functional
- Deprecated commands fire Notice on first use per session
- 10.0.0-beta.1 published to BRAT and a real beta tester confirms it loads

---

## Worktree D cluster — Phase 3 cliff (10.0.0)

**Branch:** `refactor/v10-phase3-cliff` off master after C merges
**Owner:** 1-2 developers (this is the biggest worktree)
**Calendar:** ~1 week of focused work

This worktree should be split into FOUR sub-PRs that land sequentially on the
worktree branch:

### D.1 — Settings tab rewrite (25 → 7)

**Files:**
- `src/components/features/settings/SettingsModal.ts` (`renderTabContent` switch)
- `src/components/features/settings/tabs/*` (delete 14, rewrite 7)
- `src/components/features/settings/index.ts` (exports)
- `src/components/features/settings/components/DeprecationBanner.ts` (delete)
- `src/common/deprecation-messages.ts` (delete)
- `src/utils/ObsidianUriHandler.ts:117` (switch to redirect map)
- `src/utils/uri-tab-redirects.ts` (new)
- `src/migration/v10/TabIdMap.ts` (new)
- All `src/components/features/settings/tabs/{Workflow,Habit,Reward,TaskTimer,TimelineSidebar}*.ts` (delete)

**Why a separate sub-PR:** lets you review tab consolidation in isolation. The
deletions are big but mechanical.

### D.2 — Command palette + hotkeys (43 → 16)

**Files:**
- `src/index.ts` (command registration block — major rewrite)
- `src/commands/*.ts` (delete: completedTaskMover, sortTaskCommands, taskCycleCommands, taskMover, workflowCommands)
- New consolidated command files in `src/commands/v10/` for the 16 new commands

**Why separate:** the command rewrite touches a huge stretch of `index.ts` and
is easy to test in isolation (jest test that the right commands are registered
with the right hotkeys).

**Includes Phase 0 deferred Item 2:** fold `src/utils/settings-migration.ts`
into the registry. See `PHASE0_DEFERRED.md` for the resolution path.

### D.3 — Quick capture modal consolidation (5 → 1)

**Files:**
- `src/components/features/quick-capture/modals/{QuickCaptureModal,MinimalQuickCaptureModal,MinimalQuickCaptureModalWithSwitch,BaseQuickCaptureModal}.ts` (delete)
- `src/components/features/quick-capture/modals/QuickCaptureModalWithSwitch.ts` → rename to `QuickCaptureModal.ts`
- New `Mode` strip UI inside the survivor
- `src/utils/migration/steps/v10-quick-capture-modes.ts` (new)
- `src/index.ts` (command callback updates)

**Why separate:** quick-capture is a self-contained subsystem with its own
tests. Easy to verify in isolation.

### D.4 — View consolidation + onboarding compression + deletions

**Files:**
- `src/components/features/{gantt,quadrant,habit}/*` (delete)
- `src/components/features/timeline-sidebar/*` (delete)
- `src/components/features/onboarding/**` (delete 31 files, add 4)
- `src/widgets/registerWidgets.ts` (add TableWidget, QuadrantWidget)
- `src/widgets/views/TableWidgetView.ts` (new, port from `src/components/features/table/`)
- `src/widgets/views/QuadrantWidgetView.ts` (new, ~200 LOC)
- `src/migration/v10/ViewMigration.ts` (new)
- `src/utils/migration/steps/v10-view-cleanup.ts` (new)
- `src/common/setting-definition.ts` (`viewConfiguration` defaults: 15 → 5)
- `src/managers/{habit-manager,reward-manager,timer-manager,electron-quick-capture}.ts` (delete)
- `src/services/{timer-export-service,timer-format-service,timer-metadata-service}.ts` (delete)
- `src/managers/calendar-auth-manager.ts` (delete — moves to calendar-sync sub-plugin)
- `src/providers/*` (delete entire dir)
- `src/parsers/holiday-detector.ts` (delete)
- `src/dataflow/sources/FileSource.ts` (delete)
- `src/editor-extensions/workflow/*` (delete entire dir)
- `src/editor-extensions/date-time/task-timer.ts` (delete)
- `src/pages/TaskView.ts` (delete after porting dirty changes — see `PHASE0_DEFERRED.md` Item 1)

**Why separate:** this is the biggest deletion sweep. ~50% of the LOC reduction
lands here. Splitting it from D.1-D.3 lets reviewers digest the conceptual
deletions separately from the structural rewrites.

**Includes Phase 0 deferred Item 1:** delete `src/pages/TaskView.ts`. See
`PHASE0_DEFERRED.md` for the resolution path (port multi-cycle context menu
to FluentTaskView first).

### D.5 — Migration confirmation modal (cross-sub-PR, lands last)

The migration confirmation modal touches files from multiple sub-PRs:
- `src/migration/v10/ConfirmationModal.ts` (new)
- `src/utils/migration/steps/v10-archive.ts` (new — wraps Archiver from Worktree B)
- `src/index.ts` (first-launch detection in onload)

This work should land last on the D branch, after D.1-D.4 are stable. It
depends on the Archiver from Worktree B being available.

### Conflicts within Worktree D

D.1-D.4 each touch `src/index.ts` differently:
- D.1 changes settings tab routing
- D.2 rewrites commands
- D.3 changes quick-capture commands
- D.4 deletes timer/workflow commands

**Sequence them: D.2 first (it owns the command block), then D.1, D.3, D.4 in
any order, then D.5 last.**

### DoD subset

The §3.10 acceptance test from the main plan — the "single hardest test" with
47 workflows + 12 habits + etc:

> A user upgrades from 9.13.1 with: 47 workflows, 12 habits, 3 ICS sources,
> 2 OAuth calendars, 5 custom views, 3 workspaces, all 25 settings tabs touched
> at least once. After upgrading to 10.0.0, they:
> 1. See the migration modal within 3 seconds.
> 2. Click Apply.
> 3. See their Inbox.
> 4. Capture a task with `Mod+Shift+T`.
> 5. Mark it done.
> 6. Open `Task Genius Archive/` and see all their data.
>
> If any of those six steps requires reading docs, opening Settings, or
> restarting Obsidian — **it's not done.**

---

## Worktree E — Phase 4 cleanup (10.0.1)

**Branch:** `refactor/v10-phase4-cleanup` off master after D merges
**Owner:** 1 developer
**Calendar:** ~1 week

### Scope footprint

- `src/migration/v10/Archiver.ts` (delete)
- `src/utils/migration/steps/v10-archive.ts` → tombstone-only marker
- `src/utils/migration/steps/v10-view-cleanup.ts` → tombstone marker
- `src/index.ts` (drop one-version command aliases)
- `scripts/prune-locale-orphans.mjs` (new)
- All non-en `src/translations/locale/*.ts` (prune)
- `src/__tests__/locale-parity.test.ts` (new)

### Tasks

1. Run the locale prune script for real
2. Tombstone the migration code itself (the registry will find it's already
   applied via `_meta` and skip)
3. Drop command aliases that were kept for one version
4. Release `task-genius-calendar-sync` v0.1.0 (the riskiest sub-plugin, held
   until now)

### Conflicts to watch

None. By this point Phase 3 is merged and stable.

---

## Sequencing diagram

```
phase0 (DONE on refactor/v10-phase0)
   |
   +---> Worktree A (banners, 9.14.0) ---+
   |                                      |
   +---> Worktree B (Archiver, parallel) -+--> [merge to master, tag 9.14.0]
                                              |
                                              v
                                          Worktree C (read-only, 9.15.0)
                                              |
                                              v
                                          [merge to master, tag 9.15.0 + 10.0.0-beta.1]
                                              |
                                              v
                                          Worktree D cluster (cliff, 10.0.0)
                                          /----D.2 (commands)
                                          |    |
                                          |    +---D.1 (settings tabs)
                                          |    |
                                          |    +---D.3 (quick capture)
                                          |    |
                                          |    +---D.4 (views + deletions + onboarding)
                                          |    |
                                          |    +---D.5 (confirmation modal, last)
                                          |
                                          +--> [merge to master, tag 10.0.0]
                                              |
                                              v
                                          Worktree E (cleanup, 10.0.1)
                                              |
                                              v
                                          [merge to master, tag 10.0.1]
```

**Critical path:** A → C → D.2 → D.1/3/4 (parallel) → D.5 → E

**Off-critical path:** Worktree B (Archiver) — can merge any time before D.5

### Calendar estimates

- **Solo dev:** ~7 weeks
- **2 devs running A+B in parallel, then sequencing C→D→E:** ~6 weeks
- **2 devs running D.1-D.4 in parallel during Phase 3:** ~5 weeks

---

## Setup commands for each worktree

From the main repo root:

```bash
# Worktree A
git worktree add ../tg-phase1-banners refactor/v10-phase0
cd ../tg-phase1-banners
git checkout -b refactor/v10-phase1-banners

# Worktree B (parallel to A)
git worktree add ../tg-phase1-archiver refactor/v10-phase0
cd ../tg-phase1-archiver
git checkout -b refactor/v10-phase1-archiver

# Worktree C (after A merges to master)
git worktree add ../tg-phase2-readonly master
cd ../tg-phase2-readonly
git checkout -b refactor/v10-phase2-readonly

# Worktree D (after C merges to master)
git worktree add ../tg-phase3-cliff master
cd ../tg-phase3-cliff
git checkout -b refactor/v10-phase3-cliff

# Worktree E (after D merges to master)
git worktree add ../tg-phase4-cleanup master
cd ../tg-phase4-cleanup
git checkout -b refactor/v10-phase4-cleanup
```

To clean up after merging:

```bash
# From main repo
git worktree remove ../tg-phase1-banners
git branch -d refactor/v10-phase1-banners
```

---

## Pre-flight checks before starting any worktree

Before beginning work on a worktree, the assignee should:

1. **Read** `~/.claude/plans/dynamic-mixing-pie.md` (the main v10 plan) — this
   document is operational; the main plan has the rationale.
2. **Check Phase 0 is merged** — `git log master --oneline | grep "Phase 0"`.
   If not, the worktree should branch off `refactor/v10-phase0`, not master.
3. **Run the integration tests on the base branch** —
   `npm test -- --testPathPattern="integration/"` should report 73+ passing in
   the Phase 0 suite. If it doesn't, the base branch is broken and needs
   investigation before any new work.
4. **Confirm no overlap with active worktrees** — check the conflict map above.

---

## Risks specific to the worktree split

| Risk | Mitigation |
|---|---|
| Worktree A and Worktree C touching the same 14 tab files cause merge headaches | Hard sequencing rule: C does not start until A is merged to master |
| Worktree D.1-D.4 both touch `src/index.ts` | D.2 (commands) must merge first; D.1/3/4 rebase onto it |
| Worktree B (Archiver) ships before Worktree D.5 wires it in | Worktree B's tests are pure-function tests — nothing wires it to user-facing UI in Phase 1, so it's safe to ship "dormant" code |
| Sub-plugin extraction blocks Worktree D.4 | Sub-plugins ship v0.1.0 in parallel with Worktree C (Phase 2). By the time D.4 starts, the sub-plugins exist as ghost installations |
| Phase 0 deferred items leak into Phase 1+ | See [PHASE0_DEFERRED.md](./PHASE0_DEFERRED.md) — items are explicitly assigned to D.2 and D.4 |

---

## Communication plan

### Multi-developer execution

- Daily standup: which worktree are you on, what's blocked
- Worktree owner pings before merging so others can pull
- Block all worktrees during Phase 3 merge weekend — D's merge is the
  highest-conflict event
- Tag releases ONLY after the corresponding DoD subset is verified

### Solo execution (one developer running the whole plan)

Just go A → B → C → D.2 → D.1 → D.3 → D.4 → D.5 → E in order. The worktree
split is then mostly informational; you can use a single working tree if you
prefer.

---

## Verification

Each worktree's "done" criterion is its DoD subset (listed in each worktree
section). The overall verification is the §3.10 acceptance test from the main
plan — the 6-step test where a real user upgrades from 9.13.1 with 47 workflows
+ 12 habits + etc.

After all worktrees merge, run the full integration suite from the master
branch:

```bash
cd <main-repo>
git checkout master
git pull
npm install
npm test -- --testPathPattern="integration/"
# Expect: 80+ passing, 0 failing in the integration namespace
npm test
# Expect: pre-existing failure count, no new failures introduced by v10 work
```
