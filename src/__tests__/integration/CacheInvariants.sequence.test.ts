/**
 * Phase 0 W5.4 — Cache invariants hold at every step of a realistic sequence.
 *
 * The smoke test (CacheInvariants.smoke.test.ts) verifies the checker logic
 * itself. This test verifies that the checker doesn't false-positive on
 * normal pipeline operation: a fresh vault, processing several files,
 * modifying some, deleting some, running a settings change. After every step
 * the invariants should hold (modulo I3 indexer-vs-augmented drift, which is
 * expected during transitional states and is documented in invariants.ts).
 *
 * Phase 1 deprecation work that breaks invariants will be caught here.
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";
import { checkCacheInvariants } from "@/dataflow/cache/invariants";

// I3 (indexer ↔ augmented namespace agreement) is informational rather than a
// hard error during transitional states. Filter it out for sequence assertions.
function nonTransientViolations(report: { violations: any[] }) {
	return report.violations.filter(
		(v: any) => v.id !== "I3-index-augmented-drift",
	);
}

describe("CacheInvariants — realistic sequence (W5.4)", () => {
	it("invariants hold across process / modify / delete / settings-change", async () => {
		const fx = await buildOrchestrator({
			files: {
				"a.md": "- [ ] alpha\n",
				"b.md": "- [x] beta\n",
				"c.md": "no tasks\n",
			},
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		try {
			// --- Step 0: fresh orchestrator, nothing in cache yet ---
			let report = await checkCacheInvariants(fx.orchestrator);
			expect(nonTransientViolations(report)).toEqual([]);

			// --- Step 1: process a, b, c ---
			for (const path of ["a.md", "b.md", "c.md"]) {
				const file = fx.vault.getFileByPath(path)!;
				await (fx.orchestrator as any).processFileImmediate(file, true);
			}
			report = await checkCacheInvariants(fx.orchestrator);
			expect(nonTransientViolations(report)).toEqual([]);
			// Both files with tasks should be in raw and augmented
			expect(report.stats.rawCount).toBeGreaterThanOrEqual(2);
			expect(report.stats.augmentedCount).toBeGreaterThanOrEqual(2);
			expect(report.stats.missingAugmented).toBe(0);

			// --- Step 2: modify a ---
			const fileA = fx.vault.getFileByPath("a.md")!;
			await fx.vault.modify(fileA, "- [ ] alpha\n- [ ] alpha2\n");
			await (fx.orchestrator as any).processFileImmediate(fileA, true);
			report = await checkCacheInvariants(fx.orchestrator);
			expect(nonTransientViolations(report)).toEqual([]);

			// --- Step 3: delete b ---
			const repo: any = (fx.orchestrator as any).repository;
			await repo.removeFile("b.md");
			report = await checkCacheInvariants(fx.orchestrator);
			expect(nonTransientViolations(report)).toEqual([]);

			// --- Step 4: settings change (parser scope) — clears raw namespace ---
			// Block rebuild so we don't reprocess everything in this test.
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});
			await fx.orchestrator.onSettingsChange(["parser"]);
			report = await checkCacheInvariants(fx.orchestrator);
			// After clearing raw, augmented entries become orphans relative to
			// raw. Our I1 invariant says "every raw has augmented" — that's
			// still trivially true (zero raws). The reverse isn't asserted by
			// I1, so this is fine.
			expect(nonTransientViolations(report)).toEqual([]);
			expect(report.stats.rawCount).toBe(0);
		} finally {
			await fx.dispose();
		}
	});

	it("invariants hold immediately after dispose has been called", async () => {
		// Belt and braces: we shouldn't be able to even call the checker after
		// dispose without it crashing. (It might return errors, but no throws.)
		const fx = await buildOrchestrator({ files: { "a.md": "- [ ] x\n" } });
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		const file = fx.vault.getFileByPath("a.md")!;
		await (fx.orchestrator as any).processFileImmediate(file, true);

		await fx.dispose();

		// After dispose, storage may still be reachable but the orchestrator's
		// other dependencies (e.g. workspaceManager event refs) are gone.
		// The checker should still complete without throwing.
		const report = await checkCacheInvariants(fx.orchestrator);
		// We don't assert ok=true here; just that the call returns a structured
		// report rather than throwing.
		expect(report).toBeDefined();
		expect(Array.isArray(report.violations)).toBe(true);
	});
});
