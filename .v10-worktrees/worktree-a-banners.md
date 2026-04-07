# Worktree A — Phase 1 Deprecation Banners (9.14.0)

## What you're doing

Task Genius is being slimmed down for v10 (~95k LOC → ~40k LOC). Phase 1 is
the **announce + soft warning** week: deprecated settings tabs get a yellow
banner, the changelog modal auto-opens once on first launch of 9.14.0, and
nothing actually breaks for users yet. This is the gentle on-ramp.

Your worktree is one of two Phase 1 worktrees that run **in parallel**:
- **Worktree A (this one)** — UI banners + changelog modal (user-facing)
- **Worktree B** — Archiver pure functions (infrastructure for Phase 3)

A and B touch disjoint files. Both branch off `refactor/v10-phase0`.

## Phase 0 ground

You're branching off `refactor/v10-phase0` (already merged-quality, 6 commits,
71 new tests). Phase 0 added the MigrationRegistry, fixed lifecycle hazards,
added cache guardrails, and shipped integration test infrastructure. None of
that affects your work directly — you're touching settings UI files, not
dataflow.

## Setup

```bash
# From the main repo root
git fetch
git worktree add ../tg-phase1-banners refactor/v10-phase0
cd ../tg-phase1-banners
git checkout -b refactor/v10-phase1-banners

# Verify the integration tests pass on this branch
npm install
npm test -- --testPathPattern="integration/"
# Expect: 70+ passing in the integration namespace
```

## Files you'll create

- `src/components/features/settings/components/DeprecationBanner.ts` — new component (~60 LOC)
- `src/common/deprecation-messages.ts` — centralized i18n strings (~80 LOC)

## Files you'll modify (14 deprecated tabs + supporting files)

The 14 deprecated tabs each get a one-line `DeprecationBanner` injection at
the top of their `renderXxxSettingsTab()` function:

1. `src/components/features/settings/tabs/WorkflowSettingsTab.ts` → "Workflows move to `task-genius-workflow` in v10"
2. `src/components/features/settings/tabs/HabitSettingsTab.ts` → "Habits move to `task-genius-habits`"
3. `src/components/features/settings/tabs/RewardSettingsTab.ts` → "Rewards move to `task-genius-habits`"
4. `src/components/features/settings/tabs/TaskTimerSettingsTab.ts` → "Timer moves to `task-genius-timer`"
5. `src/components/features/settings/tabs/TimelineSidebarSettingsTab.ts` → "Timeline Sidebar removed in v10. Forecast view replaces it."
6. `src/components/features/settings/tabs/IcsSettingsTab.ts` (OAuth/CalDAV section only — read-only ICS stays in main plugin) → "OAuth/CalDAV moves to `task-genius-calendar-sync`"
7. `src/components/features/settings/tabs/IndexSettingsTab.ts` (file-as-task source section) → "File-as-Task source removed in v10"
8. `src/components/features/settings/tabs/DesktopIntegrationSettingsTab.ts` (electron-quick-capture window section) → "Electron quick-capture window removed in v10"
9-12. Sections within the views tab: Gantt, Quadrant, Habit view, Working-On view, Flagged view (5 view-config entries deprecated)
13. Holiday detector toggle (find via `grep -r "holiday-detector" src/components/features/settings/`)
14. AboutSettingsTab — gets a "Deprecations" collapsible at the top

Plus:
- `src/components/features/settings/index.ts` — export the new banner component
- `src/managers/changelog-manager.ts` — wire to auto-open the v10 announcement on 9.14.0 first launch
- `src/translations/locale/en.ts` — add new strings for banner copy

## Tasks (in order)

### Task 1 — Build the DeprecationBanner component (~½ day)

`src/components/features/settings/components/DeprecationBanner.ts`:

```ts
export interface DeprecationBannerProps {
  tabId: string;
  replacementText: string;        // e.g. "Workflows move to task-genius-workflow"
  exportLabel?: string;            // e.g. "Export this section now"
  exportAction?: () => Promise<void> | void;
  learnMoreUrl?: string;
  // Phase 2 will add: readOnly?: boolean
}

export function renderDeprecationBanner(
  containerEl: HTMLElement,
  props: DeprecationBannerProps,
): void {
  // Yellow background, alert icon, message text, optional Export button,
  // optional "Learn more" link. ~60 LOC. CSS class .tg-deprecation-banner.
}
```

Add CSS in `src/styles/setting.scss` (or wherever the existing settings styles
live — grep `.task-genius-setting`).

### Task 2 — Centralize the strings (~½ day)

`src/common/deprecation-messages.ts`:

```ts
export const DEPRECATION_MESSAGES = {
  workflow: {
    bannerText: "Workflows move to the task-genius-workflow plugin in v10. ...",
    exportLabel: "Export workflows now",
    learnMoreUrl: "https://github.com/.../discussions/...",
  },
  habit: { ... },
  // ... 14 total entries
} as const;
```

This becomes the single source of truth so locales translate one set of
strings, not 14 spread across tabs. Phase 2 will add more keys here.

### Task 3 — Wire banners into 14 tabs (~1.5 days)

For each of the 14 tab files, add a one-line `renderDeprecationBanner(containerEl, ...)`
call at the top of the render function (before any existing content). The
tab continues to function normally; the banner is purely additive.

For tabs that have a deprecated **section** (not the whole tab) — IcsSettingsTab,
IndexSettingsTab, DesktopIntegrationSettingsTab — render the banner above the
deprecated section, not the whole tab.

The "Export this section now" button calls a stub from Worktree B's Archiver:

```ts
import { archiveWorkflows } from "@/migration/v10/Archiver";  // from Worktree B

exportAction: async () => {
  const result = await archiveWorkflows(plugin);
  // For Phase 1 we just write to vault — Phase 3 wraps in transactional migration
  for (const [path, content] of result.files) {
    await plugin.app.vault.create(path, content);
  }
  new Notice(`Archived ${result.files.size} files to Task Genius Archive/`);
},
```

**Coordination with Worktree B:** if B hasn't merged yet, stub the import as
`async () => { new Notice("Export coming soon"); }` and add a TODO. Do not
block on B.

### Task 4 — AboutSettingsTab "Deprecations" panel (~½ day)

`src/components/features/settings/tabs/AboutSettingsTab.ts` — add a collapsible
section at the top of the tab listing all 14 deprecations with one global
"Export everything" button. The button calls all 7 archive functions in
sequence (or sequentially with a progress notice if you want to be fancy).

### Task 5 — Auto-open v10 announcement on 9.14.0 first launch (~½ day)

`src/managers/changelog-manager.ts` already auto-opens on version change.
Verify the existing logic and add a one-time announcement modal for 9.14.0
that links to the pinned GitHub Discussion. Body content goes in
`src/translations/locale/en.ts` (a new key like `v10AnnouncementBody`).

### Task 6 — Update CHANGELOG.md and create the GitHub Discussion (~½ day, out of repo)

- Add a `## 9.14.0` section to CHANGELOG.md announcing the v10 deprecations
- Create a pinned GitHub Discussion titled **"Task Genius v10: what's changing
  and how to prepare"** with the TL;DR table from the main plan, the archive
  folder explanation, sub-plugin install instructions, and an FAQ section
- Pin a thread for beta tester recruitment

## Definition of Done

| # | Criterion | How to verify |
|---|---|---|
| 1 | All 14 deprecated tabs/sections show banners in real-vault smoke test | Manual: open Settings, visit each, confirm banner is at the top |
| 2 | Each banner's "Export this section" button creates files in `<vault>/Task Genius Archive/<section>/` | Manual: click each export button, verify the folder appears |
| 3 | Changelog modal auto-opens once on 9.14.0 first launch | Manual: bump manifest.json to 9.14.0, reload plugin, verify modal opens; reload again, verify it does NOT open |
| 4 | AboutSettingsTab has a "Deprecations" collapsible at the top with a global "Export everything" button | Manual |
| 5 | No regression in existing tab rendering (all 25 tabs still render their existing content) | Manual + `npm test` |
| 6 | New strings only in `en.ts`; locale fallback handles other languages | Code review |
| 7 | TypeScript build clean (`npm run build`) | Auto |
| 8 | Phase 0 integration tests still pass | `npm test -- --testPathPattern="integration/"` |
| 9 | CHANGELOG.md updated, GitHub Discussion pinned | Manual |

## Conflicts to watch

- **Worktree C (Phase 2)** will modify the same 14 tab files to add read-only
  mode. **C cannot start until A is merged to master.** Don't try to run them
  in parallel.
- **Worktree D.1 (Phase 3)** will DELETE most of these tabs. The banners get
  removed in Phase 3. That's expected — your work is the bridge that gives
  users 4 weeks of warning before the deletion.

## Open questions that affect THIS worktree

The v10 plan has 5 open questions; defaults are documented in
[`./README.md`](./README.md). The two that touch your work:

- **Q1 — Deprecation list:** the 14 features listed above are the default. If
  the user pulls any back, your task list shrinks accordingly. Wait for
  user confirmation if you're about to ship a banner for a feature they
  changed their mind about.
- **Q5 — Beta tester recruitment:** the GitHub Discussion goes up when your
  worktree starts. If the user doesn't have a tester pool, the Discussion
  recruits explicitly.

The other 3 (sub-plugin commitment, hotkey policy, cliff version) don't
affect this worktree — they kick in for Worktree C and D.

## Useful existing utilities to reuse

- `src/managers/changelog-manager.ts` — already supports auto-open on version change (Task 5)
- `src/components/features/changelog/` — ChangelogView component (re-use for the announcement)
- `src/translations/helper.ts` — `t()` translation helper
- The existing `Setting()` chain pattern from any tab file is your model for adding the banner above existing settings

## Don't do these things

- **Don't delete any tabs.** Phase 3 owns deletions. Banners are additive only.
- **Don't make any tab read-only.** That's Phase 2 / Worktree C.
- **Don't wire the banners' export action through MigrationRegistry.** That's
  Phase 3 / Worktree D.5. For Phase 1, the export is a direct call to the
  Archiver function (which Worktree B is building in parallel).
- **Don't touch the dataflow layer.** Your changes are 100% UI.
- **Don't translate strings to non-English locales.** Just `en.ts`. The locale
  prune script in Phase 4 (Worktree E) handles parity.
- **Don't migrate any callers off `Orchestrator.onSettingsChange(scopes[])` to
  the typed `onSettingsFieldsChanged(fields[])`.** Leave that for Phase 1+
  feature work as features are touched. Your worktree shouldn't even import
  the Orchestrator.

## When you're done

```bash
# From your worktree
git push origin refactor/v10-phase1-banners
gh pr create --base master --title "feat(settings): deprecation banners (Phase 1, Worktree A)"
```

After merge, signal that **Worktree C is unblocked** (it depends on A's
merge to master).
