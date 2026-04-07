/**
 * Integration test fixture for booting a real DataflowOrchestrator
 * with mock Obsidian app/vault/metadataCache and a fake plugin instance.
 *
 * Used by Phase 0 stability tests (lifecycle, settings change, worker fallback,
 * cache invariants, migration tombstones). The fixture is intentionally narrow:
 * provide files and settings, get back an orchestrator + dispose.
 *
 * Construction is lazy — workers do not spawn until the orchestrator's
 * `initialize()` is called or a query/process method runs. This means a fixture
 * that only tests cleanup paths can avoid pulling worker construction into the
 * test environment.
 */

import { DataflowOrchestrator } from "@/dataflow/Orchestrator";
import { DEFAULT_SETTINGS } from "@/common/setting-definition";
import type { TaskProgressBarSettings } from "@/common/setting-definition";

export interface VaultFile {
	path: string;
	content: string;
	mtime?: number;
	extension?: string;
}

export interface BuildOrchestratorOptions {
	/** Map of path → file content (or full VaultFile records). */
	files?: Record<string, string> | VaultFile[];
	/** Partial settings overrides merged onto DEFAULT_SETTINGS. */
	settings?: Partial<TaskProgressBarSettings>;
	/** Plugin manifest version. Defaults to "test-1.0.0". */
	version?: string;
	/** Whether to call orchestrator.initialize() after construction. Default false. */
	initialize?: boolean;
}

export interface OrchestratorFixture {
	orchestrator: DataflowOrchestrator;
	plugin: FakePlugin;
	app: FakeApp;
	vault: FakeVault;
	metadataCache: FakeMetadataCache;
	/**
	 * Update the contents of a file and trigger a vault `modify` event.
	 * Returns a promise that resolves once vault listeners have been notified.
	 */
	writeFile(path: string, content: string): Promise<void>;
	/** Delete a file and trigger a vault `delete` event. */
	deleteFile(path: string): Promise<void>;
	/** Create a new file and trigger a vault `create` event. */
	createFile(path: string, content: string): Promise<void>;
	/**
	 * Tear down the orchestrator. Awaits all async cleanup. Tests that need
	 * to assert no leaked timers should wrap the test in jest.useFakeTimers()
	 * and check `jest.getTimerCount() === 0` AFTER dispose returns.
	 */
	dispose(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Minimal fakes — only what Orchestrator and its sub-components actually call.
// ---------------------------------------------------------------------------

class FakeTFile {
	path: string;
	name: string;
	basename: string;
	extension: string;
	stat: { mtime: number; ctime: number; size: number };
	parent: any = null;

	constructor(path: string, content: string, mtime: number = Date.now()) {
		this.path = path;
		const segs = path.split("/");
		this.name = segs[segs.length - 1];
		const dot = this.name.lastIndexOf(".");
		this.basename = dot >= 0 ? this.name.substring(0, dot) : this.name;
		this.extension = dot >= 0 ? this.name.substring(dot + 1) : "";
		this.stat = { mtime, ctime: mtime, size: content.length };
	}
}

class EventBus {
	private handlers = new Map<string, Set<(...args: any[]) => void>>();

	on(name: string, handler: (...args: any[]) => void) {
		if (!this.handlers.has(name)) this.handlers.set(name, new Set());
		this.handlers.get(name)!.add(handler);
		return { name, handler } as any;
	}

	off(name: string, handler: (...args: any[]) => void) {
		this.handlers.get(name)?.delete(handler);
	}

	offref(ref: any) {
		if (ref && ref.name && ref.handler) this.off(ref.name, ref.handler);
	}

	trigger(name: string, ...args: any[]) {
		const set = this.handlers.get(name);
		if (!set) return;
		for (const h of [...set]) {
			try {
				h(...args);
			} catch (e) {
				// Don't let one listener break the others; surface in console for debugging.
				// eslint-disable-next-line no-console
				console.error(`[buildOrchestrator] listener for ${name} threw:`, e);
			}
		}
	}

	clear() {
		this.handlers.clear();
	}

	listenerCount(): number {
		let n = 0;
		for (const s of this.handlers.values()) n += s.size;
		return n;
	}
}

export class FakeVault {
	private fileMap = new Map<string, FakeTFile>();
	private contentMap = new Map<string, string>();
	private bus = new EventBus();
	configDir = ".obsidian";

	constructor(initialFiles?: Record<string, string> | VaultFile[]) {
		if (Array.isArray(initialFiles)) {
			for (const f of initialFiles) this.__seed(f.path, f.content, f.mtime);
		} else if (initialFiles) {
			for (const [path, content] of Object.entries(initialFiles)) {
				this.__seed(path, content);
			}
		}
	}

	__seed(path: string, content: string, mtime?: number): FakeTFile {
		const file = new FakeTFile(path, content, mtime ?? Date.now());
		this.fileMap.set(path, file);
		this.contentMap.set(path, content);
		return file;
	}

	getMarkdownFiles(): FakeTFile[] {
		return [...this.fileMap.values()].filter((f) => f.extension === "md");
	}

	getFiles(): FakeTFile[] {
		return [...this.fileMap.values()];
	}

	getAbstractFileByPath(path: string): FakeTFile | null {
		return this.fileMap.get(path) ?? null;
	}

	getFileByPath(path: string): FakeTFile | null {
		return this.fileMap.get(path) ?? null;
	}

	async read(file: FakeTFile | { path: string }): Promise<string> {
		return this.contentMap.get(file.path) ?? "";
	}

	async cachedRead(file: FakeTFile | { path: string }): Promise<string> {
		return this.contentMap.get(file.path) ?? "";
	}

	async modify(file: FakeTFile | { path: string }, content: string): Promise<void> {
		this.contentMap.set(file.path, content);
		const real = this.fileMap.get(file.path);
		if (real) {
			real.stat.mtime = Date.now();
			real.stat.size = content.length;
			this.bus.trigger("modify", real);
		}
	}

	async create(path: string, content: string): Promise<FakeTFile> {
		const f = this.__seed(path, content);
		this.bus.trigger("create", f);
		return f;
	}

	async delete(file: FakeTFile | { path: string }): Promise<void> {
		const real = this.fileMap.get(file.path);
		this.fileMap.delete(file.path);
		this.contentMap.delete(file.path);
		if (real) this.bus.trigger("delete", real);
	}

	async rename(file: FakeTFile, newPath: string): Promise<void> {
		const oldPath = file.path;
		const content = this.contentMap.get(oldPath) ?? "";
		this.fileMap.delete(oldPath);
		this.contentMap.delete(oldPath);
		const renamed = this.__seed(newPath, content);
		this.bus.trigger("rename", renamed, oldPath);
	}

	on(name: string, handler: (...args: any[]) => void) {
		return this.bus.on(name, handler);
	}

	off(name: string, handler: (...args: any[]) => void) {
		this.bus.off(name, handler);
	}

	offref(ref: any) {
		this.bus.offref(ref);
	}

	trigger(name: string, ...args: any[]) {
		this.bus.trigger(name, ...args);
	}

	getConfig(key: string): any {
		if (key === "tabSize") return 4;
		if (key === "useTab") return false;
		return null;
	}

	__listenerCount(): number {
		return this.bus.listenerCount();
	}

	__bus(): EventBus {
		return this.bus;
	}
}

export class FakeMetadataCache {
	private bus = new EventBus();
	private cache = new Map<string, any>();

	getFileCache(file: { path: string }): any {
		return this.cache.get(file.path) ?? null;
	}

	getCache(path: string): any {
		return this.cache.get(path) ?? null;
	}

	__set(path: string, value: any) {
		this.cache.set(path, value);
	}

	on(name: string, handler: (...args: any[]) => void) {
		return this.bus.on(name, handler);
	}

	off(name: string, handler: (...args: any[]) => void) {
		this.bus.off(name, handler);
	}

	offref(ref: any) {
		this.bus.offref(ref);
	}

	trigger(name: string, ...args: any[]) {
		this.bus.trigger(name, ...args);
	}

	__listenerCount(): number {
		return this.bus.listenerCount();
	}
}

export class FakeApp {
	appId = "test-app-" + Math.random().toString(36).slice(2);
	vault: FakeVault;
	metadataCache: FakeMetadataCache;
	workspace: {
		on: (n: string, h: (...args: any[]) => void) => any;
		off: (n: string, h: (...args: any[]) => void) => void;
		offref: (ref: any) => void;
		trigger: (n: string, ...args: any[]) => void;
		onLayoutReady: (cb: () => void) => void;
		getActiveFile: () => any;
		getLeaf: () => any;
		__bus: EventBus;
		__listenerCount: () => number;
	};
	fileManager = {
		generateMarkdownLink: () => "[[link]]",
	};
	plugins = {
		enabledPlugins: new Set<string>(),
		plugins: {} as Record<string, any>,
	};

	constructor(vault: FakeVault, metadataCache: FakeMetadataCache) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		const bus = new EventBus();
		this.workspace = {
			on: (n, h) => bus.on(n, h),
			off: (n, h) => bus.off(n, h),
			offref: (ref) => bus.offref(ref),
			trigger: (n, ...args) => bus.trigger(n, ...args),
			onLayoutReady: (cb) => cb(),
			getActiveFile: () => null,
			getLeaf: () => ({ openFile: () => {} }),
			__bus: bus,
			__listenerCount: () => bus.listenerCount(),
		};
	}

	__totalListenerCount(): number {
		return (
			this.workspace.__listenerCount() +
			this.vault.__listenerCount() +
			this.metadataCache.__listenerCount()
		);
	}
}

export interface FakePlugin {
	app: FakeApp;
	settings: TaskProgressBarSettings;
	manifest: { id: string; name: string; version: string };
	dataflowOrchestrator?: DataflowOrchestrator;
	getIcsManager(): undefined;
	saveSettings(): Promise<void>;
	registerEvent(ref: any): void;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildOrchestrator(
	opts: BuildOrchestratorOptions = {},
): Promise<OrchestratorFixture> {
	const vault = new FakeVault(opts.files);
	const metadataCache = new FakeMetadataCache();
	const app = new FakeApp(vault, metadataCache);

	const settings: TaskProgressBarSettings = {
		...(DEFAULT_SETTINGS as TaskProgressBarSettings),
		...(opts.settings ?? {}),
	};

	const plugin: FakePlugin = {
		app,
		settings,
		manifest: {
			id: "task-genius-test",
			name: "Task Genius (test)",
			version: opts.version ?? "test-1.0.0",
		},
		getIcsManager: () => undefined,
		saveSettings: async () => {},
		registerEvent: () => {},
	};

	// Construct the real Orchestrator. Heavy sub-components (workers, ICS source
	// retry loop, file source) are constructed lazily by their managers and only
	// fully boot when `initialize()` is called or a parse path runs.
	const orchestrator = new DataflowOrchestrator(
		app as any,
		vault as any,
		metadataCache as any,
		plugin,
	);
	plugin.dataflowOrchestrator = orchestrator;

	if (opts.initialize) {
		await orchestrator.initialize();
	}

	const fx: OrchestratorFixture = {
		orchestrator,
		plugin,
		app,
		vault,
		metadataCache,

		async writeFile(path, content) {
			const existing = vault.getFileByPath(path);
			if (existing) {
				await vault.modify(existing, content);
			} else {
				await vault.create(path, content);
			}
			// Yield to microtasks so any awaiting subscribers progress.
			await Promise.resolve();
		},

		async deleteFile(path) {
			const f = vault.getFileByPath(path);
			if (f) await vault.delete(f);
			await Promise.resolve();
		},

		async createFile(path, content) {
			await vault.create(path, content);
			await Promise.resolve();
		},

		async dispose() {
			try {
				await orchestrator.cleanup();
			} catch (e) {
				// Surface unexpected cleanup errors so tests can react.
				// eslint-disable-next-line no-console
				console.error("[buildOrchestrator.dispose] cleanup threw:", e);
				throw e;
			} finally {
				plugin.dataflowOrchestrator = undefined;
			}
		},
	};

	return fx;
}
