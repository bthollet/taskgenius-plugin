/**
 * Phase 0 W5.2 — settings change → cache invalidation → re-query.
 *
 * Verifies the contract that subsequent settings consolidation work in
 * Phase 1 will rely on: when a settings change is announced via
 * onSettingsChange (or its typed sibling onSettingsFieldsChanged), the
 * affected cache namespaces are cleared and a subsequent query reflects
 * the new state.
 *
 * This test does NOT exercise rebuild() — that's a separate (slower)
 * concern. It just verifies the cache layer reacts to settings changes
 * the way Phase 1's deprecation work needs.
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";

describe("Orchestrator settings change → cache invalidation (W5.2)", () => {
	it("parser scope clears the raw namespace", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] task one\n" },
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		try {
			// Block rebuild to keep this test fast.
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});

			// Process a file so the raw namespace has content.
			const file = fx.vault.getFileByPath("a.md")!;
			await (fx.orchestrator as any).processFileImmediate(file, true);

			const storage: any = (fx.orchestrator as any).storage;
			const beforeStats = await storage.getStats();
			expect(beforeStats.byNamespace.raw).toBeGreaterThan(0);

			// Trigger a parser-scope settings change.
			await fx.orchestrator.onSettingsChange(["parser"]);

			const afterStats = await storage.getStats();
			expect(afterStats.byNamespace.raw).toBe(0);
		} finally {
			await fx.dispose();
		}
	});

	it("augment scope clears augmented + project namespaces", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one\n" },
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		try {
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});

			const file = fx.vault.getFileByPath("a.md")!;
			await (fx.orchestrator as any).processFileImmediate(file, true);

			const storage: any = (fx.orchestrator as any).storage;
			const before = await storage.getStats();
			expect(before.byNamespace.augmented).toBeGreaterThan(0);

			await fx.orchestrator.onSettingsChange(["augment"]);

			const after = await storage.getStats();
			expect(after.byNamespace.augmented).toBe(0);
			expect(after.byNamespace.project).toBe(0);
		} finally {
			await fx.dispose();
		}
	});

	it("emits SETTINGS_CHANGED event with the scopes payload", async () => {
		const fx = await buildOrchestrator();
		try {
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});

			const events: any[] = [];
			fx.app.workspace.on(
				"task-genius:settings-changed",
				(payload: any) => {
					events.push(payload);
				},
			);

			await fx.orchestrator.onSettingsChange(["parser", "augment"]);

			expect(events.length).toBe(1);
			expect(events[0].scopes).toEqual(["parser", "augment"]);
			expect(typeof events[0].timestamp).toBe("number");
		} finally {
			await fx.dispose();
		}
	});

	it("typed onSettingsFieldsChanged path also clears caches via the legacy delegate", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one\n" },
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		try {
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});

			const file = fx.vault.getFileByPath("a.md")!;
			await (fx.orchestrator as any).processFileImmediate(file, true);

			const storage: any = (fx.orchestrator as any).storage;
			const before = await storage.getStats();
			expect(before.byNamespace.raw).toBeGreaterThan(0);

			// taskStatuses is a parser-scope field per scope-map.ts.
			await fx.orchestrator.onSettingsFieldsChanged(["taskStatuses"]);

			const after = await storage.getStats();
			expect(after.byNamespace.raw).toBe(0);
		} finally {
			await fx.dispose();
		}
	});
});
