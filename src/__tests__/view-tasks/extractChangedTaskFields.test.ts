import type { Task } from "@/types/task";
import { extractChangedTaskFields } from "@/modules/view-tasks/extractChangedTaskFields";

function createTask(overrides: Partial<Task> = {}): Task {
	const baseMetadata = {
		tags: ["alpha", "beta"],
		children: [],
		priority: 1,
		project: "Inbox",
		context: "home",
		dueDate: 100,
		startDate: 200,
		scheduledDate: 300,
		completedDate: 400,
		recurrence: "every day",
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

describe("extractChangedTaskFields", () => {
	it("returns an empty object with no metadata for unchanged tasks", () => {
		const originalTask = createTask();
		const updatedTask = createTask();

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({});
	});

	it("extracts top-level content, completed, and status changes", () => {
		const originalTask = createTask();
		const updatedTask = createTask({
			content: "Updated task",
			completed: true,
			status: "x",
		});

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({
			content: "Updated task",
			completed: true,
			status: "x",
		});
	});

	it("extracts metadata scalar changes", () => {
		const originalTask = createTask();
		const updatedTask = createTask({
			metadata: {
				...originalTask.metadata,
				priority: 4,
				project: "Project A",
				context: "work",
				dueDate: 101,
				startDate: 201,
				scheduledDate: 301,
				recurrence: "every week",
			},
		});

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({
			metadata: {
				priority: 4,
				project: "Project A",
				context: "work",
				dueDate: 101,
				startDate: 201,
				scheduledDate: 301,
				recurrence: "every week",
			},
		});
	});

	it("does not include metadata.tags when tags are equal in the same order", () => {
		const originalTask = createTask({
			metadata: { tags: ["alpha", "beta"], children: [] },
		});
		const updatedTask = createTask({
			metadata: { tags: ["alpha", "beta"], children: [] },
		});

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({});
	});

	it("includes metadata.tags when tags have the same values in a different order", () => {
		const originalTask = createTask({
			metadata: { tags: ["alpha", "beta"], children: [] },
		});
		const updatedTask = createTask({
			metadata: { tags: ["beta", "alpha"], children: [] },
		});

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({
			metadata: {
				tags: ["beta", "alpha"],
			},
		});
	});

	it("includes metadata.tags when tag lengths differ", () => {
		const originalTask = createTask({
			metadata: { tags: ["alpha", "beta"], children: [] },
		});
		const updatedTask = createTask({
			metadata: { tags: ["alpha", "beta", "gamma"], children: [] },
		});

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({
			metadata: {
				tags: ["alpha", "beta", "gamma"],
			},
		});
	});

	it("represents completedDate cleared to undefined as a metadata change", () => {
		const originalTask = createTask({
			metadata: { completedDate: 400, tags: [], children: [] },
		});
		const updatedTask = createTask({
			metadata: { completedDate: undefined, tags: [], children: [] },
		});

		expect(extractChangedTaskFields(originalTask, updatedTask)).toEqual({
			metadata: {
				completedDate: undefined,
			},
		});
	});
});
