// @ts-ignore
import { describe, it, expect } from "@jest/globals";
import {
	findTaskStatusChange,
	determineDateOperations,
	getStatusType,
} from "../editor-extensions/date-time/date-manager";
import TaskProgressBarPlugin from "../index";

// Mock the plugin
const mockPlugin: Partial<TaskProgressBarPlugin> = {
	settings: {
		autoDateManager: {
			enabled: true,
			manageStartDate: true,
			manageCompletedDate: true,
			manageCancelledDate: true,
			startDateFormat: "YYYY-MM-DD",
			completedDateFormat: "YYYY-MM-DD", 
			cancelledDateFormat: "YYYY-MM-DD",
			startDateMarker: "🛫",
			completedDateMarker: "✅",
			cancelledDateMarker: "❌",
		},
		preferMetadataFormat: "emoji",
		taskStatuses: {
			completed: "x|X",
			inProgress: "/|-|>",
			abandoned: "_|-",  // Deliberate duplicate: '-' is configured for both inProgress and abandoned
			planned: "!",
			notStarted: " ",
		},
	},
} as unknown as TaskProgressBarPlugin;

describe("autoDateManager - Pause Timer Conflict", () => {
	it("should resolve duplicate '-' marker by status precedence", () => {
		// getStatusType checks completed, inProgress, abandoned, planned, notStarted.
		// With '-' configured in both inProgress and abandoned, inProgress wins.
		const oldStatus = "/";
		const newStatus = "-";
		const lineText = "- [-] Task with timer 🛫 2025-04-20 ^timer-123";
		
		const oldType = getStatusType(oldStatus, mockPlugin as TaskProgressBarPlugin);
		const newType = getStatusType(newStatus, mockPlugin as TaskProgressBarPlugin);
		
		expect(oldType).toBe("inProgress");
		expect(newType).toBe("inProgress");
		
		const operations = determineDateOperations(
			oldStatus,
			newStatus,
			mockPlugin as TaskProgressBarPlugin,
			lineText
		);
		
		// Same resolved status type means a duplicate '-' pause scenario does not add cancelled dates.
		expect(operations).toEqual([]);
	});

	it("should document that '-' marker is ambiguous but resolved as inProgress", () => {
		const pausedTaskStatus = "-";
		const abandonedTaskStatus = "-";
		
		const pausedType = getStatusType(pausedTaskStatus, mockPlugin as TaskProgressBarPlugin);
		const abandonedType = getStatusType(abandonedTaskStatus, mockPlugin as TaskProgressBarPlugin);
		
		// Both calls resolve by precedence to inProgress, not abandoned.
		expect(pausedType).toBe("inProgress");
		expect(abandonedType).toBe("inProgress");
	});

	it("should not add a cancelled date for the duplicate '-' pause scenario", () => {
		const taskAfterPause = "- [-] 交流交底 🚀 2025-07-30 [stage::disclosure_communication] 🛫 2025-04-20 ^timer-161940-4775";
		
		const operations = determineDateOperations(
			"/",
			"-",
			mockPlugin as TaskProgressBarPlugin,
			taskAfterPause
		);
		
		expect(operations).toEqual([]);
	});

	it("should still add a cancelled date for an unambiguous abandoned marker", () => {
		const taskAfterAbandon = "- [_] 交流交底 🚀 2025-07-30 [stage::disclosure_communication] 🛫 2025-04-20 ^timer-161940-4775";
		
		const operations = determineDateOperations(
			"/",
			"_",
			mockPlugin as TaskProgressBarPlugin,
			taskAfterAbandon
		);
		
		expect(getStatusType("_", mockPlugin as TaskProgressBarPlugin)).toBe("abandoned");
		expect(operations).toContainEqual({
			type: "add",
			dateType: "cancelled",
			format: "YYYY-MM-DD",
		});
	});

	it("should suggest solutions for the conflict", () => {
		// Potential solutions:
		
		// Solution 1: Check for timer-specific annotations
		const isTimerOperation = (annotation: string) => {
			return annotation === "taskTimer" || annotation.includes("timer");
		};
		
		// Solution 2: Use different status markers for pause vs abandoned
		const alternativeStatuses = {
			paused: "p",      // New marker specifically for paused
			abandoned: "_",   // Keep _ for truly abandoned tasks
			inProgress: "/",
		};
		
		// Solution 3: Add configuration to skip date management for timer operations
		const skipDateManagementForTimers = true;
		
		// Solution 4: Check for timer-related block references
		const hasTimerBlockRef = (text: string) => {
			return /\^timer-\d+/.test(text);
		};
		
		expect(isTimerOperation("taskTimer")).toBe(true);
		expect(hasTimerBlockRef("^timer-123")).toBe(true);
	});
});