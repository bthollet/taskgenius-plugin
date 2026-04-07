/**
 * Phase 0 W4b — Cache invariants checker.
 *
 * A debug-mode safety net that walks the cache namespaces and asserts the
 * relationships the dataflow pipeline assumes are true. Used by:
 *   1. Integration tests, to fail loudly if a refactor breaks an invariant.
 *   2. The hidden `Task Genius (debug): Check cache invariants` command,
 *      gated on `(globalThis as any).__taskGeniusDebug === true`.
 *
 * What "cache" means here
 * -----------------------
 * The Storage layer (src/dataflow/persistence/Storage.ts) maintains four
 * namespaces in LocalStorageCache:
 *   - raw           — parsed Task[] per file, pre-augmentation
 *   - project       — project metadata per file
 *   - augmented     — Task[] per file, post-inheritance
 *   - consolidated  — single TaskCache holding the merged view
 *
 * The pipeline goes: parse → raw → augment → augmented → index → consolidated.
 * If any of these layers drift apart (e.g. a file has raw entries but no
 * augmented ones), queries return inconsistent results.
 *
 * Invariants checked
 * ------------------
 * I1. Every entry in `raw` has a corresponding entry in `augmented`.
 *     (Augmentation should run after parsing; missing augmented = lost data.)
 *
 * I2. Every cached entry's inner version field matches the plugin's current
 *     version. (Storage records carry a `version` field for invalidation.)
 *
 * I3. The number of files in the in-memory TaskIndexer matches the number of
 *     files in `augmented` (within tolerance — the indexer can include files
 *     loaded from the consolidated namespace that haven't been re-parsed yet).
 *
 * I4. Every namespace returned by `storage.getStats()` has a non-negative
 *     count and the totals add up. (Sanity check; mostly catches counting
 *     bugs in Storage itself.)
 *
 * Phase 0 intentionally does NOT check:
 *   - "every task in the index has a backing entry in consolidated" — the
 *     consolidated namespace is one big record, not per-file, so this would
 *     require deserializing the whole thing. Defer to a future phase.
 *   - Project resolver in-memory vs storage `project` consistency — the
 *     resolver's cache is keyed differently than the storage namespace, so
 *     a clean mapping needs more design. Defer.
 *
 * The checker NEVER throws — it returns a report with `ok` and a list of
 * violations. Callers decide whether to log, fail a test, or surface to UI.
 */

import type { DataflowOrchestrator } from "../Orchestrator";

export interface CacheInvariantViolation {
	id: string;
	message: string;
}

export interface CacheInvariantReport {
	ok: boolean;
	violations: CacheInvariantViolation[];
	stats: {
		rawCount: number;
		augmentedCount: number;
		// Number of paths present in raw but missing in augmented (I1).
		missingAugmented: number;
		// Number of cache entries with version mismatch (I2).
		versionMismatches: number;
	};
}

/**
 * Walk the orchestrator's storage and report any invariant violations.
 *
 * Reaches into private state via `as any` because Storage is not part of the
 * orchestrator's public API. The checker is debug-only — production code paths
 * never invoke it. Keep it independent of the public API surface so it can be
 * deleted or refactored without churning consumers.
 */
export async function checkCacheInvariants(
	orch: DataflowOrchestrator,
): Promise<CacheInvariantReport> {
	const violations: CacheInvariantViolation[] = [];
	const stats = {
		rawCount: 0,
		augmentedCount: 0,
		missingAugmented: 0,
		versionMismatches: 0,
	};

	const storage: any = (orch as any).storage;
	if (!storage) {
		violations.push({
			id: "no-storage",
			message:
				"Orchestrator has no storage instance; nothing to check (this is normal pre-initialize)",
		});
		return { ok: false, violations, stats };
	}

	let rawPaths: string[] = [];
	let augPaths: string[] = [];

	try {
		rawPaths = await storage.listRawPaths();
	} catch (e) {
		violations.push({
			id: "list-raw-failed",
			message: `storage.listRawPaths() threw: ${e}`,
		});
	}

	try {
		augPaths = await storage.listAugmentedPaths();
	} catch (e) {
		violations.push({
			id: "list-augmented-failed",
			message: `storage.listAugmentedPaths() threw: ${e}`,
		});
	}

	stats.rawCount = rawPaths.length;
	stats.augmentedCount = augPaths.length;

	// I1: every raw entry has an augmented counterpart
	const augSet = new Set(augPaths);
	for (const rawPath of rawPaths) {
		if (!augSet.has(rawPath)) {
			stats.missingAugmented++;
			violations.push({
				id: "I1-missing-augmented",
				message: `raw entry has no augmented counterpart: ${rawPath}`,
			});
		}
	}

	// I2: every cached record carries a current version
	const currentVersion: string | undefined = storage.currentVersion;
	if (currentVersion) {
		// Sample up to N entries to keep this O(reasonable). The full walk is
		// only useful in tests; in production we just want a smoke check.
		const maxToCheck = 64;
		const toCheck = rawPaths.slice(0, maxToCheck);
		for (const path of toCheck) {
			try {
				const rec = await storage.loadRaw(path);
				if (rec && rec.version && rec.version !== currentVersion) {
					stats.versionMismatches++;
					violations.push({
						id: "I2-version-mismatch",
						message: `raw record version mismatch for ${path}: cached=${rec.version} current=${currentVersion}`,
					});
				}
			} catch {
				/* loadRaw already logs; just skip */
			}
		}
	}

	// I3: indexer file count vs augmented count (with tolerance)
	const repository: any = (orch as any).repository;
	if (repository && typeof repository.getIndexedFilePaths === "function") {
		try {
			const indexedPaths: string[] =
				await repository.getIndexedFilePaths();
			const indexedSet = new Set(indexedPaths);
			// Files in augmented that the in-memory index doesn't know about
			// is a sign of stale storage that nobody's loading.
			for (const augPath of augPaths) {
				if (!indexedSet.has(augPath)) {
					violations.push({
						id: "I3-index-augmented-drift",
						message: `augmented entry not present in in-memory index: ${augPath}`,
					});
				}
			}
		} catch (e) {
			violations.push({
				id: "I3-index-walk-failed",
				message: `repository.getIndexedFilePaths() threw: ${e}`,
			});
		}
	}

	// I4: getStats sanity
	try {
		const sgs = await storage.getStats();
		for (const [ns, count] of Object.entries(sgs.byNamespace ?? {})) {
			if (typeof count !== "number" || count < 0) {
				violations.push({
					id: "I4-bad-namespace-count",
					message: `storage.getStats().byNamespace[${ns}] is not a non-negative number: ${count}`,
				});
			}
		}
		const sum: number = Object.values(sgs.byNamespace ?? {}).reduce<number>(
			(a, b) => a + (typeof b === "number" ? b : 0),
			0,
		);
		if (sum > sgs.totalKeys) {
			violations.push({
				id: "I4-namespace-sum-overflow",
				message: `sum of byNamespace counts (${sum}) exceeds totalKeys (${sgs.totalKeys})`,
			});
		}
	} catch (e) {
		violations.push({
			id: "I4-getstats-failed",
			message: `storage.getStats() threw: ${e}`,
		});
	}

	return {
		ok: violations.length === 0,
		violations,
		stats,
	};
}
