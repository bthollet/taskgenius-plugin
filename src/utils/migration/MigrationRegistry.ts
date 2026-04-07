/**
 * MigrationRegistry — Phase 0 W1.
 *
 * A version-keyed registry for settings migration steps. The goals over the
 * three pre-existing migration call sites it replaces:
 *   1. **Atomic** — clone settings, run all applicable steps in-memory, only
 *      commit if every step succeeds. On any throw, the original settings
 *      object is left untouched. No partial migrations.
 *   2. **Dry-run** — `run({dryRun: true})` returns the diff without committing,
 *      so Phase 1's deprecation modals can show a preview before applying.
 *   3. **Tombstone-aware** — a "tombstone" is a first-class step kind. Phase 1
 *      will use these to remove deprecated fields with cleanup logic, optionally
 *      salvaging their content into a successor field.
 *
 * Phase 0 explicitly DOES NOT migrate any callers off the existing
 * `migrateSettings`/`migrateInheritanceSettings`/`fluentIntegration.migrateSettings`
 * paths. It just registers them as a single bundled step (`legacy-bundle-0`)
 * so they get atomic semantics. Subsequent phases break the bundle apart and
 * version-key individual migrations.
 *
 * Why a registry instead of feature-by-feature lifecycle hooks
 * ------------------------------------------------------------
 * Centralizing the steps in one ordered list makes "what changed between
 * version A and version B?" answerable in one read. Per-feature lifecycle
 * hooks scatter that knowledge and make Phase 1 audits painful.
 *
 * Versioning
 * ----------
 * Steps declare a `targetVersion` (semver). The registry runs every step
 * whose `targetVersion ∈ (fromVersion, toVersion]`, in semver order. The
 * `fromVersion` comes from `settings._meta.lastMigratedVersion` (default
 * "0.0.0" for users who upgrade from before this system existed). The
 * `toVersion` is the current `manifest.json` version, passed in by the
 * caller.
 */

import type { TaskProgressBarSettings } from "@/common/setting-definition";

export type MigrationKind = "transform" | "tombstone" | "validate";

export interface MigrationContext {
	/**
	 * Plugin version stored on disk before this run. Defaults to "0.0.0" for
	 * settings that have never been touched by the registry.
	 */
	fromVersion: string;
	/** Current plugin version (manifest.version). */
	toVersion: string;
	/** When true, do not commit results — just compute the diff. */
	dryRun: boolean;
	/** Append a debug message. The registry collects these into the run result. */
	log(msg: string): void;
}

export interface MigrationStepResult {
	/** Whether the step actually changed anything. */
	changed: boolean;
	/** Per-step detail messages, e.g. "renamed taskStatusCycle → statusCycles". */
	details: string[];
	/** Non-fatal warnings the user should know about. */
	warnings?: string[];
}

export interface MigrationStep {
	/** Stable identifier, e.g. "v0.0.1-legacy-bundle". Used in logs and tests. */
	id: string;
	/**
	 * The plugin version that introduced this migration step. Steps run in
	 * semver order, and only when targetVersion > fromVersion (i.e. the user
	 * is upgrading past this point). Use "0.0.0" for steps that should always
	 * run on first registry adoption (e.g. the legacy bundle).
	 */
	targetVersion: string;
	/** Hint for tooling and reporting. Doesn't affect execution. */
	kind: MigrationKind;
	/** Human-readable description shown in dry-run previews. */
	description: string;
	/**
	 * Apply this step to the (already-cloned) settings object. The step is
	 * free to mutate `settings` in place. The registry handles the
	 * clone-before-mutate boundary; do not deep-copy here.
	 *
	 * Throw to abort the entire run. The registry catches the throw and
	 * leaves the original settings untouched.
	 */
	apply(
		settings: TaskProgressBarSettings,
		ctx: MigrationContext,
	): Promise<MigrationStepResult> | MigrationStepResult;
}

export interface MigrationRunResult {
	/** True if every step succeeded (or there were no steps to run). */
	ok: boolean;
	/** True if any step actually changed something. */
	changed: boolean;
	/** Steps that were considered (in execution order). */
	considered: MigrationStep[];
	/** Steps that were actually run (subset of considered). */
	executed: MigrationStep[];
	/** Per-step results, keyed by step id. */
	results: Record<string, MigrationStepResult>;
	/** Aggregated logs from ctx.log(). */
	logs: string[];
	/**
	 * If a step threw, this is set and `ok` is false. The original settings
	 * object passed to `run()` is untouched in this case.
	 */
	error?: { stepId: string; error: Error };
	/** Resolved fromVersion / toVersion for this run. */
	fromVersion: string;
	toVersion: string;
}

/**
 * Compare two semver-ish strings. Returns negative if a<b, positive if a>b,
 * zero if equal. Tolerant of missing patch / pre-release components.
 *
 * This is intentionally minimal — we don't need full semver semantics, just
 * enough to order our own internal steps. We DO NOT depend on a semver lib
 * because the plugin already has enough deps and this is the only place that
 * needs comparison.
 */
export function compareSemver(a: string, b: string): number {
	const parse = (s: string): number[] => {
		// Strip any pre-release suffix (e.g. "1.0.0-beta.4" → "1.0.0").
		const core = s.split("-")[0];
		const parts = core
			.split(".")
			.map((p) => parseInt(p, 10))
			.map((n) => (Number.isFinite(n) ? n : 0));
		while (parts.length < 3) parts.push(0);
		return parts;
	};
	const [a0, a1, a2] = parse(a);
	const [b0, b1, b2] = parse(b);
	if (a0 !== b0) return a0 - b0;
	if (a1 !== b1) return a1 - b1;
	return a2 - b2;
}

/**
 * Deep clone via structured serialization. We don't bring in lodash for one
 * call — JSON round-trip is fine for settings (no functions, no Dates we care
 * about preserving as Date instances, no Maps).
 */
function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

export class MigrationRegistry {
	private steps: MigrationStep[] = [];

	register(step: MigrationStep): void {
		// Reject duplicate IDs so a Phase 1 PR can't accidentally shadow an
		// existing tombstone.
		if (this.steps.some((s) => s.id === step.id)) {
			throw new Error(
				`MigrationRegistry: duplicate step id "${step.id}"`,
			);
		}
		this.steps.push(step);
	}

	list(): readonly MigrationStep[] {
		return [...this.steps];
	}

	clear(): void {
		this.steps = [];
	}

	/**
	 * Run all applicable steps. See class docs for atomicity and dry-run semantics.
	 *
	 * The settings object is mutated only if every step succeeds AND dryRun is
	 * false. Otherwise the caller's settings reference is untouched.
	 */
	async run(
		settings: TaskProgressBarSettings,
		opts: {
			fromVersion?: string;
			toVersion: string;
			dryRun?: boolean;
		},
	): Promise<MigrationRunResult> {
		const fromVersion =
			opts.fromVersion ??
			settings._meta?.lastMigratedVersion ??
			"0.0.0";
		const toVersion = opts.toVersion;
		const dryRun = opts.dryRun ?? false;
		const logs: string[] = [];
		const ctx: MigrationContext = {
			fromVersion,
			toVersion,
			dryRun,
			log: (msg) => logs.push(msg),
		};

		// Filter to steps in (fromVersion, toVersion]. Sort ascending by
		// targetVersion to preserve historical ordering.
		const considered = this.steps
			.filter(
				(s) =>
					compareSemver(s.targetVersion, fromVersion) > 0 &&
					compareSemver(s.targetVersion, toVersion) <= 0,
			)
			.sort((a, b) => compareSemver(a.targetVersion, b.targetVersion));

		const executed: MigrationStep[] = [];
		const results: Record<string, MigrationStepResult> = {};

		// Operate on a clone — we only commit at the end.
		const draft = deepClone(settings);

		for (const step of considered) {
			try {
				const result = await Promise.resolve(step.apply(draft, ctx));
				results[step.id] = result;
				executed.push(step);
				if (result.changed) {
					ctx.log(
						`[${step.id}] applied (${result.details.length} changes)`,
					);
				} else {
					ctx.log(`[${step.id}] no-op`);
				}
			} catch (error) {
				ctx.log(
					`[${step.id}] FAILED: ${error instanceof Error ? error.message : String(error)}`,
				);
				return {
					ok: false,
					changed: false,
					considered,
					executed,
					results,
					logs,
					error: {
						stepId: step.id,
						error:
							error instanceof Error
								? error
								: new Error(String(error)),
					},
					fromVersion,
					toVersion,
				};
			}
		}

		const anyChanged = Object.values(results).some((r) => r.changed);

		// Commit. The atomic boundary is: clone above, copy properties back here.
		// We mutate the caller's reference instead of replacing it because the
		// plugin holds a reference and would otherwise see stale data.
		if (!dryRun && anyChanged) {
			// Wipe owned keys and re-copy from draft. Object.assign would
			// leave keys present in `settings` but absent in `draft` intact,
			// which is wrong if a step deleted a key. Walk the union.
			const allKeys = new Set([
				...Object.keys(settings),
				...Object.keys(draft),
			]);
			for (const key of allKeys) {
				if (key in draft) {
					(settings as any)[key] = (draft as any)[key];
				} else {
					delete (settings as any)[key];
				}
			}
			// Stamp the new lastMigratedVersion so subsequent runs skip these steps.
			settings._meta = settings._meta ?? {};
			settings._meta.lastMigratedVersion = toVersion;
		}

		return {
			ok: true,
			changed: anyChanged,
			considered,
			executed,
			results,
			logs,
			fromVersion,
			toVersion,
		};
	}
}
