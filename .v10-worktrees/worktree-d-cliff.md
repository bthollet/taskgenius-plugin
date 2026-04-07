# Worktree D — Phase 3 Cliff (10.0.0)

## What you're doing

This is **the cliff**. Everything Phase 1 + Phase 2 warned about, you actually
do. Settings tabs go from 25 to 7. Commands go from 43 to 16 with default
hotkeys. Quick-capture modals go from 5 to 1. Views go from 15 to 5 core + 3
widget-only. Onboarding goes from 36 files to 5. Roughly 50% of the plugin's
LOC gets deleted. The migration confirmation modal runs on first launch and
archives every deprecated feature's persistent data to `<vault>/Task Genius
Archive/`.

This is also the largest worktree by far. It's split into **5 sub-PRs** that
land sequentially on the worktree branch. You can run them as 5 separate
commits or 5 separate Sub-PRs against the worktree branch — whichever fits
your workflow.

## Phase 0/1/2 ground

You depend on **Worktree C merged to master**. Verify before starting:

```bash
git fetch
git log master --oneline | head -10
# Expect: "feat(settings): read-only deprecated tabs..." (Worktree C) is the most recent v10 commit
# Expect: Worktree A (banners) and Worktree B (Archiver) commits are also present
```

The Phase 0 deferred items from `PHASE0_DEFERRED.md` are picked up here:
- **Item 1 (delete `src/pages/TaskView.ts`)** → assigned to **D.4**
- **Item 2 (fold `src/utils/settings-migration.ts` into the registry)** → assigned to **D.2**

Read [`../PHASE0_DEFERRED.md`](../PHASE0_DEFERRED.md) before starting either
sub-PR for the resolution paths.

## Setup

```bash
git fetch
git worktree add ../tg-phase3-cliff master
cd ../tg-phase3-cliff
git checkout -b refactor/v10-phase3-cliff

npm install
npm test -- --testPathPattern="integration/"
# Expect: 70+ passing
```

## The 5 sub-PRs

Each sub-PR lands on `refactor/v10-phase3-cliff`. They MUST land in this
order due to `src/index.ts` conflicts:

```
D.2 (commands) → D.1 (settings tabs) → D.3 (quick capture) → D.4 (views + deletions) → D.5 (confirmation modal)
```

D.2 must be first because it owns the bulk of the `src/index.ts` rewrite.
D.5 must be last because it depends on every other sub-PR being stable.

---

### D.2 — Command palette + hotkeys (43 → 16)

**Why first:** owns the largest stretch of `src/index.ts`. Other sub-PRs
rebase onto it.

**Files:**
- `src/index.ts` (command registration block — major rewrite)
- `src/commands/*.ts` (delete: `completedTaskMover.ts`, `sortTaskCommands.ts`, `taskCycleCommands.ts`, `taskMover.ts`, `workflowCommands.ts`)
- `src/commands/v10/` (new directory) — 16 new consolidated command files

**Plus PHASE 0 DEFERRED Item 2** — fold `src/utils/settings-migration.ts`
into the registry. Resolution path:
1. Move `repairStatusCycles`, `validateStatusCycle`, `sortCyclesByPriority`, `findDuplicateCycleIds` → `src/utils/status-cycle-resolver.ts` (already exists)
2. Inline `migrateToMultiCycle` body into `src/utils/migration/steps/legacy-bundle-0.ts` (no longer imported)
3. Remove the W1 fallback in `src/index.ts:2003-2010` (the registry has atomic semantics — fallback is dead defense)
4. Delete `src/utils/settings-migration.ts`
5. Verify `npm test` and `npm run build`

**The 16 new commands** (renaming + consolidation map from main plan §3.4):

| New ID | Old IDs absorbed | Default hotkey |
|---|---|---|
| `tg:capture` | `quick-capture`, `minimal-quick-capture`, `toggle-quick-capture`, `toggle-quick-capture-globally`, `quick-file-create` | `Mod+Shift+T` |
| `tg:capture-here` | (new) | — |
| `tg:mark-done` | `cycle-task-status-forward` (when on task line) | `Mod+Enter` (task line) |
| `tg:mark-cycle` | `cycle-task-status-forward`, `cycle-task-status-backward` | — |
| `tg:set-priority` | all 12 priority commands collapsed into one picker | `Mod+Alt+P` |
| `tg:remove-priority` | `remove-priority` | — |
| `tg:open-view` | `open-task-genius-view` | `Mod+Shift+G` |
| `tg:open-inbox` | (new) | `Mod+Shift+I` |
| `tg:open-forecast` | (new) | `Mod+Shift+F` |
| `tg:open-review` | (new) | — |
| `tg:move-tasks` | all 6 task-mover commands → one picker for scope | — |
| `tg:sort-tasks` | `sort-tasks-by-due-date`, `sort-tasks-in-entire-document` | — |
| `tg:reindex` | `force-reindex-tasks` (and removes `reindex-habits`) | — |
| `tg:open-settings` | `open-task-genius-settings-modal` | — |
| `tg:open-archive` | (new — reveals `Task Genius Archive/` in file explorer) | — |
| `tg:setup` | `open-task-genius-setup` | — |

**Removed entirely:** `open-timeline-sidebar-view`, `open-task-genius-changelog`
(auto-opens on version change), 5× `task-timer-*`, 6× `workflow-*`. The 11
auto-move commands collapse into a setting toggle in the Tasks tab — **not in
the palette at all**.

**Backward compatibility:** keep old command IDs as aliases for **one version
only** (10.0.0). Drop in 10.0.1 via Worktree E. This preserves manually-bound
hotkeys for surviving commands during the upgrade.

**Discovery:** after the migration modal (D.5), show a one-screen "What
changed" sheet listing the 5 default hotkeys, the 4 picker collapses, and
the sub-plugin pointers. Use the existing `ChangelogManager` modal infrastructure.

**DoD subset:** `npm test`, `npm run build`, all 16 new commands appear in
the palette with the new names, manually-bound hotkeys for surviving commands
still work via aliases.

---

### D.1 — Settings tab rewrite (25 → 7)

**Files:**
- `src/components/features/settings/SettingsModal.ts` (`renderTabContent` switch — 25 cases → 7)
- `src/components/features/settings/tabs/*` (delete 14, rewrite 7)
- `src/components/features/settings/index.ts` (exports)
- `src/components/features/settings/components/DeprecationBanner.ts` (delete — banners are gone in v10)
- `src/common/deprecation-messages.ts` (delete)
- `src/utils/ObsidianUriHandler.ts:117` (switch to redirect map)
- `src/utils/uri-tab-redirects.ts` (new)
- `src/migration/v10/TabIdMap.ts` (new)
- All `src/components/features/settings/tabs/{Workflow,Habit,Reward,TaskTimer,TimelineSidebar}*.ts` (delete)

**The 7 new tabs:**

| # | New tab | Absorbs old tabs |
|---|---|---|
| 1 | **General** | `index`, `file-filter`, `interface` (parts) |
| 2 | **Capture** | `quick-capture`, `time-parsing`, `date-priority` (parts) |
| 3 | **Tasks** | `progress-bar`, `task-status`, `task-handler`, `date-priority` (parts) |
| 4 | **Views** | `view-settings`, `calendar-views`, `task-filter` |
| 5 | **Projects & Tags** | `project` |
| 6 | **Integrations** | `ics` (read-only only), `mcp-integration`, `bases-support`, `workspaces`, `desktop-integration` |
| 7 | **About** | `about`, `beta-test` + "Open archive folder", import/export, tombstones list |

**Deleted tabs (no merge):** `workflow`, `habit`, `reward`, `task-timer`,
`timeline-sidebar`. Their content was archived in D.5.

**URI redirect map:** `src/utils/uri-tab-redirects.ts` — see main plan §3.8
for the full table. Existing URI bookmarks pointing to deprecated tabs land
on `about#archived-X` with a Notice explaining where the data went.

**DoD subset:** Settings opens in ≤500ms. All 7 tabs render valid content on
an empty vault. Existing URI bookmarks still work (manual smoke test).

---

### D.3 — Quick capture modal consolidation (5 → 1)

**Files:**
- `src/components/features/quick-capture/modals/{QuickCaptureModal,MinimalQuickCaptureModal,MinimalQuickCaptureModalWithSwitch,BaseQuickCaptureModal}.ts` (delete)
- `src/components/features/quick-capture/modals/QuickCaptureModalWithSwitch.ts` → rename to `QuickCaptureModal.ts`
- New `Mode` strip UI inside the survivor (Full / Minimal / Daily)
- `src/utils/migration/steps/v10-quick-capture-modes.ts` (new — registers as a tombstone+transform)
- `src/index.ts` (command callback updates — `tg:capture` opens the unified modal)

**Three modes inside one modal:**

```
┌─────────────────────────────────────┐
│ [● Full] [Minimal] [Daily]    [×]   │  ← mode strip
├─────────────────────────────────────┤
│  ▌ Task content...                  │  ← always: text input, autofocus
│                                     │
│ ─── Below this line shown in Full ──│
│  Project ▾   Tags ▾   Priority ▾    │
│  Due ▾       Start ▾   Scheduled ▾  │
│  Target file: <path or daily-note>  │
│  Append / Prepend / Replace ▾       │
│  [Cancel]              [Capture ↵] │
└─────────────────────────────────────┘
```

**Settings migration step `v10-quick-capture-modes`:**
```ts
// Old: separate command bound to MinimalQuickCaptureModalWithSwitch
// Old: lastUsedMode tracked per modal class
plugin.settings.quickCapture.mode = mapMode(plugin.settings.quickCapture.lastUsedMode);
delete plugin.settings.quickCapture.lastUsedMode;
delete plugin.settings.quickCapture.minimalModeSettings; // fields merged up one level
```

Known degradation: users who configured different file targets for full vs
minimal lose that distinction — call out in changelog.

**DoD subset:** capture flow works in all 3 modes, settings migration handles
existing `lastUsedMode` correctly, default hotkey (`Mod+Shift+T`) opens the
modal.

---

### D.4 — View consolidation + onboarding compression + deletions

**This is the biggest sub-PR by LOC.** It also picks up Phase 0 deferred
Item 1 (delete `src/pages/TaskView.ts`).

**Files (deletion sweep):**
- `src/components/features/{gantt,quadrant,habit}/*` (delete entire dirs — except keep a small `QuadrantWidgetView.ts` for codeblock embedding)
- `src/components/features/timeline-sidebar/*` (delete)
- `src/components/features/onboarding/**` (delete 31 of 36 files, add 4 simplified)
- `src/managers/{habit-manager,reward-manager,timer-manager,electron-quick-capture}.ts` (delete)
- `src/services/{timer-export-service,timer-format-service,timer-metadata-service}.ts` (delete)
- `src/managers/calendar-auth-manager.ts` (delete — moves to calendar-sync sub-plugin)
- `src/providers/*` (delete entire dir → calendar-sync sub-plugin)
- `src/parsers/holiday-detector.ts` (delete)
- `src/dataflow/sources/FileSource.ts` (delete)
- `src/editor-extensions/workflow/*` (delete entire dir)
- `src/editor-extensions/date-time/task-timer.ts` (delete)
- `src/pages/TaskView.ts` (delete after porting dirty changes — see PHASE0_DEFERRED.md Item 1)

**Files (additions):**
- `src/widgets/registerWidgets.ts` (add TableWidget, QuadrantWidget)
- `src/widgets/views/TableWidgetView.ts` (new, port from `src/components/features/table/`)
- `src/widgets/views/QuadrantWidgetView.ts` (new, ~200 LOC — codeblock embedding only)
- `src/migration/v10/ViewMigration.ts` (new)
- `src/utils/migration/steps/v10-view-cleanup.ts` (new — tombstone for removed views)
- `src/common/setting-definition.ts` (`viewConfiguration` defaults: 15 → 5)
- `src/components/features/onboarding/steps/{WelcomeStep,CaptureStep,ViewsStep,DoneStep}.ts` (new — 4 simplified onboarding steps)

**View consolidation (15 → 5 core + 3 widget-only):**

Core (live in FluentTaskView sidebar): `inbox`, `forecast`, `projects`, `tags`, `review`

Widget-only (no sidebar entry, codeblock + `tg:open-view` picker only): `calendar`, `kanban`, `table`

Removed: `gantt`, `quadrant`, `habit`, `working-on`, `flagged`

**Phase 0 deferred Item 1 (port TaskView.ts changes to FluentTaskView):**

The user has uncommitted modifications in `src/pages/TaskView.ts` adding
multi-cycle support to the "switch status" context menu. Before deleting
TaskView.ts:

1. Read the dirty diff (`git diff src/pages/TaskView.ts`). The relevant block
   is the "switch status" submenu builder around line ~1263-1440.
2. Find the equivalent location in `src/pages/FluentTaskView.ts` and port the
   multi-cycle logic. The new code reuses these helpers from
   `src/utils/status-cycle-resolver.ts`:
   - `findApplicableCycles(currentMark, statusCycles)`
   - `getAllStatusNames`
   - `getNextStatusPrimary`
   - `getAllStatusMarks`
3. Move `TASK_VIEW_TYPE` constant from `src/pages/TaskView.ts` to a new file
   `src/common/view-types.ts` (stale leaves in user vaults still need to be
   detached on next load — see `src/index.ts:1825` and `:2116`).
4. Update import sites of `TASK_VIEW_TYPE`:
   - `src/index.ts:72` (also remove the `TaskView` symbol from this import)
   - `src/components/features/fluent/FluentIntegration.ts:13`
5. Delete the `instanceof TaskView` block at `src/index.ts:2119` — unreachable
   since the class is no longer registered.
6. Delete `src/pages/TaskView.ts`.
7. Run typecheck + integration suite.

**Migration step `v10-view-cleanup`** (`src/migration/v10/ViewMigration.ts`):
```ts
const REMOVED = ["gantt", "quadrant", "habit", "working-on", "flagged"];
const DEMOTED = ["calendar", "kanban", "table"];

// 1. Snapshot removed view configs into Archive/views/removed-views.json (Worktree B's archiver)
// 2. For removed views with non-default filterRules, create a saved filter preset
//    on the closest core view (working-on → inbox preset, flagged → forecast preset)
// 3. Strip removed entries from plugin.settings.viewConfiguration
// 4. For demoted views, set type:"widget" and remove from FluentTaskView sidebar list
// 5. Walk plugin.settings.workspaces.byId[*].settings.fluentActiveViewId; replace any removed-view ID with "inbox"
// 6. Walk plugin.settings.workspaces.byId[*].settings.hiddenModules and prune removed IDs
```

**Steps 5 + 6 are the WORKSPACE_ONLY_KEYS trap** — workspaces in
`plugin.settings.workspaces.byId[*]` must be cleaned in the same migration
step or workspaces will boot to a broken view.

**Onboarding compression (36 → 5 files):**
```
src/components/features/onboarding/
├── OnboardingView.ts            ← view shell (kept, slimmed)
├── OnboardingController.ts      ← state machine (kept, simplified to 4 steps)
├── steps/
│   ├── WelcomeStep.ts           ← 1. Welcome + import-from-archive prompt
│   ├── CaptureStep.ts           ← 2. Pick target file, hotkey hint, sample capture
│   ├── ViewsStep.ts             ← 3. Pick which of 5 core views to show
│   └── DoneStep.ts              ← 4. "You're ready" + docs link
└── ui/Layout.ts                 ← shared step layout (kept, simplified)
```
Delete every `Fluent*Step.ts`, `UserLevelStep`, `ModeSelectionStep`,
`ConfigPreviewStep`, `SettingsCheckStep`, `PlacementStep`, `IntroStep`,
`TaskGuideStep`, all of `steps/intro/`, `steps/guide/`, `steps/preview/`,
`previews/`, `TaskCreationGuide.ts`. **No more Beginner/Advanced/Power
branching** — one linear flow.

**DoD subset:** all 5 core views render with an empty vault, all workspaces
boot to a valid `fluentActiveViewId`, onboarding completes in ≤4 steps,
LOC reduction visible (`find src/ -name "*.ts" | xargs wc -l` should be
notably lower).

---

### D.5 — Migration confirmation modal

**Files:**
- `src/migration/v10/ConfirmationModal.ts` (new)
- `src/utils/migration/steps/v10-archive.ts` (new — wraps Worktree B's `archiveAll`)
- `src/index.ts` (first-launch detection in onload)

**The migration confirmation modal:**

On first launch of 10.0.0, BEFORE any view renders, show a blocking modal:

```
┌────────────────────────────────────────────┐
│ Task Genius is upgrading to v10.           │
│                                            │
│ The following will be archived:            │
│   • 47 workflows → Task Genius Archive/    │
│     workflows/                             │
│   • 12 habits → habits/                    │
│   • 3 ICS sources → calendar-sync/         │
│   • 5 custom views → views/                │
│                                            │
│ Archive folder: [Task Genius Archive   ]   │
│                                            │
│ [Cancel & rollback to v9]   [Preview]      │
│                            [Apply ▶]       │
└────────────────────────────────────────────┘
```

Driven by `MigrationRegistry.run(settings, {dryRun: true})` for the Preview
button, then `dryRun: false` on Apply. Cancel exits Obsidian without
persisting (leaves `data.json` untouched, instructions on how to revert).

**Wire `archiveAll` (from Worktree B) into the registry as `v10-archive`:**

```ts
// src/utils/migration/steps/v10-archive.ts
import { archiveAll } from "@/migration/v10/Archiver";
import type { MigrationStep } from "../MigrationRegistry";

export const v10ArchiveStep: MigrationStep = {
  id: "v10.0.0-archive",
  targetVersion: "10.0.0",
  kind: "transform",
  description: "Archive deprecated feature data to <vault>/Task Genius Archive/",
  apply: async (settings, ctx) => {
    // The migration is two-part:
    //   1. Run archiveAll() to compute the archive contents
    //   2. Have the modal write them to the vault (since the registry is pure)
    // The "writing" is done by the ConfirmationModal in apply phase, NOT here.
    // This step's job is just to mark that the archive happened.
    return { changed: true, details: ["v10 archive scheduled"] };
  },
};
```

**Beta vs stable behavior:** in `10.0.0-beta.X`, the modal defaults to
"preview only, do not apply" — user must explicitly click Apply. In stable
`10.0.0`, Apply is the primary button.

**DoD subset:** the §3.10 acceptance test from the main plan — the "single
hardest test":

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

## Definition of Done (worktree-level)

| # | Criterion | How to verify |
|---|---|---|
| 1 | The §3.10 acceptance test from the main plan | Manual smoke on a real vault |
| 2 | First-time user enables plugin → first captured task in ≤60 seconds, ≤5 clicks | Manual on a fresh vault |
| 3 | Onboarding completes in ≤4 steps, ≤90 seconds | Manual |
| 4 | Settings opens in ≤500ms | Performance tab in dev tools |
| 5 | All workspaces boot to a valid `fluentActiveViewId` (no removed view IDs) | `git grep -l "removed view" src/__tests__` |
| 6 | All custom hotkeys for surviving commands still work | Manual |
| 7 | URI bookmarks pointing to deprecated tabs land somewhere reasonable with a Notice | Manual: navigate to `obsidian://task-genius?action=settings&tab=workflow` |
| 8 | No console errors during migration | `src/__tests__/migration/v10-migration.test.ts` |
| 9 | Main plugin LOC ≤ 42k (target 40k, ceiling 42k) | `find src/ -name "*.ts" -not -path "*__tests__*" -not -path "*__mocks__*" \| xargs wc -l \| tail -1` |
| 10 | 0 references to deleted modules | `git grep "from.*workflow"`, `git grep "from.*habit-manager"`, etc. — all should be empty in main plugin |
| 11 | All 5 core views render with an empty vault | Manual |
| 12 | All 16 commands appear in palette with new names | Manual |
| 13 | Phase 0 integration tests still pass | `npm test -- --testPathPattern="integration/"` |
| 14 | TypeScript build clean | `npm run build` |

## Conflicts within Worktree D

D.1-D.4 each touch `src/index.ts` differently:
- D.1 changes settings tab routing
- D.2 rewrites commands
- D.3 changes quick-capture commands
- D.4 deletes timer/workflow commands

**Sequence them: D.2 first (it owns the command block), then D.1, D.3, D.4
in any order, then D.5 last.**

## Open questions that affect THIS worktree

- **Q1 — Deprecation list:** if the user pulls anything back, the corresponding
  D.4 deletion gets skipped. Confirm before D.4 starts.
- **Q3 — Default hotkeys:** the 5 defaults (`Mod+Shift+T`, etc.) are baked
  into D.2. If the user wants different bindings or no defaults, change at
  the top of D.2.
- **Q4 — Cliff version:** 4-week vs 8-week runway only affects WHEN you
  start (after C merges, plus the beta soak period). Doesn't change scope.

## Useful existing utilities

- `src/managers/changelog-manager.ts` — for the "What changed" first-run sheet
- `src/utils/migration/MigrationRegistry.ts` (Phase 0) — already supports
  atomic + dry-run, just add new steps
- `src/dataflow/cache/scope-map.ts` (Phase 0) — typed scope map for the
  settings consolidation; D.1 should migrate the settings tab callers to
  `onSettingsFieldsChanged()` as it rewrites them
- `src/widgets/core/BaseWidgetView.ts` — base for new TableWidgetView and
  QuadrantWidgetView
- `src/widgets/codeblock/WidgetCodeBlockProcessor.ts` — codeblock embedding,
  no changes needed

## Don't do these things

- **Don't ship without the migration confirmation modal.** D.5 is mandatory.
  The whole point of Phase 0/1/2 was to set up the safety net for D.5 — it's
  the user's only protection against data loss.
- **Don't keep `legacy` flags.** v10 is the cliff. No `enableV9Compatibility`
  toggles.
- **Don't translate strings to non-English locales.** Worktree E's locale
  prune handles parity.
- **Don't release `task-genius-calendar-sync` v0.1.0** — that's Worktree E.
  Calendar sync is the riskiest sub-plugin (OAuth tokens) and gets held until
  10.0.1 for an extra week of soak.

## When you're done

```bash
git push origin refactor/v10-phase3-cliff
gh pr create --base master --title "feat: v10 cliff - 16 commands, 7 settings tabs, 5 core views (Phase 3, Worktree D)"
```

After merge, **Worktree E is unblocked**. Tag `10.0.0`. The cleanup phase
begins.
