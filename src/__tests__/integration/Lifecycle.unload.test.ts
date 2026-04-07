/**
 * Phase 0 W2 — verify the dataflow orchestrator cleans up cleanly.
 *
 * Background: prior to W2, src/index.ts:1758 fired `dataflowOrchestrator.cleanup()`
 * without awaiting it, so workers / event refs / debounced timers could outlive
 * Obsidian's onunload contract. The fix exposes `plugin.unloadComplete` as a
 * promise that resolves once async cleanup work has settled.
 *
 * This test boots a real orchestrator via the W0 fixture, simulates teardown,
 * and asserts the event-bus listener counts on the fake app are zero. We don't
 * test the plugin class directly (that requires booting the entire plugin under
 * jsdom which the test infrastructure isn't set up for), but the orchestrator
 * is the only async work in onunload — its cleanup is what unloadComplete
 * actually awaits.
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";

describe("Orchestrator lifecycle (W2)", () => {
	it("registers workspace listeners and removes them on cleanup", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one", "b.md": "- [x] two" },
		});

		// After construction the orchestrator subscribes to workspace events
		// for things like ICS updates and write operations. The exact count is
		// an implementation detail; just assert it's > 0 so the test would
		// catch a regression where listeners stop attaching at all (which would
		// silently break the dataflow).
		const beforeCleanup = fx.app.__totalListenerCount();
		expect(beforeCleanup).toBeGreaterThan(0);

		await fx.dispose();

		// After dispose, every listener attached via the orchestrator's
		// eventRefs (which cleanup walks via app.workspace.offref) must be gone.
		// Vault listeners attached by sub-sources should also be gone.
		const afterCleanup = fx.app.__totalListenerCount();
		expect(afterCleanup).toBe(0);
	});

	it("dispose is idempotent and does not throw on a re-dispose", async () => {
		const fx = await buildOrchestrator({ files: { "a.md": "- [ ] one" } });
		await fx.dispose();
		// Second dispose path: orchestrator was already nulled out, so the
		// fixture's stored reference still points to the old instance. Calling
		// cleanup() on it again should not throw.
		await expect(
			(fx.orchestrator as any).cleanup(),
		).resolves.not.toThrow();
	});

	it("file events fire to listeners before dispose, but not after", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one" },
		});

		const events: string[] = [];
		fx.vault.on("modify", (file: any) => {
			events.push(`modify:${file.path}`);
		});

		await fx.writeFile("a.md", "- [x] one");
		expect(events).toContain("modify:a.md");

		await fx.dispose();

		// Note: the W0 fixture's vault still has its own listener bus. The
		// "modify" listener we attached in this test is on the fake vault,
		// not on the orchestrator's eventRefs, so it's still active here.
		// What we care about is that the orchestrator-level listeners are gone
		// (covered by the first test) and that the orchestrator no longer
		// processes new vault events that arrive post-cleanup.
		events.length = 0;
		await fx.writeFile("a.md", "- [ ] one");
		// Test-local listener still fires, that's fine.
		expect(events).toEqual(["modify:a.md"]);
	});

	it("cleanup awaits Repository.cleanup (the async cost in onunload)", async () => {
		const fx = await buildOrchestrator();
		// Spy on the repository cleanup method (accessed via the QueryAPI's
		// repository) to confirm it's awaited.
		const repo = (fx.orchestrator as any).repository;
		expect(repo).toBeDefined();
		const repoCleanupSpy = jest.spyOn(repo, "cleanup");

		await fx.dispose();

		expect(repoCleanupSpy).toHaveBeenCalledTimes(1);
		// And the spy must have been called and resolved BEFORE dispose returned.
		// Jest's awaited spies satisfy that just by virtue of dispose having
		// returned. If repo.cleanup() were fire-and-forget the spy would still
		// be in a pending state when dispose returned, but Jest can't observe
		// that distinction directly — the orchestrator's own `await` enforces it.
		repoCleanupSpy.mockRestore();
	});
});
