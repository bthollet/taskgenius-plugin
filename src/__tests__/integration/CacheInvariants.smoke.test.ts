/**
 * Phase 0 W4b — smoke test for the cache invariants checker.
 *
 * This test validates the checker doesn't false-positive on a freshly built
 * orchestrator and correctly reports violations when the cache is in a known
 * inconsistent state. The fuller "checker reports ok at every step of a
 * realistic operation sequence" lives in W5.4 (CacheInvariants.test.ts).
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";
import { checkCacheInvariants } from "@/dataflow/cache/invariants";

describe("checkCacheInvariants smoke (W4b)", () => {
	it("reports ok on a freshly built orchestrator with no cached data", async () => {
		const fx = await buildOrchestrator();
		try {
			const report = await checkCacheInvariants(fx.orchestrator);
			// Empty cache → no raw entries, no augmented entries, no
			// invariants to violate.
			expect(report.ok).toBe(true);
			expect(report.violations).toEqual([]);
			expect(report.stats.rawCount).toBe(0);
			expect(report.stats.augmentedCount).toBe(0);
		} finally {
			await fx.dispose();
		}
	});

	it("flags I1 when a raw entry has no augmented counterpart", async () => {
		const fx = await buildOrchestrator();
		try {
			// Reach into Storage and inject a raw entry without writing the
			// matching augmented entry. This is the canonical "augmentation
			// crashed mid-batch" failure mode.
			const storage: any = (fx.orchestrator as any).storage;
			await storage.storeRaw("ghost.md", [], "content", 1);

			const report = await checkCacheInvariants(fx.orchestrator);
			expect(report.ok).toBe(false);
			expect(report.stats.rawCount).toBe(1);
			expect(report.stats.augmentedCount).toBe(0);
			expect(report.stats.missingAugmented).toBe(1);
			expect(
				report.violations.some(
					(v) => v.id === "I1-missing-augmented",
				),
			).toBe(true);
		} finally {
			await fx.dispose();
		}
	});

	it("does not flag I1 when raw and augmented are in sync", async () => {
		const fx = await buildOrchestrator();
		try {
			const storage: any = (fx.orchestrator as any).storage;
			await storage.storeRaw("a.md", [], "content", 1);
			await storage.storeAugmented("a.md", []);

			const report = await checkCacheInvariants(fx.orchestrator);
			// I1 satisfied. Other invariants may or may not flag depending on
			// indexer state — what matters is missingAugmented === 0.
			expect(report.stats.missingAugmented).toBe(0);
			expect(
				report.violations.some(
					(v) => v.id === "I1-missing-augmented",
				),
			).toBe(false);
		} finally {
			await fx.dispose();
		}
	});

	it("never throws — returns a violation report on internal errors", async () => {
		const fx = await buildOrchestrator();
		try {
			// Sabotage storage so listRawPaths throws. The checker should
			// catch and report, never propagate.
			const storage: any = (fx.orchestrator as any).storage;
			storage.listRawPaths = jest
				.fn()
				.mockRejectedValue(new Error("disk on fire"));

			const report = await checkCacheInvariants(fx.orchestrator);
			expect(report.ok).toBe(false);
			expect(
				report.violations.some((v) => v.id === "list-raw-failed"),
			).toBe(true);
		} finally {
			await fx.dispose();
		}
	});
});
