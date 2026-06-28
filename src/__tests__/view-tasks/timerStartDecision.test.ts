import { getTimerStartDecision } from "@/modules/view-tasks/timerStartDecision";

describe("getTimerStartDecision", () => {
	const taskStatuses = {
		completed: "x|X",
		inProgress: ">|/",
		abandoned: "-",
		planned: "?",
		notStarted: " ",
	};

	it("blocks a task whose completed boolean is true", () => {
		expect(
			getTimerStartDecision(
				{ completed: true, status: " " },
				taskStatuses
			)
		).toEqual({ allowed: false, reason: "completed" });
	});

	it("blocks a stale-false task with the primary completed status mark", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: "x" },
				taskStatuses
			)
		).toEqual({ allowed: false, reason: "completed-status" });
	});

	it("blocks a stale-false task with an alternate completed status mark", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: "X" },
				taskStatuses
			)
		).toEqual({ allowed: false, reason: "completed-status" });
	});

	it("blocks a stale-false task with an abandoned status mark", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: "-" },
				taskStatuses
			)
		).toEqual({ allowed: false, reason: "abandoned-status" });
	});

	it("allows in-progress status marks", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: ">" },
				taskStatuses
			)
		).toEqual({ allowed: true });
		expect(
			getTimerStartDecision(
				{ completed: false, status: "/" },
				taskStatuses
			)
		).toEqual({ allowed: true });
	});

	it("allows not-started and space status marks", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: " " },
				taskStatuses
			)
		).toEqual({ allowed: true });
		expect(
			getTimerStartDecision(
				{ completed: false, status: "" },
				taskStatuses
			)
		).toEqual({ allowed: true });
	});

	it("allows unknown status marks unless configured as completed or abandoned", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: "!" },
				taskStatuses
			)
		).toEqual({ allowed: true });
		expect(
			getTimerStartDecision(
				{ completed: false, status: "!" },
				{ ...taskStatuses, abandoned: "-|!" }
			)
		).toEqual({ allowed: false, reason: "abandoned-status" });
		expect(
			getTimerStartDecision(
				{ completed: false, status: "!" },
				{ ...taskStatuses, completed: "x|!" }
			)
		).toEqual({ allowed: false, reason: "completed-status" });
	});

	it("reports completed-status when completed and abandoned config overlap", () => {
		expect(
			getTimerStartDecision(
				{ completed: false, status: "c" },
				{ ...taskStatuses, completed: "x|c", abandoned: "-|c" }
			)
		).toEqual({ allowed: false, reason: "completed-status" });
	});
});
