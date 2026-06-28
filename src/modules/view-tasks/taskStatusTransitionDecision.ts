import type { TaskStatusConfig } from "@/common/setting-definition";
import { isClosedStatusMark } from "./closedStatusPredicate";
import { isCompletedStatusMark } from "./completedStatusPredicate";

export type TaskStatusSettings =
	| Partial<TaskStatusConfig>
	| Record<string, string | undefined>
	| undefined;

export interface TaskStatusTransitionDecisionInput {
	currentStatus: string;
	currentCompleted: boolean;
	nextStatus?: string;
	nextCompleted?: boolean;
	taskStatuses: TaskStatusSettings;
	autoDateManager?: {
		manageCompletedDate?: boolean;
		manageCancelledDate?: boolean;
		manageStartDate?: boolean;
	};
	hasRecurrence?: boolean;
	now?: number;
}

export interface TaskStatusTransitionDecision {
	status: string;
	completed: boolean;
	isCompletedStatus: boolean;
	isAbandonedStatus: boolean;
	isClosedStatus: boolean;
	addCompletedDate: boolean;
	removeCompletedDate: boolean;
	addCancelledDate: boolean;
	removeCancelledDate: boolean;
	addStartDate: boolean;
	shouldTriggerCompletionEvent: boolean;
	shouldCreateRecurringInstance: boolean;
}

function parseStatusMarks(
	symbols: string | undefined,
	fallback: string,
): string[] {
	return String(symbols || fallback)
		.split("|")
		.map((status) => status.trim())
		.filter(Boolean);
}

function firstStatusMark(
	symbols: string | undefined,
	fallback: string,
): string {
	return parseStatusMarks(symbols, fallback)[0] ?? fallback;
}

function normalizeStatus(status: string): string {
	return status.trim();
}

function isInProgressStatusMark(
	status: string,
	taskStatuses: TaskStatusSettings,
): boolean {
	const normalizedStatus = normalizeStatus(status).toLowerCase();
	if (!normalizedStatus) return false;

	return parseStatusMarks(taskStatuses?.inProgress, ">|/").some(
		(mark) => mark.toLowerCase() === normalizedStatus,
	);
}

function resolveNextStatus(
	input: TaskStatusTransitionDecisionInput,
): string {
	if (input.nextStatus !== undefined) {
		return input.nextStatus;
	}

	if (input.nextCompleted === true) {
		return firstStatusMark(input.taskStatuses?.completed, "x");
	}

	if (input.nextCompleted === false) {
		return firstStatusMark(input.taskStatuses?.notStarted, " ");
	}

	return input.currentStatus;
}

/**
 * Computes status-transition side effects without mutating task data or writing files.
 *
 * Status marks are authoritative whenever nextStatus is supplied: completed and
 * closed flags are derived from the configured status groups, not from a stale
 * completed boolean. When nextStatus is omitted, nextCompleted is treated as an
 * intent by selecting the configured completed or not-started mark.
 */
export function getTaskStatusTransitionDecision(
	input: TaskStatusTransitionDecisionInput,
): TaskStatusTransitionDecision {
	void input.currentCompleted;
	void input.now;

	const currentStatus = normalizeStatus(input.currentStatus);
	const status = resolveNextStatus(input);
	const normalizedNextStatus = normalizeStatus(status);

	const wasCompletedStatus = isCompletedStatusMark(
		currentStatus,
		input.taskStatuses,
	);
	const wasClosedStatus = isClosedStatusMark(currentStatus, input.taskStatuses);
	const wasAbandonedStatus = wasClosedStatus && !wasCompletedStatus;

	const isCompletedStatus = isCompletedStatusMark(
		normalizedNextStatus,
		input.taskStatuses,
	);
	const isClosedStatus = isClosedStatusMark(
		normalizedNextStatus,
		input.taskStatuses,
	);
	const isAbandonedStatus = isClosedStatus && !isCompletedStatus;

	const managesCompletedDate =
		input.autoDateManager?.manageCompletedDate !== false;
	const managesCancelledDate =
		input.autoDateManager?.manageCancelledDate !== false;
	const managesStartDate = input.autoDateManager?.manageStartDate !== false;

	const enteringCompletedStatus = !wasCompletedStatus && isCompletedStatus;
	const leavingCompletedStatus = wasCompletedStatus && !isCompletedStatus;
	const enteringAbandonedStatus = !wasAbandonedStatus && isAbandonedStatus;
	const leavingAbandonedStatus = wasAbandonedStatus && !isAbandonedStatus;

	const shouldTriggerCompletionEvent = enteringCompletedStatus;

	return {
		status,
		completed: isCompletedStatus,
		isCompletedStatus,
		isAbandonedStatus,
		isClosedStatus,
		addCompletedDate: managesCompletedDate && enteringCompletedStatus,
		removeCompletedDate: managesCompletedDate && leavingCompletedStatus,
		addCancelledDate: managesCancelledDate && enteringAbandonedStatus,
		removeCancelledDate: managesCancelledDate && leavingAbandonedStatus,
		addStartDate:
			managesStartDate &&
			!isInProgressStatusMark(currentStatus, input.taskStatuses) &&
			isInProgressStatusMark(normalizedNextStatus, input.taskStatuses),
		shouldTriggerCompletionEvent,
		shouldCreateRecurringInstance:
			shouldTriggerCompletionEvent && input.hasRecurrence === true,
	};
}
