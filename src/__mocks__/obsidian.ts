// Mock for Obsidian API

// Simple mock function implementation
function mockFn() {
	const fn = function () {
		return fn;
	};
	return fn;
}

export class App {
	vault = {
		getMarkdownFiles: function () {
			return [];
		},
		read: function () {
			return Promise.resolve("");
		},
		create: function () {
			return Promise.resolve({});
		},
		modify: function () {
			return Promise.resolve({});
		},
		getConfig: function (key: string) {
			if (key === "tabSize") return 4;
			if (key === "useTab") return false;
			return null;
		},
		// Event system for vault
		_events: {} as Record<string, Function[]>,
		on: function (eventName: string, callback: Function) {
			if (!this._events[eventName]) {
				this._events[eventName] = [];
			}
			this._events[eventName].push(callback);
			return { unload: () => this.off(eventName, callback) };
		},
		off: function (eventName: string, callback: Function) {
			if (this._events[eventName]) {
				const index = this._events[eventName].indexOf(callback);
				if (index > -1) {
					this._events[eventName].splice(index, 1);
				}
			}
		},
		trigger: function (eventName: string, ...args: any[]) {
			if (this._events[eventName]) {
				this._events[eventName].forEach((callback: any) => callback(...args));
			}
		},
		getFileByPath: function (path: string) {
			// Mock implementation for getFileByPath
			return {
				path: path,
				name: path.split('/').pop() || path,
				children: [], // For directory-like behavior
			};
		},
	};

	workspace = {
		getLeaf: function () {
			return {
				openFile: function () {},
			};
		},

		getActiveFile: function () {
			return {
				path: "mockFile.md",
				// Add other TFile properties if necessary for the tests
				name: "mockFile.md",
				basename: "mockFile",
				extension: "md",
			};
		},

		onLayoutReady: function (callback: () => void) {
			if (typeof callback === "function") {
				callback();
			}
		},
	};

	fileManager = {
		generateMarkdownLink: function () {
			return "[[link]]";
		},
	};

	metadataCache = {
		getFileCache: function () {
			return {
				headings: [],
			};
		},
	};

	plugins = {
		enabledPlugins: new Set(["obsidian-tasks-plugin"]),
		plugins: {
			"obsidian-tasks-plugin": {
				api: {
					getTasksFromFile: () => [],
					getTaskAtLine: () => null,
					updateTask: () => {},
				},
			},
		},
	};
}

export class Editor {
	getValue = function () {
		return "";
	};
	setValue = function () {};
	replaceRange = function () {};
	getLine = function () {
		return "";
	};
	lineCount = function () {
		return 0;
	};
	getCursor = function () {
		return { line: 0, ch: 0 };
	};
	setCursor = function () {};
	getSelection = function () {
		return "";
	};
}

export class TFile {
	path: string;
	name: string;
	parent: any;

	constructor(path = "", name = "", parent = null) {
		this.path = path;
		this.name = name;
		this.parent = parent;
	}
}

export class Notice {
	constructor(message: string) {
		// Mock implementation
	}
}

export class MarkdownView {
	editor: Editor;
	file: TFile;

	constructor() {
		this.editor = new Editor();
		this.file = new TFile();
	}
}

export class MarkdownFileInfo {
	file: TFile;

	constructor() {
		this.file = new TFile();
	}
}

export class FuzzySuggestModal<T> {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	open() {}
	close() {}
	setPlaceholder() {}
	getItems() {
		return [];
	}
	getItemText() {
		return "";
	}
	renderSuggestion() {}
	onChooseItem() {}
	getSuggestions() {
		return [];
	}
}

export class SuggestModal<T> {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	open() {}
	close() {}
	setPlaceholder() {}
	getSuggestions() {
		return Promise.resolve([]);
	}
	renderSuggestion() {}
	onChooseSuggestion() {}
}

export class MetadataCache {
	getFileCache() {
		return null;
	}
}

export class FuzzyMatch<T> {
	item: T;
	match: { score: number; matches: any[] };

	constructor(item: T) {
		this.item = item;
		this.match = { score: 0, matches: [] };
	}
}

// Mock moment function and its methods
function momentFn(input?: any, format?: string, strict?: boolean) {
	const normalizeInput = (value?: any): Date => {
		if (value && value._date instanceof Date) {
			return new Date(value._date.getTime());
		}
		if (value instanceof Date) {
			return new Date(value.getTime());
		}
		if (typeof value === "number") {
			return new Date(value);
		}
		if (typeof value === "string") {
			const dateTimeMatch = value.match(
				/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
			);
			if (dateTimeMatch) {
				const [, year, month, day, hour = "0", minute = "0", second = "0"] =
					dateTimeMatch;
				return new Date(
					Number(year),
					Number(month) - 1,
					Number(day),
					Number(hour),
					Number(minute),
					Number(second)
				);
			}
			return new Date(value);
		}
		return new Date();
	};

	let date: Date = normalizeInput(input);
	const pad = (value: number) => value.toString().padStart(2, "0");

	const compareDate = (other: any, unit?: string): number => {
		const otherDate = normalizeInput(other);
		const left = new Date(date.getTime());
		const right = new Date(otherDate.getTime());
		if (unit === "day") {
			left.setHours(0, 0, 0, 0);
			right.setHours(0, 0, 0, 0);
		}
		return left.getTime() - right.getTime();
	};

	const mockMoment = {
		format: function (format?: string) {
			if (Number.isNaN(date.getTime())) {
				return "Invalid date";
			}
			if (format === "YYYY-MM-DD") {
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
					date.getDate()
				)}`;
			} else if (format === "YYYY-MM-DD HH:mm:ss") {
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
					date.getDate()
				)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
					date.getSeconds()
				)}`;
			} else if (format === "D") {
				return date.getDate().toString();
			}
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
				date.getDate()
			)}`;
		},
		diff: function (other: any, unit?: string) {
			return compareDate(other, unit);
		},
		startOf: function (unit: string) {
			if (unit === "day") {
				date = new Date(date.getTime());
				date.setHours(0, 0, 0, 0);
			}
			return mockMoment;
		},
		endOf: function (unit: string) {
			if (unit === "day") {
				date = new Date(date.getTime());
				date.setHours(23, 59, 59, 999);
			}
			return mockMoment;
		},
		isValid: function () {
			return !Number.isNaN(date.getTime());
		},
		isSame: function (other: any, unit?: string) {
			return compareDate(other, unit) === 0;
		},
		isSameOrBefore: function (other: any, unit?: string) {
			return compareDate(other, unit) <= 0;
		},
		isSameOrAfter: function (other: any, unit?: string) {
			return compareDate(other, unit) >= 0;
		},
		isBefore: function (other: any, unit?: string) {
			return compareDate(other, unit) < 0;
		},
		isAfter: function (other: any, unit?: string) {
			return compareDate(other, unit) > 0;
		},
		isBetween: function (
			start: any,
			end: any,
			unit?: string,
			inclusivity?: string
		) {
			const startDiff = compareDate(start, unit);
			const endDiff = compareDate(end, unit);
			const includeStart = inclusivity?.[0] === "[";
			const includeEnd = inclusivity?.[1] === "]";
			return (includeStart ? startDiff >= 0 : startDiff > 0) &&
				(includeEnd ? endDiff <= 0 : endDiff < 0);
		},
		clone: function () {
			return momentFn(date);
		},
		add: function (amount: number, unit: string) {
			date = new Date(date.getTime());
			if (unit.startsWith("day")) date.setDate(date.getDate() + amount);
			return mockMoment;
		},
		subtract: function (amount: number, unit: string) {
			date = new Date(date.getTime());
			if (unit.startsWith("day")) date.setDate(date.getDate() - amount);
			return mockMoment;
		},
		valueOf: function () {
			return date.getTime();
		},
		toDate: function () {
			return new Date(date.getTime());
		},
		weekday: function (day?: number) {
			if (day !== undefined) {
				date = new Date(date.getTime());
				date.setDate(date.getDate() - date.getDay() + day);
				return mockMoment;
			}
			return date.getDay();
		},
		day: function () {
			return date.getDay();
		},
		date: function () {
			return date.getDate();
		},
		get _date() {
			return date;
		},
	};
	return mockMoment;
}


// Add static methods to momentFn
(momentFn as any).utc = function () {
	return {
		format: function () {
			return "00:00:00";
		},
	};
};

(momentFn as any).duration = function () {
	return {
		asMilliseconds: function () {
			return 0;
		},
	};
};

(momentFn as any).locale = function (locale?: string) {
	if (locale) {
		(momentFn as any)._currentLocale = locale;
		return locale;
	}
	return (momentFn as any)._currentLocale || "en";
};

// Initialize default locale
(momentFn as any)._currentLocale = "en";

(momentFn as any).weekdaysShort = function (localeData?: boolean) {
	return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
};

(momentFn as any).weekdaysMin = function (localeData?: boolean) {
	return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
};

(momentFn as any).months = function () {
	return ["January", "February", "March", "April", "May", "June", 
			"July", "August", "September", "October", "November", "December"];
};

(momentFn as any).monthsShort = function () {
	return ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
			"Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
};

export const moment = momentFn as any;

// Mock Component class
export class Component {
	private children: Component[] = [];
	private loaded = false;

	addChild(component: Component): Component {
		this.children.push(component);
		if (this.loaded) {
			component.load();
		}
		return component;
	}

	removeChild(component: Component): Component {
		const index = this.children.indexOf(component);
		if (index !== -1) {
			this.children.splice(index, 1);
			component.unload();
		}
		return component;
	}

	load(): void {
		this.loaded = true;
		this.children.forEach((child) => child.load());
		this.onload();
	}

	unload(): void {
		this.loaded = false;
		this.children.forEach((child) => child.unload());
		// Drain registered event refs by calling their unload() — this matches
		// real Obsidian Component behavior so that listener-leak tests work.
		// Without this, code that correctly uses registerEvent() still appears
		// to leak in jest because the mock never calls eventRef.unload().
		for (const ref of this._events) {
			try {
				ref.unload();
			} catch {
				/* listener cleanup must not throw */
			}
		}
		this._events = [];
		this.onunload();
	}

	onload(): void {
		// Override in subclasses
	}

	onunload(): void {
		// Override in subclasses
	}

	registerDomEvent(
		el: HTMLElement,
		type: string,
		listener: EventListener
	): void {
		// Mock implementation
		el.addEventListener(type, listener);
	}

	registerInterval(id: number): number {
		// Mock implementation
		return id;
	}

	private _events: Array<{ unload: () => void }> = [];

	registerEvent(eventRef: { unload: () => void }): void {
		this._events.push(eventRef);
	}
}

export class Modal extends Component {
	app: App;
	modalEl: HTMLElement | Record<string, unknown>;
	contentEl: HTMLElement | Record<string, unknown>;

	constructor(app: App) {
		super();
		this.app = app;
		if (typeof document !== "undefined" && document.createElement) {
			this.modalEl = document.createElement("div");
			this.contentEl = document.createElement("div");
		} else {
			this.modalEl = {};
			this.contentEl = {};
		}
	}

	open(): void {
		this.onOpen();
	}

	close(): void {
		this.onClose();
	}

	onOpen(): void {
		// Override in subclasses
	}

	onClose(): void {
		// Override in subclasses
	}
}

// Mock other common Obsidian utilities
export function normalizePath(path: string): string {
	return (path ?? "")
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\.\//, "")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

export function setIcon(el: HTMLElement, iconId: string): void {
	// Mock implementation
}

export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate?: boolean
): T {
	let timeout: NodeJS.Timeout | null = null;
	return ((...args: any[]) => {
		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};
		const callNow = immediate && !timeout;
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func(...args);
	}) as T;
}

// Mock EditorSuggest class
export abstract class EditorSuggest<T> extends Component {
	app: App;
	
	constructor(app: App) {
		super();
		this.app = app;
	}

	abstract getSuggestions(context: any): T[] | Promise<T[]>;
	abstract renderSuggestion(suggestion: T, el: HTMLElement): void;
	abstract selectSuggestion(suggestion: T, evt: MouseEvent | KeyboardEvent): void;

	onTrigger(cursor: any, editor: any, file: any): any {
		return null;
	}

	close(): void {
		// Mock implementation
	}
}

// Add any other Obsidian classes or functions needed for tests
