# Worktree B — Phase 1 Archiver Pure Functions (9.14.0)

## What you're doing

Task Genius is being slimmed down for v10. When users upgrade to 10.0.0,
their persistent data for deprecated features (workflows, habits, rewards,
etc.) gets archived to a vault folder so they don't lose it. The archive
folder is also where extracted sub-plugins look for "previous data" on first
install.

Your job is to build the **pure functions** that produce the archive — the
serialization logic — without any wiring to the UI or the migration system.
That wiring is Phase 3 / Worktree D.5.

You're running **in parallel with Worktree A** (banners). A modifies UI files,
B modifies new infrastructure files. Zero conflict.

## Phase 0 ground

You're branching off `refactor/v10-phase0` (already merged-quality, 6 commits).
Phase 0 added the MigrationRegistry which Phase 3 will use to wrap your
archiver functions in atomic migration steps. You don't need to touch the
registry yourself.

## Setup

```bash
git fetch
git worktree add ../tg-phase1-archiver refactor/v10-phase0
cd ../tg-phase1-archiver
git checkout -b refactor/v10-phase1-archiver

npm install
npm test -- --testPathPattern="integration/"
# Expect: 70+ passing
```

## Files you'll create

- `src/migration/v10/Archiver.ts` — 7 pure archive functions (~300 LOC)
- `src/migration/v10/index.ts` — barrel export
- `src/migration/v10/types.ts` — shared types (`ArchiveSection`, etc.)
- `src/__tests__/migration/v10/Archiver.test.ts` — fixture-based tests (~250 LOC)
- `src/__tests__/migration/v10/__fixtures__/realistic-settings.ts` — sample settings shapes for the 7 sections

## Files you will NOT touch

- `src/index.ts` (Worktree D wires the archiver into onload)
- `src/utils/migration/MigrationRegistry.ts` (Worktree D adds the v10-archive step)
- Any settings tab files (Worktree A injects the export buttons that *call* your functions)
- The DataflowOrchestrator (no dataflow concerns here)

## Tasks (in order)

### Task 1 — Define the contract (~½ day)

`src/migration/v10/types.ts`:

```ts
/**
 * The result of one archive function. Pure data — no I/O happens inside the
 * function. The caller is responsible for actually writing files via vault.
 */
export interface ArchiveSection {
  /** Section name, e.g. "workflows", "habits", "timer". */
  section: string;
  /** Files to write, keyed by relative path under <vault>/Task Genius Archive/ */
  files: Map<string, string>;
  /** Human-readable summary for the migration confirmation modal. */
  summary: string;
  /** Optional structured count for the modal: {workflows: 47, habits: 12} */
  itemCount: number;
}

export interface ArchiveManifest {
  version: string;            // plugin version that produced this archive
  exportedAt: number;         // unix epoch ms
  sections: Array<{
    section: string;
    itemCount: number;
    files: string[];          // relative paths
  }>;
}
```

### Task 2 — Implement the 7 archive functions (~3-4 days)

`src/migration/v10/Archiver.ts`:

```ts
import type TaskProgressBarPlugin from "@/index";
import type { ArchiveSection } from "./types";

export async function archiveWorkflows(
  plugin: TaskProgressBarPlugin,
): Promise<ArchiveSection> {
  const workflows = plugin.settings.workflow?.definitions ?? [];
  const files = new Map<string, string>();

  // workflows.json — raw shape, round-trippable
  files.set("workflows/workflows.json", JSON.stringify(
    { version: "v10-archive-1", definitions: workflows },
    null,
    2,
  ));

  // workflows.md — human-readable summary, one workflow per H2
  const md = renderWorkflowsMarkdown(workflows);
  files.set("workflows/workflows.md", md);

  return {
    section: "workflows",
    files,
    summary: `${workflows.length} workflow definition${workflows.length === 1 ? "" : "s"}`,
    itemCount: workflows.length,
  };
}

// ... 6 more functions
```

The 7 functions to implement (each takes `plugin` and returns an `ArchiveSection`):

1. **`archiveWorkflows`** — reads `plugin.settings.workflow.definitions`. Output: `workflows/workflows.json` + `workflows/workflows.md`.
2. **`archiveHabits`** — reads `plugin.settings.habit.habits` (array). Output: `habits/habits.json` + `habits/habits.md`. Each habit gets a markdown section with type, schedule, and history if present.
3. **`archiveRewards`** — reads `plugin.settings.rewards.rewardItems` and `occurrenceLevels`. Output: `rewards/rewards.json` + `rewards/rewards.md`.
4. **`archiveTimerData`** — reads `plugin.settings.taskTimer` config + any in-memory `timerManager` state if accessible. Output: `timer/timer-data.json` + `timer/timer-summary.md`. Note: timer state may also live in localStorage; check `src/services/timer-export-service.ts` for the existing export shape and reuse it.
5. **`archiveCalDavSources`** — reads `plugin.settings.icsIntegration.sources` AND OAuth provider configs. **CRITICAL: strip OAuth tokens** before serializing. Output: `calendar-sync/caldav-sources.json` (URLs + names only).
6. **`archiveRemovedViews`** — reads `plugin.settings.viewConfiguration[]` and filters to entries whose ID is in `["gantt", "quadrant", "habit", "working-on", "flagged"]`. Output: `views/removed-views.json` (per-view filterRules + sort + visibility).
7. **`archiveOrphans`** — catch-all: reads any settings keys that don't have a dedicated archiver and aren't in the v10 keep-list. Output: `orphan-settings.json`. This is the safety net for "we deprecated something we forgot to write a function for."

Plus a top-level orchestrator:

```ts
export async function archiveAll(
  plugin: TaskProgressBarPlugin,
): Promise<{ sections: ArchiveSection[]; manifest: ArchiveManifest }> {
  const sections = await Promise.all([
    archiveWorkflows(plugin),
    archiveHabits(plugin),
    archiveRewards(plugin),
    archiveTimerData(plugin),
    archiveCalDavSources(plugin),
    archiveRemovedViews(plugin),
    archiveOrphans(plugin),
  ]);

  const manifest: ArchiveManifest = {
    version: plugin.manifest.version,
    exportedAt: Date.now(),
    sections: sections.map((s) => ({
      section: s.section,
      itemCount: s.itemCount,
      files: [...s.files.keys()],
    })),
  };

  return { sections, manifest };
}
```

### Task 3 — Build realistic test fixtures (~½ day)

`src/__tests__/migration/v10/__fixtures__/realistic-settings.ts`:

```ts
export const settingsWith47Workflows: Partial<TaskProgressBarSettings> = {
  workflow: {
    enableWorkflow: true,
    definitions: [/* 47 realistic workflow shapes */],
    timestampFormat: "YYYY-MM-DD HH:mm",
    autoAddTimestamp: true,
    calculateSpentTime: false,
  },
};

export const settingsWith12Habits: Partial<TaskProgressBarSettings> = {
  habit: {
    enableHabits: true,
    habits: [/* 12 mixed daily/count/scheduled/mapping habits */],
  },
};

// ... fixtures for the other 5 sections
```

These fixtures double as documentation for what realistic v9 user data looks
like. Phase 3's migration confirmation modal will use the same shapes for its
"X workflows, Y habits" copy.

### Task 4 — Test fixtures end-to-end (~1 day)

`src/__tests__/migration/v10/Archiver.test.ts`:

```ts
import { archiveWorkflows, archiveAll } from "@/migration/v10/Archiver";
import { settingsWith47Workflows, ... } from "./__fixtures__/realistic-settings";

describe("Archiver (Phase 1 Worktree B)", () => {
  it("archiveWorkflows produces expected files for 47 workflows", async () => {
    const plugin = makeFakePlugin({ settings: settingsWith47Workflows });
    const result = await archiveWorkflows(plugin);
    expect(result.itemCount).toBe(47);
    expect(result.files.has("workflows/workflows.json")).toBe(true);
    expect(result.files.has("workflows/workflows.md")).toBe(true);
    const json = JSON.parse(result.files.get("workflows/workflows.json")!);
    expect(json.definitions).toHaveLength(47);
  });

  // ... 1 test per section + 1 for archiveAll
});
```

`makeFakePlugin` is a tiny helper — just `{ settings, manifest: {version: "9.14.0"} }`.
You don't need a full plugin instance.

## Definition of Done

| # | Criterion | How to verify |
|---|---|---|
| 1 | All 7 archive functions return correct shapes for known inputs | `npm test -- --testPathPattern="migration/v10/Archiver"` |
| 2 | `archiveAll` orchestrator produces a valid manifest | Test asserts manifest shape |
| 3 | OAuth tokens are stripped from `archiveCalDavSources` output | Test asserts no `accessToken`/`refreshToken` keys in JSON |
| 4 | Each section has both a JSON (round-trippable) and markdown (human) representation, where applicable | Test asserts both files exist |
| 5 | Functions are pure: no `vault.create`, no `localforage` calls, no `app.workspace.trigger` | Code review |
| 6 | TypeScript build clean (`npm run build`) | Auto |
| 7 | Phase 0 integration tests still pass | `npm test -- --testPathPattern="integration/"` |
| 8 | NOT wired into MigrationRegistry yet | Code review (no edits to `src/utils/migration/`) |

## Coordination with Worktree A

Worktree A's banner export buttons need to call your functions. Provide a
clean import surface:

```ts
// from src/migration/v10/index.ts
export { archiveWorkflows, archiveHabits, /* ... */, archiveAll } from "./Archiver";
export type { ArchiveSection, ArchiveManifest } from "./types";
```

Worktree A imports from `@/migration/v10`. If A starts before B, A stubs the
export action with a TODO; once B merges, A removes the stub. **This is a
soft dependency** — A and B are independent worktrees.

## Conflicts to watch

**None.** Worktree B touches only new files in `src/migration/v10/` and
`src/__tests__/migration/v10/`. No existing code is modified.

The only file you write outside that namespace is potentially nothing — even
the orchestrator export goes through `src/migration/v10/index.ts`.

## Open questions that affect THIS worktree

- **Q2 — Sub-plugin commitment:** the default is YES, 4 sub-plugins. If the
  user changes their mind and wants to delete a feature outright (no sub-plugin
  migration), you can SKIP the corresponding archive function — there's no
  point archiving data nobody will ever consume. Wait for confirmation if this
  changes before you ship `archiveTimerData` etc.

The other 4 questions don't affect this worktree.

## Useful existing utilities

- `src/services/timer-export-service.ts` — already exports timer data to JSON. You can probably import its serialization logic for `archiveTimerData`.
- `src/components/features/quick-capture/modals/QuickCaptureModalWithSwitch.ts` (line ~1006) — has the existing settings shape for quick-capture, useful reference for `archiveOrphans`.
- `src/common/setting-definition.ts` (line ~995, `DEFAULT_SETTINGS`) — list of every settings field, useful for `archiveOrphans` exclusion list.

## Don't do these things

- **Don't write to the vault.** Pure functions only. Phase 3 / Worktree D.5
  handles I/O via the migration registry.
- **Don't import obsidian's `Notice`, `Modal`, or `App`.** Your functions take
  a plugin instance and return data. Nothing more.
- **Don't add dependencies.** Use plain JSON.stringify / template strings.
- **Don't OVERLY pretty-print the markdown.** A simple `# {section} {N}`
  followed by `## {item.name}` for each item is fine. The markdown is a
  fallback view; the JSON is the source of truth for sub-plugin importers.
- **Don't try to make the archive "diff-friendly".** Phase 3 is one-shot;
  there's no need to support incremental archives.

## When you're done

```bash
git push origin refactor/v10-phase1-archiver
gh pr create --base master --title "feat(migration): v10 Archiver pure functions (Phase 1, Worktree B)"
```

After merge, Worktree A can remove its stub imports if it shipped with one.
Worktree D.5 (Phase 3 confirmation modal) will wire your `archiveAll` into
the MigrationRegistry as the `v10-archive` step.
