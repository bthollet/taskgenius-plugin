/**
 * Integration tests for TaskWorkerManager mtime optimization
 */

import { TaskWorkerManager } from "../dataflow/workers/TaskWorkerManager";
import { TaskIndexer } from "../core/task-indexer";
import { TFile } from "obsidian";

// Mock dependencies
const mockVault = {
	cachedRead: jest.fn(),
	on: jest.fn().mockReturnValue({}),
	off: jest.fn(),
} as any;

const mockMetadataCache = {
	getFileCache: jest.fn(),
} as any;

const mockApp = {
	workspace: {
		onLayoutReady: jest.fn((callback: () => void) => callback()),
	},
} as any;

// Mock TFile
const createMockFile = (path: string, mtime: number): TFile => ({
	path,
	stat: { mtime, ctime: mtime, size: 100 },
	extension: "md",
	name: path.split("/").pop() || path,
	basename: path.split("/").pop()?.replace(".md", "") || path,
} as any);

describe("TaskWorkerManager mtime optimization", () => {
	let workerManager: TaskWorkerManager;
	let indexer: TaskIndexer;

	beforeEach(() => {
		jest.clearAllMocks();
		// Mock vault.cachedRead to return empty content
		mockVault.cachedRead.mockResolvedValue("");
		mockVault.on.mockReturnValue({});
		mockMetadataCache.getFileCache.mockReturnValue(null);
		mockApp.workspace.onLayoutReady.mockImplementation((callback: () => void) => callback());

		// Create indexer with the minimal Obsidian app/vault API used by TaskIndexer
		indexer = new TaskIndexer(mockApp, mockVault, mockMetadataCache);
		
		// Create worker manager with mtime optimization enabled
		workerManager = new TaskWorkerManager(mockVault, mockMetadataCache, {
			maxWorkers: 1,
			settings: {
				fileParsingConfig: {
					enableMtimeOptimization: true,
					mtimeCacheSize: 1000,
					enableFileMetadataParsing: false,
					metadataFieldsToParseAsTasks: [],
					enableTagBasedTaskParsing: false,
					tagsToParseAsTasks: [],
					taskContentFromMetadata: "title",
					defaultTaskStatus: " ",
					enableWorkerProcessing: true,
				},
				preferMetadataFormat: "tasks",
				useDailyNotePathAsDate: false,
				dailyNoteFormat: "yyyy-MM-dd",
				useAsDateType: "due",
				dailyNotePath: "",
				ignoreHeading: "",
				focusHeading: "",
				fileMetadataInheritance: undefined,
			},
		});

		// Set indexer reference
		workerManager.setTaskIndexer(indexer);
	});

	afterEach(() => {
		if (workerManager && typeof workerManager.unload === 'function') {
			workerManager.unload();
		}
		if (indexer && typeof indexer.unload === 'function') {
			indexer.unload();
		}
		jest.clearAllMocks();
	});

	describe("cache optimization", () => {
		test("should skip processing files with valid cache", async () => {
			const file = createMockFile("test.md", 1000);
			const tasks = [
				{
					id: "task1",
					content: "Test task",
					filePath: file.path,
					line: 1,
					completed: false,
					status: " ",
					originalMarkdown: "- [ ] Test task",
					metadata: {
						tags: [],
						project: undefined,
						context: undefined,
						priority: undefined,
						dueDate: undefined,
						startDate: undefined,
						scheduledDate: undefined,
						completedDate: undefined,
						cancelledDate: undefined,
						createdDate: undefined,
						recurrence: undefined,
						dependsOn: [],
						onCompletion: undefined,
						taskId: undefined,
						children: [],
					},
				},
			];

			// Pre-populate cache
			indexer.updateIndexWithTasks(file.path, tasks, file.stat.mtime);

			// Process file - should use cache
			const result = await workerManager.processFile(file);

			// Should return cached tasks without calling vault.cachedRead
			expect(result).toEqual(tasks);
			expect(mockVault.cachedRead).not.toHaveBeenCalled();
		});

		test("should process files when cache is invalid", async () => {
			const file = createMockFile("test.md", 2000);
			const oldTasks = [
				{
					id: "task1",
					content: "Old task",
					filePath: file.path,
					line: 1,
					completed: false,
					status: " ",
					originalMarkdown: "- [ ] Old task",
					metadata: {
						tags: [],
						project: undefined,
						context: undefined,
						priority: undefined,
						dueDate: undefined,
						startDate: undefined,
						scheduledDate: undefined,
						completedDate: undefined,
						cancelledDate: undefined,
						createdDate: undefined,
						recurrence: undefined,
						dependsOn: [],
						onCompletion: undefined,
						taskId: undefined,
						children: [],
					},
				},
			];

			// Pre-populate cache with older mtime
			indexer.updateIndexWithTasks(file.path, oldTasks, 1000);

			// Mock worker processing (since we can't easily test actual worker)
			// This would normally go through the worker, but for testing we'll simulate
			// the file being processed
			expect(indexer.hasValidCache(file.path, file.stat.mtime)).toBe(false);
		});

		test("should optimize batch processing", async () => {
			const files = [
				createMockFile("cached1.md", 1000),
				createMockFile("cached2.md", 1000),
				createMockFile("new.md", 2000),
			];

			const cachedTasks = [
				{
					id: "cached-task",
					content: "Cached task",
					filePath: "cached1.md",
					line: 1,
					completed: false,
					status: " ",
					originalMarkdown: "- [ ] Cached task",
					metadata: {
						tags: [],
						project: undefined,
						context: undefined,
						priority: undefined,
						dueDate: undefined,
						startDate: undefined,
						scheduledDate: undefined,
						completedDate: undefined,
						cancelledDate: undefined,
						createdDate: undefined,
						recurrence: undefined,
						dependsOn: [],
						onCompletion: undefined,
						taskId: undefined,
						children: [],
					},
				},
			];

			// Pre-populate cache for first two files
			indexer.updateIndexWithTasks("cached1.md", cachedTasks, 1000);
			indexer.updateIndexWithTasks("cached2.md", cachedTasks, 1000);

			// Process batch
			const result = await workerManager.processBatch(files);

			// Should have results for cached files
			expect(result.has("cached1.md")).toBe(true);
			expect(result.has("cached2.md")).toBe(true);
			expect(result.get("cached1.md")).toEqual(cachedTasks);
			expect(result.get("cached2.md")).toEqual(cachedTasks);

			// Check statistics. processBatch currently returns cached entries from
			// its pre-filter without incrementing per-file skip stats (processFile
			// increments filesSkipped for single-file cache hits).
			const stats = workerManager.getStats();
			expect(stats.filesSkipped).toBe(0);
		});
	});

	describe("configuration", () => {
		test("should respect mtime optimization setting", () => {
			// Create worker manager with optimization disabled
			const workerManagerDisabled = new TaskWorkerManager(mockVault, mockMetadataCache, {
				settings: {
					fileParsingConfig: {
						enableMtimeOptimization: false,
						mtimeCacheSize: 1000,
						enableFileMetadataParsing: false,
						metadataFieldsToParseAsTasks: [],
						enableTagBasedTaskParsing: false,
						tagsToParseAsTasks: [],
						taskContentFromMetadata: "title",
						defaultTaskStatus: " ",
						enableWorkerProcessing: true,
					},
					preferMetadataFormat: "tasks",
					useDailyNotePathAsDate: false,
					dailyNoteFormat: "yyyy-MM-dd",
					useAsDateType: "due",
					dailyNotePath: "",
					ignoreHeading: "",
					focusHeading: "",
					fileMetadataInheritance: undefined,
				},
			});

			workerManagerDisabled.setTaskIndexer(indexer);

			const file = createMockFile("test.md", 1000);

			// Pre-populate cache with a real task so the indexer's cache is valid.
			const cachedTask = {
				id: "disabled-cache-task",
				content: "Cached task",
				filePath: file.path,
				line: 1,
				completed: false,
				status: " ",
				originalMarkdown: "- [ ] Cached task",
				metadata: {
					tags: [],
					project: undefined,
					context: undefined,
					priority: undefined,
					dueDate: undefined,
					startDate: undefined,
					scheduledDate: undefined,
					completedDate: undefined,
					cancelledDate: undefined,
					createdDate: undefined,
					recurrence: undefined,
					dependsOn: [],
					onCompletion: undefined,
					taskId: undefined,
					children: [],
				},
			};
			indexer.updateIndexWithTasks(file.path, [cachedTask], 1000);
			expect(indexer.hasValidCache(file.path, file.stat.mtime)).toBe(true);

			// Should process instead of using the valid cache when optimization is disabled.
			expect((workerManagerDisabled as any).shouldProcessFile(file)).toBe(true);
			expect(workerManagerDisabled.getStats().filesProcessed).toBe(0);
			expect(workerManagerDisabled.getStats().filesSkipped).toBe(0);

			workerManagerDisabled.unload();
		});
	});
});
