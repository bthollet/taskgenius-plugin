/**
 * Smoke test for the buildOrchestrator fixture itself.
 *
 * This is W0 in the v10 Phase 0 plan: prove the fixture constructs a real
 * DataflowOrchestrator with mock dependencies, exposes the documented API,
 * and disposes cleanly. Subsequent integration tests (W5) build on top.
 *
 * This is intentionally NOT a test of orchestrator behavior — just plumbing.
 */

import { buildOrchestrator } from "./buildOrchestrator";
import { InMemoryStorage } from "./inMemoryStorage";

describe("buildOrchestrator fixture (W0 smoke)", () => {
	it("constructs an orchestrator with no files", async () => {
		const fx = await buildOrchestrator();
		try {
			expect(fx.orchestrator).toBeDefined();
			expect(fx.plugin).toBeDefined();
			expect(fx.plugin.dataflowOrchestrator).toBe(fx.orchestrator);
			expect(fx.app.appId).toMatch(/^test-app-/);
			expect(fx.vault.getMarkdownFiles()).toHaveLength(0);
		} finally {
			await fx.dispose();
		}
	});

	it("seeds vault files from the files option", async () => {
		const fx = await buildOrchestrator({
			files: {
				"notes/a.md": "- [ ] task one #x",
				"notes/b.md": "- [x] task two",
				"notes/c.txt": "not markdown",
			},
		});
		try {
			const md = fx.vault.getMarkdownFiles();
			expect(md.map((f) => f.path).sort()).toEqual([
				"notes/a.md",
				"notes/b.md",
			]);
			expect(await fx.vault.read({ path: "notes/a.md" })).toBe(
				"- [ ] task one #x",
			);
		} finally {
			await fx.dispose();
		}
	});

	it("merges settings overrides onto DEFAULT_SETTINGS", async () => {
		const fx = await buildOrchestrator({
			settings: { preferMetadataFormat: "dataview" },
		});
		try {
			expect(fx.plugin.settings.preferMetadataFormat).toBe("dataview");
			// Other defaults still present
			expect(fx.plugin.settings.taskStatuses).toBeDefined();
		} finally {
			await fx.dispose();
		}
	});

	it("writeFile triggers vault modify event", async () => {
		const fx = await buildOrchestrator({
			files: { "a.md": "- [ ] one" },
		});
		try {
			const events: string[] = [];
			fx.vault.on("modify", (file: any) => {
				events.push(`modify:${file.path}`);
			});
			await fx.writeFile("a.md", "- [x] one");
			expect(events).toEqual(["modify:a.md"]);
			expect(await fx.vault.read({ path: "a.md" })).toBe("- [x] one");
		} finally {
			await fx.dispose();
		}
	});

	it("createFile triggers vault create event", async () => {
		const fx = await buildOrchestrator();
		try {
			const events: string[] = [];
			fx.vault.on("create", (file: any) => {
				events.push(`create:${file.path}`);
			});
			await fx.createFile("new.md", "- [ ] new");
			expect(events).toEqual(["create:new.md"]);
		} finally {
			await fx.dispose();
		}
	});

	it("deleteFile triggers vault delete event", async () => {
		const fx = await buildOrchestrator({ files: { "doomed.md": "x" } });
		try {
			const events: string[] = [];
			fx.vault.on("delete", (file: any) => {
				events.push(`delete:${file.path}`);
			});
			await fx.deleteFile("doomed.md");
			expect(events).toEqual(["delete:doomed.md"]);
			expect(fx.vault.getFileByPath("doomed.md")).toBeNull();
		} finally {
			await fx.dispose();
		}
	});

	it("dispose calls orchestrator.cleanup() and does not throw", async () => {
		const fx = await buildOrchestrator();
		// Spy on orchestrator.cleanup to make sure dispose actually invokes it.
		const spy = jest.spyOn(fx.orchestrator, "cleanup");
		await fx.dispose();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(fx.plugin.dataflowOrchestrator).toBeUndefined();
		spy.mockRestore();
	});

	it("can call dispose without files or initialization", async () => {
		const fx = await buildOrchestrator();
		await expect(fx.dispose()).resolves.not.toThrow();
	});
});

describe("InMemoryStorage (W0)", () => {
	it("stores and retrieves raw records", async () => {
		const s = new InMemoryStorage();
		await s.storeRaw("a.md", [], "content", 100);
		const r = await s.loadRaw("a.md");
		expect(r).not.toBeNull();
		expect(r?.mtime).toBe(100);
		expect(r?.data).toEqual([]);
	});

	it("clearNamespace only clears matching prefix", async () => {
		const s = new InMemoryStorage();
		await s.storeRaw("a.md", []);
		await s.storeAugmented("a.md", []);
		await s.storeProject("a.md", { enhancedMetadata: {} });
		const before = await s.getStats();
		expect(before.byNamespace.raw).toBe(1);
		expect(before.byNamespace.augmented).toBe(1);
		expect(before.byNamespace.project).toBe(1);

		await s.clearNamespace("raw");
		const after = await s.getStats();
		expect(after.byNamespace.raw).toBe(0);
		expect(after.byNamespace.augmented).toBe(1);
		expect(after.byNamespace.project).toBe(1);
	});

	it("version mismatch on read invalidates the record", async () => {
		const s = new InMemoryStorage("1.0.0");
		await s.storeRaw("a.md", []);
		expect(await s.loadRaw("a.md")).not.toBeNull();
		s.__setVersion("2.0.0");
		expect(await s.loadRaw("a.md")).toBeNull();
	});

	it("meta save/load round-trips", async () => {
		const s = new InMemoryStorage();
		await s.saveMeta("k", { foo: 1 });
		expect(await s.loadMeta("k")).toEqual({ foo: 1 });
	});
});
