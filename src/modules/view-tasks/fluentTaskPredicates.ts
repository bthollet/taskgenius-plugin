import type { TaskStatusConfig } from "@/common/setting-definition";
import type { Task } from "@/types/task";
import { isClosedStatusMark } from "./closedStatusPredicate";
import { isCompletedStatusMark } from "./completedStatusPredicate";

export type FluentStatusFilter = "all" | "active" | "completed" | "overdue";
export type TaskStatusSettings =
	| Partial<TaskStatusConfig>
	| Record<string, string | undefined>
	| undefined;

type FluentTaskStatusFields = Pick<Task, "completed" | "status">;
type FluentTaskMetadataFields = FluentTaskStatusFields & {
	metadata?: Pick<Task["metadata"], "dueDate" | "id"> | undefined;
};

export function isTaskCompletedForFluentDisplay(
	task: FluentTaskStatusFields,
	taskStatuses: TaskStatusSettings,
): boolean {
	return (
		task.completed === true ||
		isCompletedStatusMark(task.status || "", taskStatuses)
	);
}

export function isTaskClosedForFluentActiveViews(
	task: FluentTaskStatusFields,
	taskStatuses: TaskStatusSettings,
): boolean {
	return task.completed === true || isClosedStatusMark(task.status || "", taskStatuses);
}

export function isTaskOverdueForFluentActiveViews(
	task: FluentTaskMetadataFields,
	taskStatuses: TaskStatusSettings,
	now: Date = new Date(),
): boolean {
	if (isTaskClosedForFluentActiveViews(task, taskStatuses)) return false;
	if (!task.metadata?.dueDate) return false;

	return new Date(task.metadata.dueDate) < now;
}

export function shouldShowInFluentStatusFilter(
	task: FluentTaskMetadataFields,
	filterStatus: FluentStatusFilter,
	taskStatuses: TaskStatusSettings,
	now: Date = new Date(),
): boolean {
	switch (filterStatus) {
		case "all":
			return true;
		case "active":
			return !isTaskClosedForFluentActiveViews(task, taskStatuses);
		case "completed":
			return isTaskCompletedForFluentDisplay(task, taskStatuses);
		case "overdue":
			return isTaskOverdueForFluentActiveViews(task, taskStatuses, now);
		default:
			return true;
	}
}

export function shouldShowInFluentWorkingOn(
	task: FluentTaskMetadataFields,
	taskStatuses: TaskStatusSettings,
	inProgressMarks: string[],
	activeTimerBlockIds: Set<string>,
): boolean {
	if (isTaskClosedForFluentActiveViews(task, taskStatuses)) return false;

	const taskStatus = task.status || " ";
	if (inProgressMarks.includes(taskStatus)) return true;

	const blockId = task.metadata?.id;
	return Boolean(blockId && activeTimerBlockIds.has(blockId));
}
