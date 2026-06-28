import type { TaskStatusConfig } from "@/common/setting-definition";
import type { Task } from "@/types/task";
import { isClosedStatusMark } from "@/modules/view-tasks/closedStatusPredicate";
import { isCompletedStatusMark } from "@/modules/view-tasks/completedStatusPredicate";

export type TaskStatusSettings =
	| Partial<TaskStatusConfig>
	| Record<string, string | undefined>
	| undefined;

export type TimerStartBlockReason =
	| "completed"
	| "completed-status"
	| "abandoned-status";

export type TimerStartDecision =
	| { allowed: true }
	| { allowed: false; reason: TimerStartBlockReason };

export function getTimerStartDecision(
	task: Pick<Task, "completed" | "status">,
	taskStatuses: TaskStatusSettings
): TimerStartDecision {
	if (task.completed === true) {
		return { allowed: false, reason: "completed" };
	}

	const status = task.status || "";

	if (isCompletedStatusMark(status, taskStatuses)) {
		return { allowed: false, reason: "completed-status" };
	}

	if (isClosedStatusMark(status, taskStatuses)) {
		return { allowed: false, reason: "abandoned-status" };
	}

	return { allowed: true };
}
