import type { TaskStatusConfig } from "@/common/setting-definition";

export type TaskStatusSettings =
	| Partial<TaskStatusConfig>
	| Record<string, string | undefined>
	| undefined;

function parseStatusMarks(symbols: string | undefined, fallback: string): string[] {
	return String(symbols || fallback)
		.split("|")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

export function isAbandonedStatusMark(
	status: string,
	taskStatuses: TaskStatusSettings,
): boolean {
	const normalizedStatus = status.trim().toLowerCase();
	if (!normalizedStatus) return false;

	try {
		const abandonedSet = parseStatusMarks(taskStatuses?.abandoned, "-");
		if (abandonedSet.includes(normalizedStatus)) return true;

		if (taskStatuses) {
			for (const [type, symbols] of Object.entries(taskStatuses)) {
				const set = parseStatusMarks(symbols, "");

				if (set.includes(normalizedStatus)) {
					return type.toLowerCase() === "abandoned";
				}
			}
		}
	} catch (_) {}

	return false;
}

export function isClosedStatusMark(
	status: string,
	taskStatuses: TaskStatusSettings,
): boolean {
	const normalizedStatus = status.trim().toLowerCase();
	if (!normalizedStatus) return false;

	try {
		const completedSet = parseStatusMarks(taskStatuses?.completed, "x");
		const abandonedSet = parseStatusMarks(taskStatuses?.abandoned, "-");

		if (
			completedSet.includes(normalizedStatus) ||
			abandonedSet.includes(normalizedStatus)
		) {
			return true;
		}

		if (taskStatuses) {
			for (const [type, symbols] of Object.entries(taskStatuses)) {
				const set = parseStatusMarks(symbols, "");

				if (set.includes(normalizedStatus)) {
					const normalizedType = type.toLowerCase();
					return (
						normalizedType === "completed" ||
						normalizedType === "abandoned"
					);
				}
			}
		}
	} catch (_) {}

	return false;
}
