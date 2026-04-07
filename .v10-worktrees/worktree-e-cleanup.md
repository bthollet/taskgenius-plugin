# Worktree E — Phase 4 Cleanup (10.0.1)

## What you're doing

The cliff is behind us — 10.0.0 shipped with the migration confirmation modal,
the new 7-tab settings UI, the 16-command palette, the 5 core views, and
~50% of the LOC deleted. Worktree E is the **cleanup pass** that:

- Removes the migration code itself (its job is done)
- Drops the one-version command-ID aliases that Worktree D shipped for
  backward compatibility
- Prunes orphan locale keys
- Releases `task-genius-calendar-sync` v0.1.0 (the riskiest sub-plugin, held
  back from Phase 2 for an extra week of soak)

This is the smallest worktree by LOC. It's mostly bookkeeping with one
sub-plugin release coordination.

## Phase 0/1/2/3 ground

You depend on **Worktree D merged to master**. Verify before starting:

```bash
git fetch
git log master --oneline | head -5
# Expect: "feat: v10 cliff..." (Worktree D) is the most recent commit
git tag | grep "10.0.0$"
# Expect: 10.0.0 tag exists
```

Beta soak should have run for ~5 days minimum after `10.0.0-beta.1` was cut
in Phase 2. If real users on the beta channel are reporting bugs, FIX THOSE
FIRST before starting Worktree E — your work is post-stability cleanup, not
emergency response.

## Setup

```bash
git fetch
git worktree add ../tg-phase4-cleanup master
cd ../tg-phase4-cleanup
git checkout -b refactor/v10-phase4-cleanup

npm install
npm test -- --testPathPattern="integration/"
# Expect: 70+ passing
```

## Files you'll modify

- `src/migration/v10/Archiver.ts` (delete — its job is done, archive folder lives in user vaults forever)
- `src/migration/v10/index.ts` (update exports)
- `src/utils/migration/steps/v10-archive.ts` → tombstone-only marker
- `src/utils/migration/steps/v10-view-cleanup.ts` → tombstone marker
- `src/index.ts` (drop one-version command aliases that D.2 shipped)
- `src/__tests__/migration/v10/` (delete the Archiver tests since the source is gone)

## Files you'll create

- `scripts/prune-locale-orphans.mjs` (new — one-shot script)
- `src/__tests__/locale-parity.test.ts` (new — CI guard against regressions)

## Tasks (in order)

### Task 1 — Tombstone the migration code (~½ day)

The `v10-archive` and `v10-view-cleanup` migration steps did their job in
10.0.0. They should now become **no-op tombstones** that just record "already
applied" via `_meta.lastMigratedVersion`. The actual archive logic in
`src/migration/v10/Archiver.ts` is no longer needed.

For each of the two steps:

```ts
// Before (10.0.0)
export const v10ArchiveStep: MigrationStep = {
  id: "v10.0.0-archive",
  targetVersion: "10.0.0",
  kind: "transform",
  description: "...",
  apply: async (settings, ctx) => { /* real work */ },
};

// After (10.0.1)
export const v10ArchiveStep: MigrationStep = {
  id: "v10.0.0-archive",
  targetVersion: "10.0.0",
  kind: "tombstone",  // changed from "transform"
  description: "Archive migration applied in 10.0.0 (now no-op)",
  apply: () => ({ changed: false, details: ["already applied"] }),
};
```

The reason to keep the step at all (instead of deleting it) is that users
upgrading from 9.x DIRECTLY to 10.0.1 (skipping 10.0.0) need the registry to
recognize the version slot. With a tombstone marker, the registry sees
`fromVersion < 10.0.0 < toVersion = 10.0.1` and runs the step — which now
no-ops. Without the marker, fresh-install users would also be fine, but
upgrading users wouldn't have a migration record at the right version.

Then delete `src/migration/v10/Archiver.ts` and its tests:

```bash
rm src/migration/v10/Archiver.ts
rm -rf src/__tests__/migration/v10/
```

Update `src/migration/v10/index.ts` to remove the Archiver exports.

### Task 2 — Drop one-version command aliases (~½ day)

Worktree D.2 kept old command IDs as aliases for one version (10.0.0) to
preserve manually-bound hotkeys. Now drop them:

```bash
git grep -n "addCommand.*id:.*['\"]old-command-id['\"]" src/index.ts
# Find the alias registrations and delete them
```

The aliases were:
- `quick-capture` → aliased to `tg:capture`
- `cycle-task-status-forward` → aliased to `tg:mark-cycle`
- ... etc., one alias per surviving command

These are documented in the D.2 sub-PR commit history. Read that commit to
see the full alias list.

Add a CHANGELOG entry: "Removed v9 command aliases. If you bound hotkeys to
old command IDs, rebind them to the v10 equivalents (see CHANGELOG 10.0.0)."

### Task 3 — Locale prune script (~½ day)

`scripts/prune-locale-orphans.mjs`:

```js
#!/usr/bin/env node
/**
 * Prune locale orphans: delete keys in non-en locale files that don't
 * exist in en.ts. Run manually before tagging 10.0.1.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeDir = path.join(__dirname, "..", "src", "translations", "locale");

const en = await import(path.join(localeDir, "en.ts"));
const enKeys = new Set(Object.keys(en.default));

const files = await fs.readdir(localeDir);
for (const file of files) {
  if (file === "en.ts" || !file.endsWith(".ts")) continue;
  // ... parse, prune, write back
}

console.log(`Pruned orphan keys from ${files.length - 1} non-en locales`);
```

Run it:

```bash
node scripts/prune-locale-orphans.mjs
```

This is a ONE-SHOT script. Don't add it to npm scripts or CI. The author
runs it manually when locale orphans accumulate.

### Task 4 — Locale parity Jest test (~½ day)

`src/__tests__/locale-parity.test.ts` — a tiny ratchet test that asserts
every key in `en.ts` exists in every other locale file. New strings added
to `en.ts` are allowed to be missing in other locales (they fall back to
en) — this only fails if a locale file has EXTRA keys that don't exist in
en.

Wait, that's wrong direction. Re-think:

- `en.ts` is the canonical superset
- Other locales should be SUBSETS of `en.ts` (missing translations fall back to en)
- If a non-en locale has a key that en doesn't, that's an orphan — assert it doesn't happen

```ts
import en from "@/translations/locale/en";
import zhCn from "@/translations/locale/zh-cn";
import zhTw from "@/translations/locale/zh-tw";
import ja from "@/translations/locale/ja";
import ru from "@/translations/locale/ru";
import uk from "@/translations/locale/uk";
import ptBr from "@/translations/locale/pt-br";
import enGb from "@/translations/locale/en-gb";

const enKeys = new Set(Object.keys(en));

describe("locale parity (W4 cleanup)", () => {
  test.each([
    ["zh-cn", zhCn],
    ["zh-tw", zhTw],
    ["ja", ja],
    ["ru", ru],
    ["uk", uk],
    ["pt-br", ptBr],
    ["en-gb", enGb],
  ])("%s has no orphan keys not in en.ts", (name, locale) => {
    const orphans = Object.keys(locale).filter((k) => !enKeys.has(k));
    expect(orphans).toEqual([]);
  });
});
```

This is the **automated** complement to the manual prune script. The script
runs occasionally; the test runs every PR.

### Task 5 — Release `task-genius-calendar-sync` v0.1.0 (~2 days, mostly out of repo)

This is the riskiest sub-plugin — OAuth tokens, token refresh, CalDAV write
operations. It was held back from Phase 2 for an extra week of soak after
v10.0.0 ships.

Tasks:
1. Create the new repo `task-genius-calendar-sync` (copy main plugin's tooling)
2. Migrate `src/providers/*`, `src/managers/calendar-auth-manager.ts` from the
   main plugin (which deleted them in Worktree D.4)
3. Add a one-time importer that reads from `<vault>/Task Genius Archive/calendar-sync/caldav-sources.json`
4. Test with a real Google Calendar account (out of repo)
5. Release v0.1.0 to community plugins (or BRAT)
6. Pin a "calendar sync available" announcement to the GitHub Discussion

This task is largely external to the main plugin repo. The main-plugin side
is just verifying nothing reads from the deleted provider files (`git grep`).

### Task 6 — Bump version + tag (~10 minutes)

```bash
# In the main plugin repo
# Bump manifest.json from 10.0.0 to 10.0.1
# Bump versions.json (the Obsidian plugin version map)
# Commit
git tag v10.0.1
git push origin v10.0.1
```

## Definition of Done

| # | Criterion | How to verify |
|---|---|---|
| 1 | `src/migration/v10/Archiver.ts` deleted | File doesn't exist; `git grep "Archiver"` returns no production matches |
| 2 | Both v10 migration steps are tombstones (no-op) | Code review |
| 3 | One-version command aliases removed from `src/index.ts` | `git grep "alias.*10.0.0"` returns nothing |
| 4 | Locale prune script exists and runs without error | `node scripts/prune-locale-orphans.mjs` exits 0 |
| 5 | Locale parity Jest test exists and passes | `npm test -- --testPathPattern="locale-parity"` |
| 6 | `task-genius-calendar-sync` v0.1.0 published | Out of repo; check community plugins or BRAT |
| 7 | `manifest.json` is `10.0.1` | File contents |
| 8 | TypeScript build clean | `npm run build` |
| 9 | All Phase 0 + Phase 3 integration tests still pass | `npm test -- --testPathPattern="integration/"` |
| 10 | No deleted-module references | `git grep "from.*workflow"`, `git grep "from.*habit-manager"`, `git grep "from.*timer-manager"`, `git grep "from.*calendar-auth"` — all empty |
| 11 | Main plugin LOC ≤ 42k (still hitting the v10 ceiling) | `find src/ -name "*.ts" -not -path "*__tests__*" -not -path "*__mocks__*" \| xargs wc -l \| tail -1` |

## Conflicts to watch

**None.** By the time Worktree E starts, Phase 3 is merged and stable. No
other worktrees are in flight.

## Open questions that affect THIS worktree

- **Q2 — Sub-plugin commitment:** if the user changed their mind about
  `task-genius-calendar-sync` (e.g. wants to delete OAuth/CalDAV outright
  instead of extracting), Task 5 gets skipped. Confirm before starting.

The other 4 questions are settled by the time you reach Phase 4.

## Useful existing utilities

- `src/utils/migration/MigrationRegistry.ts` — already supports `kind: "tombstone"` (Phase 0)
- `src/translations/locale/*.ts` — existing locale files; the prune script
  walks them
- `src/translations/helper.ts` — `t()` translation helper

## Don't do these things

- **Don't delete the migration steps entirely.** They become tombstones, not
  deletions. Tombstones preserve the version slot for skip-version upgrades.
- **Don't translate orphan strings before pruning.** The prune script
  determines which strings are orphans by comparing to en.ts. Translate AFTER
  the prune, not before.
- **Don't add the prune script to CI or npm scripts.** It's a one-shot tool;
  the author runs it manually.
- **Don't ship `task-genius-calendar-sync` without testing OAuth refresh on
  a real account.** This is the highest-risk sub-plugin; an untested
  refresh-token bug = users locked out of their calendars.
- **Don't bump the major version.** 10.0.1 is a patch release; 10.1.0 is
  reserved for the first feature release post-cliff.

## When you're done

```bash
git push origin refactor/v10-phase4-cleanup
gh pr create --base master --title "chore: v10 cleanup - tombstones, locale prune, calendar-sync release (Phase 4, Worktree E)"
```

After merge, tag `v10.0.1` and the v10 refactor effort is COMPLETE. The
plugin is at ~40k LOC, the user has 5 core views + 16 commands + 7 settings
tabs + 1 quick-capture modal + a 4-step onboarding, and 4 sub-plugins are
available for users who want the deprecated features back.

Update CHANGELOG.md with a final summary entry and consider writing a blog
post / GitHub release note explaining the 6-week journey for users who
weren't in the loop.
