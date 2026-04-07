/**
 * Phase 0 W4b — LocalStorageCache version-mismatch read fix.
 *
 * Prior to W4b, storeFile() tagged entries with `currentVersion` but loadFile()
 * never validated it on read. After an upgrade, every stale entry would be
 * happily returned. This test asserts:
 *  - write at v1.0.0, read at v1.0.0 → returns the entry
 *  - write at v1.0.0, read at v2.0.0 → returns null (treated as cache miss)
 *  - the stale entry is removed from the underlying store on the mismatched read
 */

import { LocalStorageCache } from "@/cache/local-storage-cache";

describe("LocalStorageCache version-mismatch read (W4b)", () => {
	beforeEach(() => {
		// Reset the static "logged once" flag between tests so each test
		// independently exercises the log path.
		(LocalStorageCache as any)._versionMismatchLogged = false;
	});

	it("returns entries written at the same version", async () => {
		const cache = new LocalStorageCache("test-app-1", "1.0.0");
		await cache.storeFile("foo.md", { value: 42 });
		const loaded = await cache.loadFile<{ value: number }>("foo.md");
		expect(loaded).not.toBeNull();
		expect(loaded?.data.value).toBe(42);
		expect(loaded?.version).toBe("1.0.0");
	});

	it("returns null when the cache entry was written at a different version", async () => {
		const oldCache = new LocalStorageCache("test-app-2", "1.0.0");
		await oldCache.storeFile("foo.md", { value: 42 });

		// New cache instance with bumped version pointing at the SAME backing
		// store (the localforage mock keys by `name` which is appId-derived).
		const newCache = new LocalStorageCache("test-app-2", "2.0.0");
		const loaded = await newCache.loadFile("foo.md");
		expect(loaded).toBeNull();
	});

	it("removes the stale entry on a mismatched read", async () => {
		const oldCache = new LocalStorageCache("test-app-3", "1.0.0");
		await oldCache.storeFile("foo.md", { value: 42 });

		const newCache = new LocalStorageCache("test-app-3", "2.0.0");
		// First read: triggers prune
		await newCache.loadFile("foo.md");

		// Second read: should still be a miss (the entry was removed, not just
		// returned null on the fly).
		const persister: any = (newCache as any).persister;
		const raw = await persister.getItem(newCache.fileKey("foo.md"));
		expect(raw).toBeNull();
	});

	it("prunes multiple stale entries on subsequent mismatched reads", async () => {
		// We don't assert log noise because the log-once optimization uses a
		// process-wide static field that's hard to reason about across test
		// boundaries — what matters is that every mismatched read independently
		// returns null and prunes its entry.
		const oldCache = new LocalStorageCache("test-app-4", "1.0.0");
		await oldCache.storeFile("a.md", { v: 1 });
		await oldCache.storeFile("b.md", { v: 2 });
		await oldCache.storeFile("c.md", { v: 3 });

		const newCache = new LocalStorageCache("test-app-4", "2.0.0");
		const a = await newCache.loadFile("a.md");
		const b = await newCache.loadFile("b.md");
		const c = await newCache.loadFile("c.md");

		expect(a).toBeNull();
		expect(b).toBeNull();
		expect(c).toBeNull();

		const persister: any = (newCache as any).persister;
		expect(await persister.getItem(newCache.fileKey("a.md"))).toBeNull();
		expect(await persister.getItem(newCache.fileKey("b.md"))).toBeNull();
		expect(await persister.getItem(newCache.fileKey("c.md"))).toBeNull();
	});
});
