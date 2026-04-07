# Worktree C — Phase 2 Read-Only Mode + Beta (9.15.0)

## What you're doing

Phase 1 (Worktrees A + B) shipped 9.14.0 with deprecation banners. Phase 2 is
the **hard warning** week: deprecated settings tabs become read-only (inputs
disabled, only the Export button works), deprecated commands fire a one-shot
Notice on first use per session, and v10 enters beta via BRAT.

This is the last stop before the cliff. After your worktree merges and ships
9.15.0, the beta channel gets 10.0.0-beta.1 and a ~5 day soak period.

## Phase 0 + Phase 1 ground

You depend on **Worktree A merged to master**. Verify before starting:

```bash
git fetch
git log master --oneline | grep "deprecation banners"
# Expect: "feat(settings): deprecation banners (Phase 1, Worktree A)" present
```

If not present, **do not start.** Worktree C cannot run in parallel with A —
you'll fight for the same 14 settings tab files.

Worktree B (Archiver) can be merged or pending; you only need its functions
for the export buttons (which are already wired by Worktree A).

## Setup

```bash
git fetch
git worktree add ../tg-phase2-readonly master
cd ../tg-phase2-readonly
git checkout -b refactor/v10-phase2-readonly

npm install
npm test -- --testPathPattern="integration/"
# Expect: 70+ passing
```

## Files you'll modify

The same 14 deprecated tab files Worktree A injected banners into. You're
adding a `readOnly` mode to each one:

1-14. All `src/components/features/settings/tabs/{Workflow,Habit,Reward,TaskTimer,TimelineSidebar,Ics,Index,DesktopIntegration,About}SettingsTab.ts` (and the 5 view-config sections)

Plus:
- `src/components/features/settings/components/DeprecationBanner.ts` (banner copy update)
- `src/common/deprecation-messages.ts` (add Notice strings for commands)
- `src/index.ts` (wrap deprecated commands with one-shot Notice)
- `src/managers/changelog-manager.ts` (10.0.0-beta.1 announcement modal)
- `manifest-beta.json` (bump to 10.0.0-beta.1)

## Tasks (in order)

### Task 1 — Add `readOnly` mode to DeprecationBanner (~½ day)

Extend the banner component (from Worktree A):

```ts
export interface DeprecationBannerProps {
  // ... existing fields from Phase 1
  readOnly?: boolean;  // NEW
}
```

When `readOnly: true`, the banner copy upgrades from "moves to X in v10" to
"**read-only — export now**" and the "Export" button gets primary button
styling. Visual: same yellow background, but more urgent affordance.

Update CSS in `src/styles/setting.scss` for the new state.

### Task 2 — Disable inputs in 14 deprecated tabs (~2 days)

For each tab/section, walk the `Setting()` chains and call `.setDisabled(true)`
on each input when the tab is in read-only mode. The `Export` button stays
enabled. Add a `disabled` prop or a flag at the top of each render function.

Pattern:

```ts
// Before
new Setting(containerEl)
  .setName("Enable workflows")
  .addToggle(t => t.setValue(plugin.settings.workflow.enableWorkflow)
    .onChange(async v => { ... }));

// After (Phase 2)
const readOnly = true; // hardcoded — Phase 3 deletes the tab entirely
new Setting(containerEl)
  .setName("Enable workflows")
  .addToggle(t => t.setValue(plugin.settings.workflow.enableWorkflow)
    .setDisabled(readOnly)
    .onChange(async v => { if (readOnly) return; ... }));
```

Pass the `renderDeprecationBanner` call `{readOnly: true, ...}`.

For sectioned tabs (Ics, Index, DesktopIntegration), only the deprecated
sections become read-only — the rest of the tab stays interactive.

### Task 3 — Wrap deprecated commands with first-use Notice (~1 day)

`src/index.ts` — for each command that targets a deprecated feature, wrap the
existing callback with a one-shot Notice:

```ts
// New helper at the top of registerCommands or in a small util
const _deprecationWarned: Record<string, boolean> = {};
function warnDeprecatedOnce(commandId: string, message: string): void {
  if (_deprecationWarned[commandId]) return;
  _deprecationWarned[commandId] = true;
  new Notice(message, 6000);
}

// Wrap each deprecated command's callback
this.addCommand({
  id: "create-quick-workflow",
  name: t("Create Quick Workflow"),
  editorCallback: async (editor, ctx) => {
    warnDeprecatedOnce(
      "create-quick-workflow",
      t("This command is removed in v10. Install task-genius-workflow."),
    );
    // existing logic still runs
    return createQuickWorkflowCommand(plugin, editor, ctx);
  },
});
```

The 11 deprecated commands to wrap:
- 6 workflow commands from `src/commands/workflowCommands.ts`
- 5 task-timer commands (find via `grep -l "task-timer-" src/index.ts`)
- 1 reindex-habits command

Memory is per-session (cleared on plugin reload). Don't store in settings.

### Task 4 — Update Notice strings in deprecation-messages.ts (~½ day)

Add new keys for each command-level Notice. Centralize so locales translate
once.

### Task 5 — Sub-plugin v0.1.0 release coordination (out of repo, ~1 day)

This is the part that touches OTHER repos:

- `task-genius-workflow` v0.1.0 — release with a **one-time bootstrap importer**
  that reads from main plugin's live `data.json` (not yet from `Task Genius
  Archive/`, since 9.15 hasn't archived anything yet)
- `task-genius-habits` v0.1.0 — same pattern
- `task-genius-timer` v0.1.0 — same pattern
- **`task-genius-calendar-sync` is HELD** — riskiest one (OAuth tokens),
  ships in Phase 4 (Worktree E)

Each sub-plugin's bootstrap importer logs which fields it imported and writes
a marker `<sub-plugin-data-dir>/.imported-from-main-plugin` so it doesn't
double-import on next load.

The sub-plugin repos don't exist yet — Worktree C creates them. Use the
main plugin's tooling (esbuild config, jest config, manifest format) as a
template.

### Task 6 — Cut 10.0.0-beta.1 (~½ day)

`manifest-beta.json` — bump to `10.0.0-beta.1`. Worktree D will own the
actual 10.0.0 work; this commit just opens the beta channel so testers can
opt in early.

`src/managers/changelog-manager.ts` — add a beta-only announcement: "v10
beta is here. Migration modal will appear on first launch — please test on
a backup vault first."

## Definition of Done

| # | Criterion | How to verify |
|---|---|---|
| 1 | All 14 deprecated tabs/sections show inputs as disabled | Manual: open Settings, try to toggle anything in Workflows tab — should be grayed out |
| 2 | Export buttons in each tab still functional | Manual: click each export button, verify archive folder updates |
| 3 | Banner copy updated to "read-only — export now" | Manual visual check |
| 4 | Each deprecated command fires a Notice on first use per session | Manual: invoke `Create Quick Workflow` twice — Notice once, second time silent |
| 5 | Notice memory clears on plugin reload | Manual: reload plugin, invoke command again — Notice fires again |
| 6 | 3 sub-plugins (workflow, habits, timer) released to community plugins or BRAT | Out of repo — verify by installing fresh and confirming bootstrap importer runs |
| 7 | 10.0.0-beta.1 published via BRAT | `manifest-beta.json` shows `10.0.0-beta.1`, BRAT installs it, real beta tester confirms it loads |
| 8 | TypeScript build clean | `npm run build` |
| 9 | Phase 0 integration tests still pass | `npm test -- --testPathPattern="integration/"` |
| 10 | No regression in non-deprecated tabs | Manual: open General/Tasks/Views, edit a setting, verify it persists |

## Conflicts to watch

- **Worktree D (Phase 3)** will DELETE the 14 tabs you're modifying. Same as
  the A→D conflict — Phase 3 starts after Phase 2 merges, no overlap.
- **Worktree B (Archiver)** — your Export buttons call Worktree B's functions.
  If B hasn't merged, the buttons remain stubbed (Worktree A's stubs from
  Phase 1). Don't block on B; it'll be ready by the time you finish.

## Open questions that affect THIS worktree

- **Q4 — Cliff version (4 weeks vs 8 weeks):** the default is 4 weeks. If the
  user wants 8, your worktree gets a longer beta soak (10.0.0-beta.1 stays in
  the field for ~2 weeks instead of ~5 days). The work itself doesn't change.
- **Q5 — Beta tester recruitment:** Worktree A pinned the GitHub Discussion.
  By the time you start, recruitment should have produced ~5-10 testers. If
  it hasn't, push the discussion harder before cutting beta.

## Useful existing utilities

- The Obsidian `Setting` class' `.setDisabled(true)` method — works on every
  input type (toggle, text, dropdown, slider, button)
- `Notice` from obsidian — your one-shot Notice helper wraps this
- `manifest-beta.json` — already exists, just bump the version field

## Don't do these things

- **Don't delete any tabs.** Worktree D owns deletions.
- **Don't modify the dataflow layer.** All your changes are UI + command callbacks.
- **Don't make the Notice persistent across sessions.** Per-session is the
  contract — users who reload the plugin should see the warning again.
- **Don't ship a 10.0.0 manifest.** Only `manifest-beta.json` gets bumped.
  `manifest.json` stays at `9.15.0`.
- **Don't translate Notice strings to non-English locales.** Worktree E's
  locale prune handles parity.

## When you're done

```bash
git push origin refactor/v10-phase2-readonly
gh pr create --base master --title "feat(settings): read-only deprecated tabs + first-use command notice (Phase 2, Worktree C)"
```

After merge, **Worktree D is unblocked**. Tag `9.15.0` and cut
`10.0.0-beta.1` via BRAT. The 5-day beta soak begins.
