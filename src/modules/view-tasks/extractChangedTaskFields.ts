import type { Task } from "@/types/task";

const METADATA_FIELDS = [
	"priority",
	"project",
	"tags",
	"context",
	"dueDate",
	"startDate",
	"scheduledDate",
	"completedDate",
	"recurrence",
] as const;

/**
 * Extract only the fields that have changed between two tasks.
 *
 * Preserves the TaskView/TaskSpecificView diff semantics: top-level task fields
 * are compared by strict equality, metadata fields are compared by strict
 * equality, and tags are compared by length plus same-index order.
 */
export function extractChangedTaskFields(
	originalTask: Task,
	updatedTask: Task,
): Partial<Task> {
	const changes: Partial<Task> = {};

	// Check top-level fields
	if (originalTask.content !== updatedTask.content) {
		changes.content = updatedTask.content;
	}
	if (originalTask.completed !== updatedTask.completed) {
		changes.completed = updatedTask.completed;
	}
	if (originalTask.status !== updatedTask.status) {
		changes.status = updatedTask.status;
	}

	// Check metadata fields
	const metadataChanges: Partial<typeof originalTask.metadata> = {};
	let hasMetadataChanges = false;

	// Compare each metadata field
	for (const field of METADATA_FIELDS) {
		const originalValue = (originalTask.metadata as any)?.[field];
		const updatedValue = (updatedTask.metadata as any)?.[field];

		// Handle arrays specially (tags)
		if (field === "tags") {
			const origTags = originalValue || [];
			const updTags = updatedValue || [];
			if (
				origTags.length !== updTags.length ||
				!origTags.every((t: string, i: number) => t === updTags[i])
			) {
				metadataChanges.tags = updTags;
				hasMetadataChanges = true;
			}
		} else if (originalValue !== updatedValue) {
			(metadataChanges as any)[field] = updatedValue;
			hasMetadataChanges = true;
		}
	}

	// Only include metadata if there are changes
	if (hasMetadataChanges) {
		changes.metadata = metadataChanges as any;
	}

	return changes;
}
