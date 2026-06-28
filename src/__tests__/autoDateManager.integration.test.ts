// @ts-ignore
import { describe, it, expect } from "@jest/globals";
import { createMockTransaction } from "./mockUtils";
import {
	handleAutoDateManagerTransaction,
	findTaskStatusChange,
	determineDateOperations,
	applyDateOperations,
} from "../editor-extensions/date-time/date-manager";
import TaskProgressBarPlugin from "../index";
import { App } from "obsidian";

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
			inProgress: "/|-",
			abandoned: "_",
			planned: "!",
			notStarted: " ",
		},
	},
} as unknown as TaskProgressBarPlugin;

const mockApp = {} as App;

describe("autoDateManager - Integration Test", () => {
	it("should handle cancelled date insertion with real transaction", () => {
		// User's exact line - task status changing from ' ' to '_' (abandoned)
		const originalLine = "- [ ] 交流交底 🚀 2025-07-30 [stage::disclosure_communication] 🛫 2025-04-20 ^timer-161940-4775";
		
		const modifiedLine = "- [_] 交流交底 🚀 2025-07-30 [stage::disclosure_communication] 🛫 2025-04-20 ^timer-161940-4775";
		
		// Build a mock transaction with the full inserted line, matching the current
		// detection assumption that inserted text includes task-line context.
		const tr = createMockTransaction({
			startStateDocContent: originalLine,
			newDocContent: modifiedLine,
			changes: [
				{
					fromA: 0,
					toA: originalLine.length,
					fromB: 0,
					toB: modifiedLine.length,
					insertedText: modifiedLine,
				},
			],
		});
		
		// Find the task status change
		const statusChange = findTaskStatusChange(tr);
		expect(statusChange).toMatchObject({
			lineNumber: 1,
			oldStatus: " ",
			newStatus: "_",
		});
		
		// Determine date operations
		const operations = determineDateOperations(
			statusChange!.oldStatus,
			statusChange!.newStatus,
			mockPlugin as TaskProgressBarPlugin,
			tr.newDoc.line(1).text
		);
		
		expect(operations).toContainEqual({
			type: "add",
			dateType: "cancelled",
			format: "YYYY-MM-DD",
		});
		
		// Apply date operations
		const result = applyDateOperations(
			tr,
			tr.newDoc,
			1,
			operations,
			mockPlugin as TaskProgressBarPlugin
		);
		
		expect(result).toHaveProperty("changes");
		
		const handled = handleAutoDateManagerTransaction(
			tr,
			mockApp,
			mockPlugin as TaskProgressBarPlugin
		);
		expect(handled).toHaveProperty("changes");
	});
});