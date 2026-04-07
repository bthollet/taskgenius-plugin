/**
 * Phase 0 W2-bis — verify that a failed rebuild doesn't leave a partial cache.
 *
 * The fix in src/dataflow/Orchestrator.ts wraps rebuild() in try/catch. On any
 * thrown error, every cache namespace is cleared so the next plugin load
 * triggers a clean rebuild from disk instead of trusting a partial cache.
 *
 * The test injects a failure into processBatch (the most realistic failure
 * point) by spying on the orchestrator method, then asserts:
 *  - rebuild() rejects with the original error
 *  - storage.clearNamespace was called for all 4 namespaces
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";

describe("Orchestrator.rebuild failure handling (W2-bis)", () => {
	it("clears all cache namespaces on rebuild failure and re-throws", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one", "b.md": "- [x] two" },
		});

		// Reach into the orchestrator's storage to spy on namespace clears.
		const storage = (fx.orchestrator as any).storage;
		expect(storage).toBeDefined();
		const clearSpy = jest.spyOn(storage, "clearNamespace");

		// Inject a failure: replace processBatch with a thrower. This is the
		// most realistic failure mode (a worker error, a vault read error,
		// or a parse error mid-batch).
		const boom = new Error("simulated worker crash");
		(fx.orchestrator as any).processBatch = jest.fn(async () => {
			throw boom;
		});

		await expect(fx.orchestrator.rebuild()).rejects.toBe(boom);

		// All four namespaces must have been cleared as the last-resort path.
		const clearedNamespaces = clearSpy.mock.calls.map(
			(call: any[]) => call[0],
		);
		expect(clearedNamespaces).toEqual(
			expect.arrayContaining(["raw", "augmented", "project", "consolidated"]),
		);

		clearSpy.mockRestore();
		await fx.dispose();
	});

	it("does not clear namespaces on a successful rebuild", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one" },
		});

		const storage = (fx.orchestrator as any).storage;
		const clearSpy = jest.spyOn(storage, "clearNamespace");

		// processBatch is the slow path; replace with a no-op so rebuild
		// completes quickly without exercising worker plumbing.
		(fx.orchestrator as any).processBatch = jest.fn(async () => {});

		await expect(fx.orchestrator.rebuild()).resolves.toBeUndefined();

		// On success, the catch branch should NOT have run, so clearNamespace
		// should not have been called from rebuild's catch handler. Note: if
		// repository.clear() internally calls clearNamespace, this assertion
		// would fail; our implementation calls repository.clear() (a different
		// path), not storage.clearNamespace, so this is safe.
		expect(clearSpy).not.toHaveBeenCalled();

		clearSpy.mockRestore();
		await fx.dispose();
	});

	it("re-throws even when last-resort cleanup itself fails", async () => {
		const fx = await buildOrchestrator({ files: { "a.md": "- [ ] one" } });

		const storage = (fx.orchestrator as any).storage;
		// Make every clearNamespace call fail. The catch-of-catch path should
		// still re-throw the original error.
		jest.spyOn(storage, "clearNamespace").mockRejectedValue(
			new Error("storage is on fire"),
		);

		const boom = new Error("primary failure");
		(fx.orchestrator as any).processBatch = jest.fn(async () => {
			throw boom;
		});

		await expect(fx.orchestrator.rebuild()).rejects.toBe(boom);

		await fx.dispose();
	});
});
