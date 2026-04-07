/**
 * Phase 0 W5.1 — Orchestrator end-to-end roundtrip.
 *
 * The vital-signs test for the dataflow pipeline. Exercises:
 *   parse → augment → store raw → store augmented → store project → query → modify
 *   → re-parse → re-query → delete → re-query
 *
 * Workers are forced off so parsing routes through main-thread fallback
 * (ConfigurableTaskParser) — the worker mock doesn't return TaskParseResult
 * shapes. The test isn't validating worker behavior, it's validating that
 * a task added to a file ends up in the index and a task removed from a
 * file disappears from the index.
 *
 * Scope notes: this test directly invokes the orchestrator's private
 * `processFileImmediate` to bypass the 300ms debounce in `processFile`.
 * That's the canonical pattern for fast roundtrip tests; the debounce is
 * a UI affordance, not a correctness boundary.
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";

describe("Orchestrator roundtrip (W5.1)", () => {
	it("parses, indexes, and queries tasks from a markdown file", async () => {
		const fx = await buildOrchestrator({
			files: {
				"notes/a.md": "- [ ] task one\n- [x] task two\n",
			},
		});

		// Force main-thread parsing — we don't want the worker mock involved.
		const workerOrchestrator: any = (fx.orchestrator as any)
			.workerOrchestrator;
		workerOrchestrator.setWorkersEnabled(false);

		try {
			const file = fx.vault.getFileByPath("notes/a.md");
			expect(file).not.toBeNull();

			// Process the file directly (bypass debounce)
			await (fx.orchestrator as any).processFileImmediate(file, true);

			// Query through the public QueryAPI
			const queryAPI = fx.orchestrator.getQueryAPI();
			const tasks = await queryAPI.getAllTasks();

			// We expect at least the two tasks we wrote. The exact shape comes
			// from ConfigurableTaskParser; we only assert the count and contents.
			const inFile = tasks.filter((t: any) => t.filePath === "notes/a.md");
			expect(inFile.length).toBe(2);
			const contents = inFile.map((t: any) => t.content).sort();
			expect(contents).toEqual(["task one", "task two"].sort());
			// One completed, one not
			const completedFlags = inFile.map((t: any) => t.completed).sort();
			expect(completedFlags).toEqual([false, true]);
		} finally {
			await fx.dispose();
		}
	});

	it("reflects file modifications in the next query", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one\n" },
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		try {
			const file = fx.vault.getFileByPath("a.md")!;
			await (fx.orchestrator as any).processFileImmediate(file, true);

			let tasks = await fx.orchestrator.getQueryAPI().getAllTasks();
			expect(tasks.filter((t: any) => t.filePath === "a.md").length).toBe(
				1,
			);

			// Modify the file: add a second task
			await fx.vault.modify(file, "- [ ] one\n- [ ] two\n");
			// Re-process directly (forceInvalidate=true to bypass mtime cache)
			await (fx.orchestrator as any).processFileImmediate(file, true);

			tasks = await fx.orchestrator.getQueryAPI().getAllTasks();
			const inFile = tasks.filter((t: any) => t.filePath === "a.md");
			expect(inFile.length).toBe(2);
		} finally {
			await fx.dispose();
		}
	});

	it("removes tasks from the index when a file is deleted", async () => {
		const fx = await buildOrchestrator({
			files: { "doomed.md": "- [ ] gone\n" },
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		try {
			const file = fx.vault.getFileByPath("doomed.md")!;
			await (fx.orchestrator as any).processFileImmediate(file, true);

			let tasks = await fx.orchestrator.getQueryAPI().getAllTasks();
			expect(
				tasks.filter((t: any) => t.filePath === "doomed.md").length,
			).toBe(1);

			// Delete via repository.removeFile (the public API the FILE_UPDATED
			// "delete" event handler uses internally).
			const repo: any = (fx.orchestrator as any).repository;
			await repo.removeFile("doomed.md");

			tasks = await fx.orchestrator.getQueryAPI().getAllTasks();
			expect(
				tasks.filter((t: any) => t.filePath === "doomed.md").length,
			).toBe(0);
		} finally {
			await fx.dispose();
		}
	});

	it("dispose releases all listeners after a roundtrip", async () => {
		const fx = await buildOrchestrator({
			files: {
				"a.md": "- [ ] one\n",
				"b.md": "- [x] two\n",
				"c.md": "no tasks here\n",
			},
		});
		(fx.orchestrator as any).workerOrchestrator.setWorkersEnabled(false);

		const fileA = fx.vault.getFileByPath("a.md")!;
		const fileB = fx.vault.getFileByPath("b.md")!;
		await (fx.orchestrator as any).processFileImmediate(fileA, true);
		await (fx.orchestrator as any).processFileImmediate(fileB, true);

		const beforeDispose = fx.app.__totalListenerCount();
		expect(beforeDispose).toBeGreaterThan(0);

		await fx.dispose();

		// All event-bus listeners that the orchestrator/sources/indexer
		// attached should be gone.
		expect(fx.app.__totalListenerCount()).toBe(0);
	});
});
