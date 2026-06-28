import {
	isTaskClosedForFluentActiveViews,
	isTaskCompletedForFluentDisplay,
	isTaskOverdueForFluentActiveViews,
	shouldShowInFluentStatusFilter,
	shouldShowInFluentWorkingOn,
	TaskStatusSettings,
} from "@/modules/view-tasks/fluentTaskPredicates";

const taskStatuses: TaskStatusSettings = {
	completed: "x|X",
	inProgress: ">|/",
	abandoned: "-",
	planned: "?",
	notStarted: " ",
};

const now = new Date("2024-06-15T12:00:00.000Z");
const pastDue = Date.UTC(2024, 5, 14);
const futureDue = Date.UTC(2024, 5, 16);

function task(
	overrides: {
		completed?: boolean;
		status?: string;
		metadata?: { dueDate?: number; id?: string };
	} = {},
) {
	return {
		completed: false,
		status: " ",
		...overrides,
	};
}

describe("fluent task predicates", () => {
	describe("completed display", () => {
		it("treats completed boolean true as completed display even with not-started status", () => {
			expect(
				isTaskCompletedForFluentDisplay(
					task({ completed: true, status: " " }),
					taskStatuses,
				),
			).toBe(true);
		});

		it("treats completed status mark as completed display when boolean is stale false", () => {
			expect(
				isTaskCompletedForFluentDisplay(
					task({ completed: false, status: "x" }),
					taskStatuses,
				),
			).toBe(true);
		});

		it("treats alternate configured completed mark as completed display", () => {
			expect(
				isTaskCompletedForFluentDisplay(
					task({ completed: false, status: "X" }),
					taskStatuses,
				),
			).toBe(true);
		});

		it("does not treat abandoned status as completed display when boolean is false", () => {
			expect(
				isTaskCompletedForFluentDisplay(
					task({ completed: false, status: "-" }),
					taskStatuses,
				),
			).toBe(false);
		});
	});

	describe("active views closed predicate", () => {
		it("excludes completed boolean true", () => {
			expect(
				isTaskClosedForFluentActiveViews(
					task({ completed: true, status: " " }),
					taskStatuses,
				),
			).toBe(true);
		});

		it("excludes completed mark when boolean is stale false", () => {
			expect(
				isTaskClosedForFluentActiveViews(
					task({ completed: false, status: "x" }),
					taskStatuses,
				),
			).toBe(true);
		});

		it("excludes abandoned mark when boolean is stale false", () => {
			expect(
				isTaskClosedForFluentActiveViews(
					task({ completed: false, status: "-" }),
					taskStatuses,
				),
			).toBe(true);
		});

		it("includes not-started and in-progress non-closed statuses", () => {
			expect(
				isTaskClosedForFluentActiveViews(
					task({ completed: false, status: " " }),
					taskStatuses,
				),
			).toBe(false);
			expect(
				isTaskClosedForFluentActiveViews(
					task({ completed: false, status: ">" }),
					taskStatuses,
				),
			).toBe(false);
		});
	});

	describe("overdue", () => {
		it("returns true for past due active status", () => {
			expect(
				isTaskOverdueForFluentActiveViews(
					task({ status: " ", metadata: { dueDate: pastDue } }),
					taskStatuses,
					now,
				),
			).toBe(true);
		});

		it("returns false for future due active status", () => {
			expect(
				isTaskOverdueForFluentActiveViews(
					task({ status: " ", metadata: { dueDate: futureDue } }),
					taskStatuses,
					now,
				),
			).toBe(false);
		});

		it("returns false for past due completed mark when boolean is stale false", () => {
			expect(
				isTaskOverdueForFluentActiveViews(
					task({ status: "x", metadata: { dueDate: pastDue } }),
					taskStatuses,
					now,
				),
			).toBe(false);
		});

		it("returns false for past due abandoned mark", () => {
			expect(
				isTaskOverdueForFluentActiveViews(
					task({ status: "-", metadata: { dueDate: pastDue } }),
					taskStatuses,
					now,
				),
			).toBe(false);
		});

		it("returns false with no dueDate", () => {
			expect(
				isTaskOverdueForFluentActiveViews(
					task({ status: " ", metadata: {} }),
					taskStatuses,
					now,
				),
			).toBe(false);
		});
	});

	describe("working-on", () => {
		const inProgressMarks = [">", "/"];
		const activeTimerBlockIds = new Set(["active-id"]);

		it("excludes completed boolean true even with active timer", () => {
			expect(
				shouldShowInFluentWorkingOn(
					task({ completed: true, metadata: { id: "active-id" } }),
					taskStatuses,
					inProgressMarks,
					activeTimerBlockIds,
				),
			).toBe(false);
		});

		it("excludes completed mark stale-false even with active timer", () => {
			expect(
				shouldShowInFluentWorkingOn(
					task({ status: "x", metadata: { id: "active-id" } }),
					taskStatuses,
					inProgressMarks,
					activeTimerBlockIds,
				),
			).toBe(false);
		});

		it("excludes abandoned mark even with active timer", () => {
			expect(
				shouldShowInFluentWorkingOn(
					task({ status: "-", metadata: { id: "active-id" } }),
					taskStatuses,
					inProgressMarks,
					activeTimerBlockIds,
				),
			).toBe(false);
		});

		it("includes in-progress mark without timer", () => {
			expect(
				shouldShowInFluentWorkingOn(
					task({ status: ">" }),
					taskStatuses,
					inProgressMarks,
					activeTimerBlockIds,
				),
			).toBe(true);
		});

		it("includes not-started task with active timer id", () => {
			expect(
				shouldShowInFluentWorkingOn(
					task({ status: " ", metadata: { id: "active-id" } }),
					taskStatuses,
					inProgressMarks,
					activeTimerBlockIds,
				),
			).toBe(true);
		});

		it("excludes not-started task without timer", () => {
			expect(
				shouldShowInFluentWorkingOn(
					task({ status: " " }),
					taskStatuses,
					inProgressMarks,
					activeTimerBlockIds,
				),
			).toBe(false);
		});
	});

	describe("status filter wrapper", () => {
		it("completed filter does not include abandoned status when boolean is stale false", () => {
			expect(
				shouldShowInFluentStatusFilter(
					task({ completed: false, status: "-" }),
					"completed",
					taskStatuses,
					now,
				),
			).toBe(false);
		});

		it("all filter returns true even for closed tasks", () => {
			expect(
				shouldShowInFluentStatusFilter(
					task({ completed: false, status: "-" }),
					"all",
					taskStatuses,
					now,
				),
			).toBe(true);
			expect(
				shouldShowInFluentStatusFilter(
					task({ completed: true, status: "x" }),
					"all",
					taskStatuses,
					now,
				),
			).toBe(true);
		});
	});
});
