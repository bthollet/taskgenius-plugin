/**
 * In-memory mock for `localforage` used in jest tests.
 *
 * The real localforage requires a browser IndexedDB or localStorage runtime
 * which jsdom does not reliably provide. This mock implements the minimum
 * surface area used by `src/cache/local-storage-cache.ts`:
 *
 *   localforage.createInstance({name})
 *   localforage.dropInstance({name})
 *   localforage.INDEXEDDB / LOCALSTORAGE / WEBSQL  (driver constants)
 *
 * Each instance backs its data in a Map keyed by `${name}::${key}`. State is
 * shared across instances with the same name (matching real localforage
 * semantics) and persists for the lifetime of the test process.
 *
 * To reset state between tests, call `(localforage as any).__resetAll()`.
 */

const stores = new Map<string, Map<string, any>>();

function getStore(name: string): Map<string, any> {
	let store = stores.get(name);
	if (!store) {
		store = new Map();
		stores.set(name, store);
	}
	return store;
}

interface MockInstanceOptions {
	name: string;
	driver?: any;
	description?: string;
	storeName?: string;
}

function createInstance(options: MockInstanceOptions) {
	const name = options.name;
	const store = getStore(name);

	return {
		__name: name,
		async setItem<T>(key: string, value: T): Promise<T> {
			store.set(key, value);
			return value;
		},
		async getItem<T>(key: string): Promise<T | null> {
			return store.has(key) ? (store.get(key) as T) : null;
		},
		async removeItem(key: string): Promise<void> {
			store.delete(key);
		},
		async clear(): Promise<void> {
			store.clear();
		},
		async length(): Promise<number> {
			return store.size;
		},
		async keys(): Promise<string[]> {
			return [...store.keys()];
		},
		async iterate<T>(
			fn: (value: T, key: string, iterationNumber: number) => any,
		): Promise<void> {
			let i = 0;
			for (const [k, v] of store.entries()) {
				const result = fn(v as T, k, ++i);
				if (result !== undefined) return;
			}
		},
		// localforage instances expose ready() returning a resolved promise.
		async ready(): Promise<void> {},
		// Driver introspection no-ops.
		driver(): string {
			return "MOCK";
		},
		setDriver(): Promise<void> {
			return Promise.resolve();
		},
		// Configuration is a no-op in the mock.
		config(): boolean {
			return true;
		},
	};
}

async function dropInstance(options: { name: string }): Promise<void> {
	stores.delete(options.name);
}

const localforage = {
	createInstance,
	dropInstance,
	// Driver constants — values don't matter, only that they're truthy strings.
	INDEXEDDB: "asyncStorage",
	LOCALSTORAGE: "localStorageWrapper",
	WEBSQL: "webSQLStorage",
	// Module-level shortcuts (rarely used by our code, but localforage exports them).
	async setItem<T>(key: string, value: T): Promise<T> {
		return createInstance({ name: "__default__" }).setItem(key, value);
	},
	async getItem<T>(key: string): Promise<T | null> {
		return createInstance({ name: "__default__" }).getItem<T>(key);
	},
	async removeItem(key: string): Promise<void> {
		return createInstance({ name: "__default__" }).removeItem(key);
	},
	async clear(): Promise<void> {
		return createInstance({ name: "__default__" }).clear();
	},
	// Test helper: clear all instances. NOT part of real localforage.
	__resetAll(): void {
		stores.clear();
	},
	__instanceCount(): number {
		return stores.size;
	},
};

export default localforage;
