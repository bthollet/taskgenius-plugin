import {
	isAbandonedStatusMark,
	isClosedStatusMark,
} from "@/modules/view-tasks/closedStatusPredicate";

describe("isClosedStatusMark", () => {
	it("uses default completed and abandoned marks when settings are undefined", () => {
		expect(isClosedStatusMark("x", undefined)).toBe(true);
		expect(isClosedStatusMark("X", undefined)).toBe(true);
		expect(isClosedStatusMark("-", undefined)).toBe(true);
		expect(isClosedStatusMark("/", undefined)).toBe(false);
	});

	it("matches configured completed and abandoned marks case-insensitively with trimming", () => {
		const taskStatuses = {
			completed: "x | Done | ✓",
			abandoned: "- | Drop | C",
		};

		expect(isClosedStatusMark(" done ", taskStatuses)).toBe(true);
		expect(isClosedStatusMark("✓", taskStatuses)).toBe(true);
		expect(isClosedStatusMark(" drop ", taskStatuses)).toBe(true);
		expect(isClosedStatusMark("c", taskStatuses)).toBe(true);
	});

	it("returns false for configured non-completed and non-abandoned status groups", () => {
		const taskStatuses = {
			completed: "x",
			abandoned: "-",
			inProgress: "/",
			planned: "?",
			notStarted: " ",
		};

		expect(isClosedStatusMark("/", taskStatuses)).toBe(false);
		expect(isClosedStatusMark("?", taskStatuses)).toBe(false);
		expect(isClosedStatusMark(" ", taskStatuses)).toBe(false);
	});

	it("returns false for empty and unknown marks", () => {
		const taskStatuses = {
			completed: "x|✓",
			abandoned: "-|drop",
			inProgress: "/",
		};

		expect(isClosedStatusMark("", taskStatuses)).toBe(false);
		expect(isClosedStatusMark("   ", taskStatuses)).toBe(false);
		expect(isClosedStatusMark("!", taskStatuses)).toBe(false);
	});

	it("does not treat cancelled as closed unless configured as completed or abandoned", () => {
		const taskStatuses = {
			completed: "x",
			abandoned: "-",
			cancelled: "c",
		};

		expect(isClosedStatusMark("c", taskStatuses)).toBe(false);
		expect(
			isClosedStatusMark("c", {
				...taskStatuses,
				abandoned: "-|c",
			}),
		).toBe(true);
		expect(
			isClosedStatusMark("c", {
				...taskStatuses,
				completed: "x|c",
			}),
		).toBe(true);
	});

	describe("isAbandonedStatusMark", () => {
		it("matches default and configured abandoned aliases only", () => {
			expect(isAbandonedStatusMark("-", undefined)).toBe(true);
			expect(isAbandonedStatusMark("cancelled", { abandoned: "-|cancelled" })).toBe(true);
			expect(isAbandonedStatusMark("done", { completed: "x|done", abandoned: "-" })).toBe(false);
			expect(isAbandonedStatusMark("p", { inProgress: ">|p", abandoned: "-" })).toBe(false);
		});
	});
});
