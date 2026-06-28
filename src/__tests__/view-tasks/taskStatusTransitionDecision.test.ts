import {
	getTaskStatusTransitionDecision,
	type TaskStatusSettings,
} from "@/modules/view-tasks/taskStatusTransitionDecision";

const DEFAULT_STATUSES: TaskStatusSettings = {
	completed: "x|X|✓",
	abandoned: "-|~",
	inProgress: ">|/",
	notStarted: " ",
	planned: "?",
};

describe("getTaskStatusTransitionDecision", () => {
	it("enters completed for default completed mark and schedules completed side effects", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "x",
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision).toMatchObject({
			status: "x",
			completed: true,
			isCompletedStatus: true,
			isAbandonedStatus: false,
			isClosedStatus: true,
			addCompletedDate: true,
			removeCompletedDate: false,
			addCancelledDate: false,
			shouldTriggerCompletionEvent: true,
			shouldCreateRecurringInstance: true,
		});
	});

	it("enters completed for alternate configured completed marks", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "✓",
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision.completed).toBe(true);
		expect(decision.isCompletedStatus).toBe(true);
		expect(decision.addCompletedDate).toBe(true);
		expect(decision.shouldTriggerCompletionEvent).toBe(true);
		expect(decision.shouldCreateRecurringInstance).toBe(true);
		expect(decision.addCancelledDate).toBe(false);
	});

	it("enters abandoned without completion event or recurrence", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "-",
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision).toMatchObject({
			completed: false,
			isCompletedStatus: false,
			isAbandonedStatus: true,
			isClosedStatus: true,
			addCompletedDate: false,
			addCancelledDate: true,
			shouldTriggerCompletionEvent: false,
			shouldCreateRecurringInstance: false,
		});
	});

	it("moves from completed to abandoned by removing completed date and adding cancelled date", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: "x",
			currentCompleted: true,
			nextStatus: "-",
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision.completed).toBe(false);
		expect(decision.removeCompletedDate).toBe(true);
		expect(decision.addCancelledDate).toBe(true);
		expect(decision.shouldTriggerCompletionEvent).toBe(false);
		expect(decision.shouldCreateRecurringInstance).toBe(false);
	});

	it("moves from abandoned to not-started by removing cancelled date only", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: "-",
			currentCompleted: false,
			nextStatus: " ",
			taskStatuses: DEFAULT_STATUSES,
		});

		expect(decision.completed).toBe(false);
		expect(decision.isClosedStatus).toBe(false);
		expect(decision.removeCancelledDate).toBe(true);
		expect(decision.addCompletedDate).toBe(false);
		expect(decision.removeCompletedDate).toBe(false);
	});

	it("adds start date when entering a configured in-progress mark", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "/",
			taskStatuses: {
				...DEFAULT_STATUSES,
				inProgress: ">|/|doing",
			},
		});

		expect(decision.addStartDate).toBe(true);
		expect(decision.completed).toBe(false);
		expect(decision.isClosedStatus).toBe(false);
	});

	it("suppresses date add and remove decisions when auto-date flags are false", () => {
		const completedDecision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "x",
			taskStatuses: DEFAULT_STATUSES,
			autoDateManager: { manageCompletedDate: false },
		});
		const cancelledDecision = getTaskStatusTransitionDecision({
			currentStatus: "-",
			currentCompleted: false,
			nextStatus: " ",
			taskStatuses: DEFAULT_STATUSES,
			autoDateManager: { manageCancelledDate: false },
		});
		const startDecision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: ">",
			taskStatuses: DEFAULT_STATUSES,
			autoDateManager: { manageStartDate: false },
		});

		expect(completedDecision.addCompletedDate).toBe(false);
		expect(cancelledDecision.removeCancelledDate).toBe(false);
		expect(startDecision.addStartDate).toBe(false);
	});

	it("normalizes stale incomplete boolean with current completed mark and avoids duplicate completed effects", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: "x",
			currentCompleted: false,
			nextStatus: "x",
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision.completed).toBe(true);
		expect(decision.addCompletedDate).toBe(false);
		expect(decision.shouldTriggerCompletionEvent).toBe(false);
		expect(decision.shouldCreateRecurringInstance).toBe(false);
	});

	it("normalizes stale incomplete boolean with current abandoned mark and avoids duplicate cancelled date", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: "-",
			currentCompleted: false,
			nextStatus: "-",
			taskStatuses: DEFAULT_STATUSES,
		});

		expect(decision.completed).toBe(false);
		expect(decision.isAbandonedStatus).toBe(true);
		expect(decision.addCancelledDate).toBe(false);
	});

	it("uses nextCompleted true without nextStatus as intent to select the configured completed mark", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextCompleted: true,
			taskStatuses: {
				...DEFAULT_STATUSES,
				completed: "✓|x",
			},
			hasRecurrence: true,
		});

		expect(decision.status).toBe("✓");
		expect(decision.completed).toBe(true);
		expect(decision.addCompletedDate).toBe(true);
		expect(decision.shouldCreateRecurringInstance).toBe(true);
	});

	it("uses nextCompleted false without nextStatus as intent to leave completed status", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: "x",
			currentCompleted: true,
			nextCompleted: false,
			taskStatuses: DEFAULT_STATUSES,
		});

		expect(decision.status).toBe(" ");
		expect(decision.completed).toBe(false);
		expect(decision.removeCompletedDate).toBe(true);
		expect(decision.shouldTriggerCompletionEvent).toBe(false);
	});

	it("treats unknown non-closed next status as open and side-effect free", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "!",
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision).toMatchObject({
			status: "!",
			completed: false,
			isCompletedStatus: false,
			isAbandonedStatus: false,
			isClosedStatus: false,
			addCompletedDate: false,
			removeCompletedDate: false,
			addCancelledDate: false,
			removeCancelledDate: false,
			addStartDate: false,
			shouldTriggerCompletionEvent: false,
			shouldCreateRecurringInstance: false,
		});
	});

	it("lets an explicit nextStatus override stale or conflicting nextCompleted intent", () => {
		const decision = getTaskStatusTransitionDecision({
			currentStatus: " ",
			currentCompleted: false,
			nextStatus: "-",
			nextCompleted: true,
			taskStatuses: DEFAULT_STATUSES,
			hasRecurrence: true,
		});

		expect(decision.completed).toBe(false);
		expect(decision.isAbandonedStatus).toBe(true);
		expect(decision.shouldTriggerCompletionEvent).toBe(false);
		expect(decision.shouldCreateRecurringInstance).toBe(false);
	});
});
