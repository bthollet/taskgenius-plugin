/**
 * Phase 0 W1 — MigrationRegistry unit tests.
 *
 * Covers:
 *   - ordering by targetVersion
 *   - version filtering (skip steps with targetVersion <= fromVersion)
 *   - atomicity (one step throws → settings untouched, error reported)
 *   - dry-run (no commit)
 *   - tombstone kind metadata
 *   - duplicate id rejection
 *   - _meta.lastMigratedVersion stamping on success
 */

import {
	MigrationRegistry,
	compareSemver,
	type MigrationStep,
} from "@/utils/migration";
import type { TaskProgressBarSettings } from "@/common/setting-definition";

function makeStep(
	id: string,
	targetVersion: string,
	apply: MigrationStep["apply"],
	kind: MigrationStep["kind"] = "transform",
): MigrationStep {
	return {
		id,
		targetVersion,
		kind,
		description: `synthetic ${id}`,
		apply,
	};
}

// Build a minimal settings object — only the fields the registry / steps touch.
function makeSettings(extras: Partial<TaskProgressBarSettings> = {}): TaskProgressBarSettings {
	return {
		// Required default fields are filled in only as needed; we cast to make
		// the type system happy without dragging in DEFAULT_SETTINGS.
		...({} as TaskProgressBarSettings),
		...extras,
	};
}

describe("compareSemver (W1)", () => {
	it("orders major.minor.patch correctly", () => {
		expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
		expect(compareSemver("1.0.0", "1.0.1")).toBeLessThan(0);
		expect(compareSemver("1.0.1", "1.0.0")).toBeGreaterThan(0);
		expect(compareSemver("0.9.9", "1.0.0")).toBeLessThan(0);
		expect(compareSemver("2.0.0", "1.99.99")).toBeGreaterThan(0);
	});

	it("ignores pre-release suffix", () => {
		expect(compareSemver("1.0.0-beta.1", "1.0.0")).toBe(0);
		expect(compareSemver("9.14.0-beta.4", "9.14.0")).toBe(0);
	});

	it("treats missing components as zero", () => {
		expect(compareSemver("1", "1.0.0")).toBe(0);
		expect(compareSemver("1.5", "1.5.0")).toBe(0);
		expect(compareSemver("1.5", "1.4.9")).toBeGreaterThan(0);
	});
});

describe("MigrationRegistry (W1)", () => {
	it("rejects duplicate step ids", () => {
		const reg = new MigrationRegistry();
		reg.register(makeStep("dup", "0.0.1", () => ({ changed: false, details: [] })));
		expect(() =>
			reg.register(
				makeStep("dup", "0.0.2", () => ({ changed: false, details: [] })),
			),
		).toThrow(/duplicate step id/);
	});

	it("runs steps in semver order regardless of registration order", async () => {
		const reg = new MigrationRegistry();
		const order: string[] = [];
		reg.register(
			makeStep("c", "0.0.3", () => {
				order.push("c");
				return { changed: false, details: [] };
			}),
		);
		reg.register(
			makeStep("a", "0.0.1", () => {
				order.push("a");
				return { changed: false, details: [] };
			}),
		);
		reg.register(
			makeStep("b", "0.0.2", () => {
				order.push("b");
				return { changed: false, details: [] };
			}),
		);

		const settings = makeSettings();
		await reg.run(settings, { fromVersion: "0.0.0", toVersion: "0.0.5" });
		expect(order).toEqual(["a", "b", "c"]);
	});

	it("skips steps whose targetVersion is <= fromVersion", async () => {
		const reg = new MigrationRegistry();
		const ran: string[] = [];
		reg.register(
			makeStep("a", "0.0.1", () => {
				ran.push("a");
				return { changed: false, details: [] };
			}),
		);
		reg.register(
			makeStep("b", "0.0.2", () => {
				ran.push("b");
				return { changed: false, details: [] };
			}),
		);
		reg.register(
			makeStep("c", "0.0.3", () => {
				ran.push("c");
				return { changed: false, details: [] };
			}),
		);

		// from=0.0.2 means a (0.0.1) and b (0.0.2) should NOT run, only c (0.0.3).
		await reg.run(makeSettings(), {
			fromVersion: "0.0.2",
			toVersion: "0.0.5",
		});
		expect(ran).toEqual(["c"]);
	});

	it("skips steps whose targetVersion exceeds toVersion", async () => {
		const reg = new MigrationRegistry();
		const ran: string[] = [];
		reg.register(
			makeStep("future", "9.9.9", () => {
				ran.push("future");
				return { changed: true, details: ["should not run"] };
			}),
		);
		reg.register(
			makeStep("current", "0.0.5", () => {
				ran.push("current");
				return { changed: true, details: ["did run"] };
			}),
		);

		await reg.run(makeSettings(), {
			fromVersion: "0.0.0",
			toVersion: "1.0.0",
		});
		expect(ran).toEqual(["current"]);
	});

	it("commits changes from steps when ok and not dry-run", async () => {
		const reg = new MigrationRegistry();
		reg.register(
			makeStep("set-name", "0.0.1", (settings: any) => {
				settings.testField = "added by migration";
				return { changed: true, details: ["set testField"] };
			}),
		);

		const settings = makeSettings() as any;
		expect(settings.testField).toBeUndefined();

		const result = await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
		});

		expect(result.ok).toBe(true);
		expect(result.changed).toBe(true);
		expect(settings.testField).toBe("added by migration");
		// _meta should be stamped
		expect(settings._meta?.lastMigratedVersion).toBe("0.0.5");
	});

	it("dryRun does NOT commit changes", async () => {
		const reg = new MigrationRegistry();
		reg.register(
			makeStep("set-name", "0.0.1", (settings: any) => {
				settings.testField = "added by migration";
				return { changed: true, details: ["set testField"] };
			}),
		);

		const settings = makeSettings() as any;
		const result = await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
			dryRun: true,
		});

		expect(result.ok).toBe(true);
		expect(result.changed).toBe(true);
		// But the actual settings object is untouched
		expect(settings.testField).toBeUndefined();
		expect(settings._meta).toBeUndefined();
		// And the per-step results still report the change
		expect(result.results["set-name"].changed).toBe(true);
	});

	it("is atomic: a failing step leaves settings untouched and reports the error", async () => {
		const reg = new MigrationRegistry();
		reg.register(
			makeStep("ok", "0.0.1", (settings: any) => {
				settings.firstField = "ok ran";
				return { changed: true, details: ["set firstField"] };
			}),
		);
		reg.register(
			makeStep("boom", "0.0.2", () => {
				throw new Error("intentional");
			}),
		);
		reg.register(
			makeStep("never", "0.0.3", (settings: any) => {
				settings.shouldNeverRun = true;
				return { changed: true, details: [] };
			}),
		);

		const settings = makeSettings() as any;
		const result = await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
		});

		expect(result.ok).toBe(false);
		expect(result.error?.stepId).toBe("boom");
		expect(result.error?.error.message).toBe("intentional");
		// Original settings untouched — even the successful step's mutation
		// did NOT commit, because the run as a whole failed.
		expect(settings.firstField).toBeUndefined();
		expect(settings.shouldNeverRun).toBeUndefined();
		expect(settings._meta).toBeUndefined();
		// Executed list reflects what we tried before the failure.
		expect(result.executed.map((s) => s.id)).toEqual(["ok"]);
	});

	it("does NOT stamp _meta when no steps changed anything", async () => {
		const reg = new MigrationRegistry();
		reg.register(
			makeStep("noop", "0.0.1", () => ({ changed: false, details: [] })),
		);

		const settings = makeSettings() as any;
		const result = await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
		});

		expect(result.ok).toBe(true);
		expect(result.changed).toBe(false);
		expect(settings._meta).toBeUndefined();
	});

	it("preserves tombstone kind metadata in step list and results", async () => {
		const reg = new MigrationRegistry();
		const tombstone = makeStep(
			"v0.0.2-test-tombstone",
			"0.0.2",
			(settings: any) => {
				if ("legacyField" in settings) {
					delete settings.legacyField;
					return {
						changed: true,
						details: ["removed legacyField"],
					};
				}
				return { changed: false, details: [] };
			},
			"tombstone",
		);
		reg.register(tombstone);

		const settings = makeSettings({ ...({ legacyField: 42 } as any) }) as any;
		const result = await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
		});

		expect(result.ok).toBe(true);
		expect(settings.legacyField).toBeUndefined();
		expect(reg.list().find((s) => s.id === "v0.0.2-test-tombstone")?.kind).toBe(
			"tombstone",
		);
	});

	it("supports async apply functions", async () => {
		const reg = new MigrationRegistry();
		reg.register(
			makeStep("async", "0.0.1", async (settings: any) => {
				await new Promise((r) => setTimeout(r, 5));
				settings.asyncRan = true;
				return { changed: true, details: ["async ok"] };
			}),
		);

		const settings = makeSettings() as any;
		await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
		});
		expect(settings.asyncRan).toBe(true);
	});

	it("removes deleted keys from the committed settings (not just adds)", async () => {
		const reg = new MigrationRegistry();
		reg.register(
			makeStep("delete-key", "0.0.1", (settings: any) => {
				delete settings.toBeRemoved;
				return { changed: true, details: ["removed toBeRemoved"] };
			}),
		);

		const settings = { toBeRemoved: "x" } as any;
		await reg.run(settings, {
			fromVersion: "0.0.0",
			toVersion: "0.0.5",
		});
		expect("toBeRemoved" in settings).toBe(false);
	});
});
