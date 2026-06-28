import type { Task } from "@/types/task";

export interface TaskStatusTransitionOptions {
	status: string;
	isCompletedStatus: (status: string) => boolean;
	now?: () => number;
}

export function applyTaskStatusTransition(
	task: Task,
	options: TaskStatusTransitionOptions,
): Task {
	const willComplete = options.isCompletedStatus(options.status);
	const metadata = { ...task.metadata };

	if (!task.completed && willComplete) {
		metadata.completedDate = (options.now ?? Date.now)();
	} else if (task.completed && !willComplete) {
		metadata.completedDate = undefined;
	}

	return {
		...task,
		status: options.status,
		completed: willComplete,
		metadata,
	};
}
