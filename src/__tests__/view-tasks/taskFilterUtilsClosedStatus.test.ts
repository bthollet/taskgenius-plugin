import { isNotCompleted } from "@/utils/task/task-filter-utils";
import type { Task } from "@/types/task";

const taskStatuses = {
	completed: "x|X",
	inProgress: ">|/",
	abandoned: "-",
	planned: "?",
	notStarted: " ",
};

const plugin = {
	settings: {
		taskStatuses,
		viewConfiguration: [
			{
				id: "test-view",
				name: "Test View",
				icon: "list-checks",
				type: "custom",
				visible: true,
				hideCompletedAndAbandonedTasks: true,
				filterBlanks: false,
				filterRules: {},
			},
		],
	},
	saveSettings: jest.fn(),
} as any;

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-id",
		content: "Task content",
		filePath: "file.md",
		line: 1,
		completed: false,
		status: " ",
		originalMarkdown: "- [ ] Task content",
		metadata: {
			tags: [],
			children: [],
		},
		...overrides,
	};
}

describe("task-filter-utils isNotCompleted closed-status normalization", () => {
	it("excludes boolean completed true from hide-completed visible results", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: true, status: " " }),
				"test-view",
			),
		).toBe(false);
	});

	it("excludes completed status mark when completed boolean is stale false", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: false, status: "x" }),
				"test-view",
			),
		).toBe(false);
	});

	it("excludes alternate configured completed mark when completed boolean is stale false", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: false, status: "X" }),
				"test-view",
			),
		).toBe(false);
	});

	it("excludes abandoned status mark when completed boolean is stale false", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: false, status: "-" }),
				"test-view",
			),
		).toBe(false);
	});

	it("includes not-started status when completed boolean is false", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: false, status: " " }),
				"test-view",
			),
		).toBe(true);
	});

	it("includes in-progress status when completed boolean is false", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: false, status: ">" }),
				"test-view",
			),
		).toBe(true);
	});

	it("includes unknown non-closed mark when completed boolean is false", () => {
		expect(
			isNotCompleted(
				plugin,
				task({ completed: false, status: "!" }),
				"test-view",
			),
		).toBe(true);
	});
});
