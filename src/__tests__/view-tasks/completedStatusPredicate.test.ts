import {
	getPrimaryCompletedStatusMark,
	isCompletedStatusMark,
} from "@/modules/view-tasks/completedStatusPredicate";

describe("isCompletedStatusMark", () => {
	it("uses the default completed mark when settings are undefined", () => {
		expect(isCompletedStatusMark("x", undefined)).toBe(true);
		expect(isCompletedStatusMark("X", undefined)).toBe(true);
		expect(isCompletedStatusMark("/", undefined)).toBe(false);
	});

	it("matches configured completed marks case-insensitively and supports unicode marks", () => {
		const taskStatuses = { completed: "x|X|\u2713" };

		expect(isCompletedStatusMark("x", taskStatuses)).toBe(true);
		expect(isCompletedStatusMark("X", taskStatuses)).toBe(true);
		expect(isCompletedStatusMark("\u2713", taskStatuses)).toBe(true);
	});

	it("returns false for configured non-completed status groups", () => {
		const taskStatuses = {
			completed: "x",
			inProgress: "/",
			abandoned: "-",
			planned: "?",
		};

		expect(isCompletedStatusMark("/", taskStatuses)).toBe(false);
		expect(isCompletedStatusMark("-", taskStatuses)).toBe(false);
		expect(isCompletedStatusMark("?", taskStatuses)).toBe(false);
	});

	it("gives explicit completed config precedence over non-completed groups", () => {
		const taskStatuses = {
			completed: "x|/",
			inProgress: "/",
		};

		expect(isCompletedStatusMark("/", taskStatuses)).toBe(true);
	});

	it("returns false for empty and unknown marks", () => {
		const taskStatuses = {
			completed: "x|\u2713",
			inProgress: "/",
		};

		expect(isCompletedStatusMark("", taskStatuses)).toBe(false);
		expect(isCompletedStatusMark("!", taskStatuses)).toBe(false);
	});

	it("matches custom completed marks that are not the first configured symbol", () => {
		const taskStatuses = { completed: "x|\u2713|done" };

		expect(isCompletedStatusMark("\u2713", taskStatuses)).toBe(true);
		expect(isCompletedStatusMark("done", taskStatuses)).toBe(true);
	});

	describe("getPrimaryCompletedStatusMark", () => {
		it("defaults to x when settings are undefined or completed aliases are empty", () => {
			expect(getPrimaryCompletedStatusMark(undefined)).toBe("x");
			expect(getPrimaryCompletedStatusMark({ completed: " | " })).toBe("x");
		});

		it("returns the first non-empty configured completed alias", () => {
			expect(getPrimaryCompletedStatusMark({ completed: " \u2713 |done" })).toBe("\u2713");
		});
	});
});