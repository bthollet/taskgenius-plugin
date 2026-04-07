/**
 * Worker-related error types.
 *
 * Phase 0 W3: distinguish "worker hung past its timeout" from other worker
 * failures so the WorkerOrchestrator can:
 *  - increment a dedicated metric (`workerTimeouts`) separate from generic
 *    parsing failures
 *  - decide whether the fallback to main thread is appropriate
 *  - allow tests to assert specifically on the timeout path
 */

export class WorkerTimeoutError extends Error {
	readonly filePath: string;
	readonly timeoutMs: number;

	constructor(filePath: string, timeoutMs: number) {
		super(
			`Task worker timed out after ${timeoutMs}ms while processing ${filePath}`,
		);
		this.name = "WorkerTimeoutError";
		this.filePath = filePath;
		this.timeoutMs = timeoutMs;
	}
}
