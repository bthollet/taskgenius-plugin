import type { Task } from "@/types/task";
import { applyTaskStatusTransition } from "@/modules/view-tasks/taskStatusTransition";

function createTask(overrides: Partial<Task> = {}): Task {
	const baseMetadata = {
		tags: ["alpha"],
		children: [],
		priority: 1,
		project: "Inbox",
		completedDate: 100,
	};

	return {
		id: "task-1",
		content: "Original task",
		filePath: "tasks.md",
		line: 1,
		completed: false,
		status: " ",
		originalMarkdown: "- [ ] Original task",
		...overrides,
		metadata: {
			...baseMetadata,
			...(overrides.metadata ?? {}),
		},
	} as Task;
}

describe("applyTaskStatusTransition", () => {
	it("sets status, completed, and completedDate when transitioning to a completed status", () => {
		const task = createTask({
			completed: false,
			status: " ",
			metadata: { completedDate: undefined, tags: ["alpha"], children: [] },
		});

		const updatedTask = applyTaskStatusTransition(task, {
			status: "X",
			isCompletedStatus: (status) => status === "X",
			now: () => 123456789,
		});

		expect(updatedTask).toMatchObject({
			status: "X",
			completed: true,
			metadata: { completedDate: 123456789 },
		});
	});

	it("sets status, marks incomplete, and clears completedDate when transitioning to a non-completed status", () => {
		const task = createTask({
			completed: true,
			status: "x",
			metadata: { completedDate: 987654321, tags: ["alpha"], children: [] },
		});

		const updatedTask = applyTaskStatusTransition(task, {
			status: "/",
			isCompletedStatus: (status) => status === "x",
			now: () => 111,
		});

		expect(updatedTask.status).toBe("/");
		expect(updatedTask.completed).toBe(false);
		expect(updatedTask.metadata.completedDate).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(updatedTask.metadata, "completedDate")).toBe(true);
	});

	it("preserves existing metadata fields", () => {
		const task = createTask({
			metadata: {
				completedDate: undefined,
				tags: ["alpha", "beta"],
				children: ["child-1"],
				project: "Project A",
				priority: 4,
			},
		});

		const updatedTask = applyTaskStatusTransition(task, {
			status: "X",
			isCompletedStatus: () => true,
			now: () => 222,
		});

		expect(updatedTask.metadata).toEqual({
			...task.metadata,
			completedDate: 222,
		});
	});

	it("does not mutate the original task or original metadata", () => {
		const task = createTask({
			completed: true,
			status: "x",
			metadata: { completedDate: 333, tags: ["alpha"], children: [] },
		});
		const originalMetadata = task.metadata;

		const updatedTask = applyTaskStatusTransition(task, {
			status: " ",
			isCompletedStatus: () => false,
		});

		expect(updatedTask).not.toBe(task);
		expect(updatedTask.metadata).not.toBe(originalMetadata);
		expect(task.status).toBe("x");
		expect(task.completed).toBe(true);
		expect(task.metadata.completedDate).toBe(333);
	});

	it("uses the supplied completion predicate for custom marks instead of hardcoding x", () => {
		const task = createTask({
			completed: false,
			status: " ",
			metadata: { completedDate: undefined, tags: ["alpha"], children: [] },
		});
		const isCompletedStatus = (status: string) => status === "X";

		const slashTask = applyTaskStatusTransition(task, {
			status: "/",
			isCompletedStatus,
			now: () => 444,
		});
		const xTask = applyTaskStatusTransition(task, {
			status: "X",
			isCompletedStatus,
			now: () => 555,
		});

		expect(slashTask.completed).toBe(false);
		expect(slashTask.metadata.completedDate).toBeUndefined();
		expect(xTask.completed).toBe(true);
		expect(xTask.metadata.completedDate).toBe(555);
	});
});
