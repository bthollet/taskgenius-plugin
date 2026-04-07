/**
 * legacy-bundle-0 — Phase 0 W1.
 *
 * A single MigrationStep that wraps the three existing migration paths the
 * plugin used before MigrationRegistry existed:
 *
 *  1. `migrateSettings()` from `src/utils/settings-migration.ts`
 *     (legacy multi-cycle status migration: taskStatusCycle → statusCycles)
 *  2. `migrateInheritanceSettings(savedData)` from `src/index.ts`
 *     (projectConfig.metadataConfig → fileMetadataInheritance)
 *  3. `fluentIntegration.migrateSettings()` from FluentIntegration.ts
 *     (initialize default fluentView config)
 *
 * Why a single bundled step?
 * --------------------------
 * Phase 0's contract is "no observable behavior change". The current load path
 * runs all three of these unconditionally on every load. We want to:
 *  (a) get them under registry's atomic try/commit semantics
 *  (b) NOT change ordering, NOT change which fields they touch
 *  (c) avoid teaching the registry about each one's quirks
 *
 * Bundling them as one step is the cleanest path — Phase 1 will progressively
 * split this bundle into version-keyed individual steps as features are
 * touched and audited.
 *
 * targetVersion is "0.0.1" so it runs on FIRST adoption (any settings whose
 * `_meta.lastMigratedVersion` is "0.0.0" — the default for users upgrading
 * from before the registry existed). Subsequent loads see
 * `_meta.lastMigratedVersion >= "0.0.1"` and skip the bundle.
 *
 * Important: this step is PURE in the sense that it doesn't do I/O. The
 * `migrateInheritanceSettings` legacy implementation called `saveSettings`
 * inline, but we don't replicate that — the registry's commit phase handles
 * persistence, and the plugin caller saves after the run. This eliminates a
 * subtle bug where the legacy code triggered an extra save mid-load.
 *
 * The fluentIntegration.migrateSettings() logic is reproduced inline (rather
 * than imported) so the bundle step has no Component dependencies. The
 * inlined logic is byte-equivalent to FluentIntegration.ts:176-205.
 */

import type { TaskProgressBarSettings } from "@/common/setting-definition";
import { migrateToMultiCycle } from "@/utils/settings-migration";
import type { MigrationStep, MigrationStepResult } from "../MigrationRegistry";

/**
 * Apply the bundled legacy migrations.
 *
 * The function is exported separately so legacy-bundle-0.test.ts can run it
 * against fixture data without going through the registry.
 */
export function applyLegacyBundle(
	settings: TaskProgressBarSettings,
	savedData?: any,
): MigrationStepResult {
	const details: string[] = [];
	const warnings: string[] = [];
	let changed = false;

	// --- 1. Multi-cycle status migration (taskStatusCycle → statusCycles) ---
	const beforeCycles = settings.statusCycles?.length ?? 0;
	migrateToMultiCycle(settings);
	const afterCycles = settings.statusCycles?.length ?? 0;
	if (afterCycles > beforeCycles) {
		details.push(
			`Migrated ${afterCycles - beforeCycles} status cycle(s) from legacy taskStatusCycle`,
		);
		changed = true;
	}

	// --- 2. Inheritance settings (projectConfig.metadataConfig → fileMetadataInheritance) ---
	// Pure rewrite of the legacy migrateInheritanceSettings(savedData) function.
	// The legacy version inspected `savedData` (the raw JSON from disk) instead
	// of `settings` because some keys may have been stripped during loadSettings'
	// Object.assign with DEFAULT_SETTINGS. We accept savedData here so callers
	// can preserve that behavior. If savedData is omitted we fall back to settings.
	const sourceConfig = savedData?.projectConfig?.metadataConfig
		? savedData.projectConfig.metadataConfig
		: (settings as any)?.projectConfig?.metadataConfig;

	if (sourceConfig && !settings.fileMetadataInheritance) {
		settings.fileMetadataInheritance = {
			enabled: true,
			inheritFromFrontmatter:
				sourceConfig.inheritFromFrontmatter ?? true,
			inheritFromFrontmatterForSubtasks:
				sourceConfig.inheritFromFrontmatterForSubtasks ?? false,
		};
		// Strip the old keys from projectConfig.metadataConfig — exactly what
		// the legacy code did.
		if (settings.projectConfig?.metadataConfig) {
			delete (settings.projectConfig.metadataConfig as any)
				.inheritFromFrontmatter;
			delete (settings.projectConfig.metadataConfig as any)
				.inheritFromFrontmatterForSubtasks;
		}
		details.push(
			"Migrated projectConfig.metadataConfig.* → fileMetadataInheritance.*",
		);
		changed = true;
	}

	// --- 3. Fluent view defaults (FluentIntegration.migrateSettings inlined) ---
	// Note: this is byte-equivalent to FluentIntegration.ts:176-205 minus the
	// final saveSettings() call (registry handles persistence).
	if (!settings.fluentView) {
		settings.fluentView = { enableFluent: false } as any;
		details.push("Initialized fluentView with default { enableFluent: false }");
		changed = true;
	}
	if (!settings.fluentView!.workspaces) {
		settings.fluentView!.workspaces = [
			{ id: "default", name: "Default", color: "#3498db" },
		] as any;
		details.push("Added default fluentView workspace");
		changed = true;
	}
	if ((settings.fluentView as any).fluentConfig === undefined) {
		(settings.fluentView as any).fluentConfig = {
			enableWorkspaces: true,
			defaultWorkspace: "default",
			maxOtherViewsBeforeOverflow: 5,
		};
		details.push("Initialized default fluentView.fluentConfig");
		changed = true;
	}
	if ((settings.fluentView as any).useWorkspaceSideLeaves === undefined) {
		(settings.fluentView as any).useWorkspaceSideLeaves = false;
		// Cosmetic backfill, don't count as a "real" change so the registry
		// doesn't churn `_meta.lastMigratedVersion` on every load for users
		// who never touched fluent settings.
	}

	return { changed, details, warnings };
}

export const legacyBundleStep: MigrationStep = {
	id: "v0.0.1-legacy-bundle",
	targetVersion: "0.0.1",
	kind: "transform",
	description:
		"Bundled legacy migrations from before MigrationRegistry: multi-cycle status, inheritance, fluent view defaults",
	apply(settings) {
		// The plugin's loadSettings stashes the raw `savedData` (the JSON
		// straight off disk, before the merge with DEFAULT_SETTINGS) on a
		// transient field so this step can detect old projectConfig.metadataConfig.*
		// keys that got dropped by the merge. The transient field is removed
		// by loadSettings after the registry returns.
		const savedData = (settings as any).__transient_savedData__;
		const result = applyLegacyBundle(settings, savedData);
		// Strip the transient field from the registry's working copy so it
		// doesn't end up persisted. (loadSettings also strips it from the
		// caller's reference, but the registry commits via key-by-key copy
		// and would carry over the transient field otherwise.)
		delete (settings as any).__transient_savedData__;
		return result;
	},
};
