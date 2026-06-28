export type TaskStatusSettings = Record<string, string | undefined> | undefined;

export function getPrimaryCompletedStatusMark(
	taskStatuses: TaskStatusSettings,
): string {
	const completedCfg = String(taskStatuses?.completed || "x");
	return completedCfg
		.split("|")
		.map((s) => s.trim())
		.find(Boolean) || "x";
}

export function isCompletedStatusMark(
	status: string,
	taskStatuses: TaskStatusSettings,
): boolean {
	if (!status) return false;

	try {
		const lower = status.toLowerCase();
		const completedCfg = String(taskStatuses?.completed || "x");
		const completedSet = completedCfg
			.split("|")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean);

		if (completedSet.includes(lower)) return true;

		if (taskStatuses) {
			for (const [type, symbols] of Object.entries(taskStatuses)) {
				const set = String(symbols)
					.split("|")
					.map((s) => s.trim().toLowerCase())
					.filter(Boolean);

				if (set.includes(lower)) {
					return type.toLowerCase() === "completed";
				}
			}
		}
	} catch (_) {}

	return false;
}
