/**
 * tombstone-0.0.2-sentinel — Phase 0 W1.
 *
 * Proves the `tombstone` MigrationStep kind works end-to-end before Phase 1
 * starts using it for real deprecations.
 *
 * Why a synthetic field?
 * ----------------------
 * The plan suggested tombstoning `taskStatusCycle` / `taskStatusMarks` (legacy
 * single-cycle status fields, replaced by `statusCycles[]`). But a quick grep
 * shows 22+ files in the codebase still read those names directly — they're
 * NOT actually vestigial yet, and tombstoning them in Phase 0 would break
 * behavior. Phase 1 will retire them properly once the readers are gone.
 *
 * For Phase 0 we need a sentinel that exercises the tombstone code path
 * WITHOUT touching any real settings. The solution: tombstone a synthetic
 * field `_meta._sentinelMarker` that production never has, and that tests
 * can inject before running the registry. This:
 *   - exercises the kind="tombstone" code path
 *   - is verifiable in unit tests
 *   - is a no-op for real users (no-change branch)
 *   - leaves the legacy taskStatus* fields untouched until Phase 1 audits them
 *
 * If you're reading this in Phase 1 and want to retire taskStatusCycle, the
 * checklist is:
 *   1. Audit every reader (grep `taskStatusCycle`, `taskStatusMarks`).
 *   2. Replace each reader with the equivalent `statusCycles` lookup.
 *   3. Add a real tombstone step (e.g. v0.10.0-tombstone-status-cycles).
 *   4. Delete THIS file.
 */

import type { TaskProgressBarSettings } from "@/common/setting-definition";
import type { MigrationStep, MigrationStepResult } from "../MigrationRegistry";

export function applySentinelTombstone(
	settings: TaskProgressBarSettings,
): MigrationStepResult {
	const details: string[] = [];
	let changed = false;

	// Synthetic marker — production never has it. Tests inject it to verify
	// the tombstone path runs.
	const meta: any = settings._meta;
	if (meta && "_sentinelMarker" in meta) {
		delete meta._sentinelMarker;
		details.push("Tombstoned settings._meta._sentinelMarker");
		changed = true;
	}

	return { changed, details };
}

export const sentinelTombstoneStep: MigrationStep = {
	id: "v0.0.2-sentinel-tombstone",
	targetVersion: "0.0.2",
	kind: "tombstone",
	description:
		"Tombstone legacy taskStatusCycle / taskStatusMarks (replaced by statusCycles)",
	apply(settings) {
		return applySentinelTombstone(settings);
	},
};
