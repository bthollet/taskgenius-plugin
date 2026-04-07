/**
 * Phase 0 W3 — verify TaskWorkerManager per-task timeout fires, terminates the
 * hung worker, and rejects with WorkerTimeoutError; verify WorkerOrchestrator
 * counts the timeout in its metrics and falls back to main thread.
 *
 * Two test groups:
 *  1. TaskWorkerManager: monkey-patch the underlying worker.worker.postMessage
 *     to a no-op so the worker never responds, then drive the per-task timeout
 *     with a short workerTimeoutMs and assert the rejection shape.
 *  2. WorkerOrchestrator: stub a TaskWorkerManager whose processFile rejects
 *     with WorkerTimeoutError, assert metrics.taskWorkerTimeouts increments
 *     and the main-thread fallback runs.
 */

import { TaskWorkerManager } from "@/dataflow/workers/TaskWorkerManager";
import { WorkerOrchestrator } from "@/dataflow/workers/WorkerOrchestrator";
import { WorkerTimeoutError } from "@/dataflow/workers/errors";

// Build a minimal TFile-shaped object — TaskWorkerManager only reads .path,
// .extension, and .stat from it during processFile.
function fakeFile(path: string, content = "- [ ] task") {
	return {
		path,
		basename: path.replace(/\.md$/, ""),
		extension: "md",
		name: path.split("/").pop() ?? path,
		parent: null,
		stat: { mtime: 1, ctime: 1, size: content.length },
	} as any;
}

describe("TaskWorkerManager per-task timeout (W3)", () => {
	it("rejects active task with WorkerTimeoutError when worker hangs", async () => {
		// Minimal vault/metadataCache mocks. Only methods TaskWorkerManager
		// reaches into during processFile/getTaskMetadata are needed.
		const vault: any = {
			cachedRead: async () => "- [ ] task",
		};
		const metadataCache: any = {
			getFileCache: () => null,
		};

		// Construct manager with a 100ms timeout — long enough that the
		// jest event loop can schedule it, short enough that the test stays fast.
		const mgr = new TaskWorkerManager(vault, metadataCache, {
			maxWorkers: 1,
			cpuUtilization: 1,
			workerTimeoutMs: 100,
		});

		// Force-spawn one worker by reaching into the private state, then
		// monkey-patch its underlying worker.postMessage to do nothing so the
		// worker never responds. (Workers are constructed eagerly in the
		// constructor via initializeWorkers().)
		const workersMap: Map<number, any> = (mgr as any).workers;
		expect(workersMap.size).toBeGreaterThan(0);
		for (const w of workersMap.values()) {
			w.worker.postMessage = jest.fn(); // black hole
		}

		const file = fakeFile("hang.md");
		const result = mgr.processFile(file).then(
			(value) => ({ kind: "resolved", value }),
			(error) => ({ kind: "rejected", error }),
		);

		// Wait long enough for the timeout to fire (100ms + slack)
		await new Promise((resolve) => setTimeout(resolve, 200));
		const settled = await result;

		expect(settled.kind).toBe("rejected");
		const err = (settled as any).error;
		expect(err).toBeInstanceOf(WorkerTimeoutError);
		expect(err.filePath).toBe("hang.md");
		expect(err.timeoutMs).toBe(100);

		// Timeout was counted on the manager.
		expect(mgr.getTimeoutCount()).toBe(1);

		// Cleanup
		(mgr as any).onunload();
	});

	it("spawns a replacement worker after a timeout so the pool stays warm", async () => {
		const vault: any = {
			cachedRead: async () => "- [ ] task",
		};
		const metadataCache: any = {
			getFileCache: () => null,
		};

		const mgr = new TaskWorkerManager(vault, metadataCache, {
			maxWorkers: 1,
			cpuUtilization: 1,
			workerTimeoutMs: 80,
		});

		const workersMap: Map<number, any> = (mgr as any).workers;
		const initialIds = new Set([...workersMap.keys()]);
		for (const w of workersMap.values()) {
			w.worker.postMessage = jest.fn();
		}

		await mgr
			.processFile(fakeFile("hang.md"))
			.catch(() => undefined); // we expect rejection

		// Give the timeout time to fire and replacement to spawn
		await new Promise((resolve) => setTimeout(resolve, 200));

		// After the timeout: the pool size should be back to maxWorkers (1)
		// and the worker IDs should NOT all match the initial set (one was
		// replaced). The timeout counter should be exactly 1.
		expect(workersMap.size).toBe(1);
		expect(mgr.getTimeoutCount()).toBe(1);
		const finalIds = new Set([...workersMap.keys()]);
		const allReplaced = [...finalIds].every((id) => !initialIds.has(id));
		expect(allReplaced).toBe(true);

		(mgr as any).onunload();
	});
});

describe("WorkerOrchestrator counts WorkerTimeoutError separately (W3)", () => {
	it("increments metrics.taskWorkerTimeouts and falls back to main thread", async () => {
		// Stub a TaskWorkerManager whose processFile always rejects with the
		// timeout error. The orchestrator should catch it, bump the counter,
		// and fall through to parseFileTasksMainThread.
		const stubTaskMgr: any = {
			processFile: jest.fn(async (file: any) => {
				throw new WorkerTimeoutError(file.path, 100);
			}),
			processBatch: jest.fn(),
			isProcessingBatchTask: () => false,
			getPendingTaskCount: () => 0,
			getBatchProgress: () => ({ current: 0, total: 0, percentage: 0 }),
			getStats: () => ({}),
		};
		const stubProjectMgr: any = {
			getProjectData: jest.fn(),
			getBatchProjectData: jest.fn(),
			isWorkersEnabled: () => true,
			getMemoryStats: () => ({}),
		};

		const orch = new WorkerOrchestrator(stubTaskMgr, stubProjectMgr, {
			enableWorkerProcessing: true,
		});

		// Patch the orchestrator's main-thread fallback so the test doesn't
		// need a real ConfigurableTaskParser. We just need to confirm it's
		// called and returns something.
		const fallbackResult: any[] = [{ id: "fallback", content: "ok" }];
		(orch as any).parseFileTasksMainThread = jest.fn(async () => {
			return fallbackResult;
		});

		const file = {
			path: "hang.md",
			extension: "md",
			stat: { mtime: 1, ctime: 1, size: 1 },
		} as any;
		const result = await orch.parseFileTasks(file);

		// Fallback was reached
		expect(result).toBe(fallbackResult);
		expect(
			(orch as any).parseFileTasksMainThread,
		).toHaveBeenCalledTimes(1);

		// Metric was incremented
		const metrics = orch.getMetrics();
		expect(metrics.taskWorkerTimeouts).toBe(1);
		// And the generic failure count went up too — timeouts are a subset
		// of failures, not a replacement for them.
		expect(metrics.taskParsingFailures).toBeGreaterThanOrEqual(1);
	});
});
