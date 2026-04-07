/**
 * Phase 0 W1 — backward compatibility guarantee for legacy-bundle-0.
 *
 * The legacy bundle wraps three migration paths (multi-cycle, inheritance,
 * fluent defaults). For Phase 0 to ship with zero observable behavior change,
 * running the bundle must produce a settings object indistinguishable from
 * running the original three paths directly.
 *
 * These tests parameterize over realistic settings shapes and assert deep
 * equality between:
 *   (a) bundle output: clone settings → applyLegacyBundle → result
 *   (b) direct output: clone settings → migrateToMultiCycle + manual fluent
 *       defaults + manual inheritance migration → result
 *
 * Plus a smoke test that the registry-driven path produces the same final
 * shape (registry overhead doesn't perturb the data).
 */

import { applyLegacyBundle } from "@/utils/migration/steps/legacy-bundle-0";
import { sentinelTombstoneStep } from "@/utils/migration/steps/tombstone-0.0.2-sentinel";
import { createMigrationRegistry } from "@/utils/migration";
import { migrateToMultiCycle } from "@/utils/settings-migration";
import type { TaskProgressBarSettings } from "@/common/setting-definition";

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v));
}

// Minimal direct-path simulation: walk the same logic the legacy bundle wraps,
// without using the bundle. Used as the source of truth for backward-compat.
function applyDirectPath(
	settings: TaskProgressBarSettings,
	savedData?: any,
): TaskProgressBarSettings {
	migrateToMultiCycle(settings);

	// Inheritance migration (mirrors src/index.ts:2000-2028)
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
		if (settings.projectConfig?.metadataConfig) {
			delete (settings.projectConfig.metadataConfig as any)
				.inheritFromFrontmatter;
			delete (settings.projectConfig.metadataConfig as any)
				.inheritFromFrontmatterForSubtasks;
		}
	}

	// Fluent migration (mirrors FluentIntegration.ts:176-205)
	if (!settings.fluentView) {
		settings.fluentView = { enableFluent: false } as any;
	}
	if (!settings.fluentView!.workspaces) {
		settings.fluentView!.workspaces = [
			{ id: "default", name: "Default", color: "#3498db" },
		] as any;
	}
	if ((settings.fluentView as any).fluentConfig === undefined) {
		(settings.fluentView as any).fluentConfig = {
			enableWorkspaces: true,
			defaultWorkspace: "default",
			maxOtherViewsBeforeOverflow: 5,
		};
	}
	if ((settings.fluentView as any).useWorkspaceSideLeaves === undefined) {
		(settings.fluentView as any).useWorkspaceSideLeaves = false;
	}

	return settings;
}

// --- Realistic fixtures ---

// Fixture A: user with legacy multi-cycle config and no fluent settings
const fixtureA = {
	taskStatusCycle: ["Not Started", "In Progress", "Completed"],
	taskStatusMarks: { "Not Started": " ", "In Progress": "/", Completed: "x" },
} as any as TaskProgressBarSettings;

// Fixture B: user with old projectConfig.metadataConfig inheritance
const fixtureB = {
	projectConfig: {
		metadataConfig: {
			inheritFromFrontmatter: true,
			inheritFromFrontmatterForSubtasks: true,
		},
	},
	statusCycles: [
		{
			id: "default",
			name: "Default",
			priority: 0,
			cycle: ["Todo", "Done"],
			marks: { Todo: " ", Done: "x" },
			enabled: true,
		},
	],
} as any as TaskProgressBarSettings;

// Fixture C: fresh install — empty everything
const fixtureC = {} as TaskProgressBarSettings;

// Fixture D: user with fluentView already partially configured (real-world
// case where someone enabled fluent but never touched workspaces)
const fixtureD = {
	fluentView: { enableFluent: true },
} as any as TaskProgressBarSettings;

describe("legacy-bundle-0 backward compatibility (W1)", () => {
	const cases: Array<[string, TaskProgressBarSettings, any?]> = [
		["A: legacy multi-cycle", fixtureA, undefined],
		["B: legacy inheritance + new statusCycles", fixtureB, undefined],
		["C: fresh install", fixtureC, undefined],
		["D: partial fluentView only", fixtureD, undefined],
	];

	for (const [label, fixture] of cases) {
		it(`bundle output matches direct path: ${label}`, () => {
			const viaBundle = clone(fixture);
			applyLegacyBundle(viaBundle);

			const viaDirect = clone(fixture);
			applyDirectPath(viaDirect);

			expect(viaBundle).toEqual(viaDirect);
		});
	}

	it("registry path produces the same shape as the direct bundle call", async () => {
		// Pick one fixture for this end-to-end run.
		const reg = createMigrationRegistry();

		const viaRegistry = clone(fixtureA);
		const result = await reg.run(viaRegistry, { toVersion: "1.0.0" });
		expect(result.ok).toBe(true);

		const viaBundle = clone(fixtureA);
		applyLegacyBundle(viaBundle);

		// Strip the _meta stamp the registry adds — direct path doesn't stamp it.
		const meta = viaRegistry._meta;
		delete viaRegistry._meta;
		expect(viaRegistry).toEqual(viaBundle);

		// Verify the stamp went on
		expect(meta?.lastMigratedVersion).toBe("1.0.0");
	});

	it("bundle is idempotent: running it twice produces the same shape", () => {
		const settings = clone(fixtureA);
		applyLegacyBundle(settings);
		const afterFirst = clone(settings);
		applyLegacyBundle(settings);
		expect(settings).toEqual(afterFirst);
	});
});

describe("sentinel tombstone (W1)", () => {
	it("removes _meta._sentinelMarker when present and reports change", () => {
		const settings = {
			_meta: { _sentinelMarker: "test" },
		} as any as TaskProgressBarSettings;
		const result = sentinelTombstoneStep.apply(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
			dryRun: false,
			log: () => {},
		}) as any;
		expect(result.changed).toBe(true);
		expect((settings._meta as any)?._sentinelMarker).toBeUndefined();
	});

	it("is a no-op when _meta._sentinelMarker is absent", () => {
		const settings = { _meta: {} } as any as TaskProgressBarSettings;
		const result = sentinelTombstoneStep.apply(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
			dryRun: false,
			log: () => {},
		}) as any;
		expect(result.changed).toBe(false);
	});

	it("kind is 'tombstone'", () => {
		expect(sentinelTombstoneStep.kind).toBe("tombstone");
	});

	it("registered in createMigrationRegistry()", () => {
		const reg = createMigrationRegistry();
		expect(
			reg.list().find((s) => s.id === sentinelTombstoneStep.id),
		).toBeDefined();
	});

	it("runs end-to-end via the registry: removes the marker", async () => {
		const reg = createMigrationRegistry();
		const settings = {
			_meta: { _sentinelMarker: "test" },
		} as any as TaskProgressBarSettings;

		const result = await reg.run(settings, { toVersion: "1.0.0" });
		expect(result.ok).toBe(true);
		// The marker is gone
		expect((settings._meta as any)?._sentinelMarker).toBeUndefined();
		// And the migration version was stamped
		expect(settings._meta?.lastMigratedVersion).toBe("1.0.0");
	});
});
