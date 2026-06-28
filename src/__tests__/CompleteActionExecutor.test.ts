/**
 * CompleteActionExecutor Tests
 *
 * Tests for complete action executor functionality including:
 * - Completing related tasks by ID
 * - Dataflow/WriteAPI integration
 * - Configuration validation
 * - Error handling
 */

import { CompleteActionExecutor } from "../executors/completion/complete-executor";
import {
	OnCompletionActionType,
	OnCompletionExecutionContext,
	OnCompletionCompleteConfig,
} from "../types/onCompletion";
import { Task } from "../types/task";
import { createMockPlugin, createMockApp } from "./mockUtils";

// Mock Dataflow QueryAPI and WriteAPI
const mockQueryAPI = {
	getTaskById: jest.fn(),
};

const mockWriteAPI = {
	updateTask: jest.fn(),
};

describe("CompleteActionExecutor", () => {
	let executor: CompleteActionExecutor;
	let mockTask: Task;
	let mockContext: OnCompletionExecutionContext;
	let mockPlugin: any;

	beforeEach(() => {
		executor = new CompleteActionExecutor();
		mockPlugin = createMockPlugin();
		mockPlugin.dataflowOrchestrator = {
			getQueryAPI: jest.fn(() => mockQueryAPI),
		};
		mockPlugin.writeAPI = mockWriteAPI;

		mockTask = {
			id: "main-task-id",
			content: "Main task",
			completed: true,
			status: "x",
			metadata: {
				onCompletion: "complete:related-1,related-2",
				tags: [],
				children: [],
			},
			filePath: "test.md",
			line: 1,
			originalMarkdown: "- [x] Main task",
		};

		mockContext = {
			task: mockTask,
			plugin: mockPlugin,
			app: createMockApp(),
		};

		// Reset mocks
		jest.clearAllMocks();
	});

	describe("Configuration Validation", () => {
		it("should validate correct complete configuration", () => {
			const config: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["task1", "task2"],
			};

			expect(executor["validateConfig"](config)).toBe(true);
		});

		it("should reject configuration with wrong type", () => {
			const config = {
				type: OnCompletionActionType.DELETE,
				taskIds: ["task1"],
			} as any;

			expect(executor["validateConfig"](config)).toBe(false);
		});

		it("should reject configuration without taskIds", () => {
			const config = {
				type: OnCompletionActionType.COMPLETE,
			} as any;

			expect(executor["validateConfig"](config)).toBe(false);
		});

		it("should reject configuration with empty taskIds", () => {
			const config: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: [],
			};

			expect(executor["validateConfig"](config)).toBe(false);
		});
	});

	describe("Task Completion", () => {
		let config: OnCompletionCompleteConfig;

		beforeEach(() => {
			config = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["related-task-1", "related-task-2"],
			};
		});

		it("should complete related tasks successfully", async () => {
			const relatedTask1: Task = {
				id: "related-task-1",
				content: "Related task 1",
				completed: false,
				status: " ",
				metadata: {
					tags: [],
					children: [],
				},
				line: 2,
				filePath: "test.md",
				originalMarkdown: "- [ ] Related task 1",
			};

			const relatedTask2: Task = {
				id: "related-task-2",
				content: "Related task 2",
				completed: false,
				status: " ",
				metadata: {
					tags: [],
					children: [],
				},
				line: 3,
				filePath: "test.md",
				originalMarkdown: "- [ ] Related task 2",
			};

			mockQueryAPI.getTaskById
				.mockReturnValueOnce(relatedTask1)
				.mockReturnValueOnce(relatedTask2);
			mockWriteAPI.updateTask.mockResolvedValue({ success: true });

			const result = await executor.execute(mockContext, config);

			expect(result.success).toBe(true);
			expect(result.message).toBe(
				"Completed tasks: related-task-1, related-task-2"
			);

			// Verify tasks were updated with completed status
			expect(mockWriteAPI.updateTask).toHaveBeenCalledTimes(2);
			expect(mockWriteAPI.updateTask).toHaveBeenCalledWith({
				taskId: relatedTask1.id,
				updates: {
					...relatedTask1,
					completed: true,
					status: "x",
					metadata: {
						...relatedTask1.metadata,
						completedDate: expect.any(Number),
					},
				},
			});
			expect(mockWriteAPI.updateTask).toHaveBeenCalledWith({
				taskId: relatedTask2.id,
				updates: {
					...relatedTask2,
					completed: true,
					status: "x",
					metadata: {
						...relatedTask2.metadata,
						completedDate: expect.any(Number),
					},
				},
			});
		});

		it("should skip already completed tasks", async () => {
			const relatedTask1: Task = {
				id: "related-task-1",
				content: "Related task 1",
				completed: true, // Already completed
				status: "x",
				metadata: {
					tags: [],
					children: [],
				},
				line: 2,
				filePath: "test.md",
				originalMarkdown: "- [x] Related task 1",
			};

			const relatedTask2: Task = {
				id: "related-task-2",
				content: "Related task 2",
				completed: false,
				status: " ",
				metadata: {
					tags: [],
					children: [],
				},
				line: 3,
				filePath: "test.md",
				originalMarkdown: "- [ ] Related task 2",
			};

			mockQueryAPI.getTaskById
				.mockReturnValueOnce(relatedTask1)
				.mockReturnValueOnce(relatedTask2);
			mockWriteAPI.updateTask.mockResolvedValue({ success: true });

			const result = await executor.execute(mockContext, config);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Completed tasks: related-task-2");

			// Only the incomplete task should be updated
			expect(mockWriteAPI.updateTask).toHaveBeenCalledTimes(1);
			expect(mockWriteAPI.updateTask).toHaveBeenCalledWith({
				taskId: relatedTask2.id,
				updates: {
					...relatedTask2,
					completed: true,
					status: "x",
					metadata: {
						...relatedTask2.metadata,
						completedDate: expect.any(Number),
					},
				},
			});
		});

		it("should handle task not found", async () => {
			mockQueryAPI.getTaskById
				.mockReturnValueOnce(null) // Task not found
				.mockReturnValueOnce({
					id: "related-task-2",
					content: "Related task 2",
					completed: false,
					status: " ",
					metadata: {},
					lineNumber: 3,
					filePath: "test.md",
				});
			mockWriteAPI.updateTask.mockResolvedValue({ success: true });

			const result = await executor.execute(mockContext, config);

			expect(result.success).toBe(true);
			expect(result.message).toBe(
				"Completed tasks: related-task-2; Failed: Task not found: related-task-1"
			);

			// Only the found task should be updated
			expect(mockWriteAPI.updateTask).toHaveBeenCalledTimes(1);
		});

		it("should handle task update error", async () => {
			const relatedTask1: Task = {
				id: "related-task-1",
				content: "Related task 1",
				completed: false,
				status: " ",
				metadata: {
					tags: [],
					children: [],
				},
				line: 2,
				filePath: "test.md",
				originalMarkdown: "- [ ] Related task 1",
			};

			const relatedTask2: Task = {
				id: "related-task-2",
				content: "Related task 2",
				completed: false,
				status: " ",
				metadata: {
					tags: [],
					children: [],
				},
				line: 3,
				filePath: "test.md",
				originalMarkdown: "- [ ] Related task 2",
			};

			mockQueryAPI.getTaskById
				.mockReturnValueOnce(relatedTask1)
				.mockReturnValueOnce(relatedTask2);
			mockWriteAPI.updateTask
				.mockRejectedValueOnce(new Error("Update failed"))
				.mockResolvedValueOnce({ success: true });

			const result = await executor.execute(mockContext, config);

			expect(result.success).toBe(true);
			expect(result.message).toBe(
				"Completed tasks: related-task-2; Failed: related-task-1: Update failed"
			);

			// Both tasks should be attempted to update
			expect(mockWriteAPI.updateTask).toHaveBeenCalledTimes(2);
		});

		it("should handle no dataflow orchestrator available", async () => {
			const contextWithoutDataflow = {
				...mockContext,
				plugin: { ...mockPlugin, dataflowOrchestrator: null },
			};

			const result = await executor.execute(
				contextWithoutDataflow,
				config
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Dataflow orchestrator not available");
		});

		it("should handle no write API available", async () => {
			mockQueryAPI.getTaskById.mockReturnValueOnce({
				id: "related-task-1",
				content: "Related task 1",
				completed: false,
				status: " ",
				metadata: {},
				line: 2,
				filePath: "test.md",
				originalMarkdown: "- [ ] Related task 1",
			});
			const contextWithoutWriteAPI = {
				...mockContext,
				plugin: { ...mockPlugin, writeAPI: null },
			};

			const result = await executor.execute(
				contextWithoutWriteAPI,
				{ ...config, taskIds: ["related-task-1"] }
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed: related-task-1: WriteAPI not available");
		});

			it("should handle all tasks failing", async () => {
			mockQueryAPI.getTaskById
				.mockReturnValueOnce(null)
				.mockReturnValueOnce(null);

			const result = await executor.execute(mockContext, config);

			expect(result.success).toBe(false);
			expect(result.error).toBe(
				"Failed: Task not found: related-task-1, Task not found: related-task-2"
			);
		});

		it("should preserve existing task metadata", async () => {
			const relatedTask: Task = {
				id: "related-task-1",
				content: "Related task with metadata",
				completed: false,
				status: " ",
				metadata: {
					priority: 3,
					project: "test-project",
					tags: ["important"],
					children: [],
				},
				line: 2,
				filePath: "test.md",
				originalMarkdown:
					"- [ ] Related task with metadata 🔼 #important #project/test-project",
			};

			const singleTaskConfig: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["related-task-1"],
			};

			mockQueryAPI.getTaskById.mockReturnValueOnce(relatedTask);
			mockWriteAPI.updateTask.mockResolvedValue({ success: true });

			const result = await executor.execute(
				mockContext,
				singleTaskConfig
			);

			expect(result.success).toBe(true);
			expect(mockWriteAPI.updateTask).toHaveBeenCalledWith({
				taskId: relatedTask.id,
				updates: {
					...relatedTask,
					completed: true,
					status: "x",
					metadata: {
						...relatedTask.metadata,
						completedDate: expect.any(Number),
					},
				},
			});
		});
	});

	describe("Invalid Configuration Handling", () => {
		it("should return error for invalid configuration", async () => {
			const invalidConfig = {
				type: OnCompletionActionType.DELETE,
			} as any;

			const result = await executor.execute(mockContext, invalidConfig);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid complete configuration");
			expect(mockQueryAPI.getTaskById).not.toHaveBeenCalled();
		});
	});

	describe("Description Generation", () => {
		it("should return correct description for single task", () => {
			const config: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["task1"],
			};

			const description = executor.getDescription(config);

			expect(description).toBe("Complete 1 related task");
		});

		it("should return correct description for multiple tasks", () => {
			const config: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["task1", "task2", "task3"],
			};

			const description = executor.getDescription(config);

			expect(description).toBe("Complete 3 related tasks");
		});

		it("should handle empty taskIds in description", () => {
			const config: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: [],
			};

			const description = executor.getDescription(config);

			expect(description).toBe("Complete 0 related tasks");
		});
	});

	describe("Error Handling", () => {
		it("should handle general execution error", async () => {
			const config: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["task1"],
			};

			// Mock query API to throw an error
			mockQueryAPI.getTaskById.mockImplementation(() => {
				throw new Error("Unexpected error");
			});

			const result = await executor.execute(mockContext, config);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed: task1: Unexpected error");
		});
	});

	describe("Edge Cases", () => {
		it("should handle single task completion", async () => {
			const singleTaskConfig: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: ["single-task"],
			};

			const relatedTask: Task = {
				id: "single-task",
				content: "Single related task",
				completed: false,
				status: " ",
				metadata: {
					tags: [],
					children: [],
				},
				line: 2,
				filePath: "test.md",
				originalMarkdown: "- [ ] Single related task",
			};

			mockQueryAPI.getTaskById.mockReturnValueOnce(relatedTask);
			mockWriteAPI.updateTask.mockResolvedValue({ success: true });

			const result = await executor.execute(
				mockContext,
				singleTaskConfig
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Completed tasks: single-task");
		});

		it("should handle large number of tasks", async () => {
			const manyTaskIds = Array.from(
				{ length: 10 },
				(_, i) => `task-${i}`
			);
			const manyTasksConfig: OnCompletionCompleteConfig = {
				type: OnCompletionActionType.COMPLETE,
				taskIds: manyTaskIds,
			};

			// Mock all tasks as found and incomplete
			manyTaskIds.forEach((taskId, index) => {
				mockQueryAPI.getTaskById.mockReturnValueOnce({
					id: taskId,
					content: `Task ${index}`,
					completed: false,
					status: " ",
					metadata: {},
					lineNumber: index + 1,
					filePath: "test.md",
				});
			});
			mockWriteAPI.updateTask.mockResolvedValue({ success: true });

			const result = await executor.execute(mockContext, manyTasksConfig);

			expect(result.success).toBe(true);
			expect(result.message).toBe(
				`Completed tasks: ${manyTaskIds.join(", ")}`
			);
			expect(mockWriteAPI.updateTask).toHaveBeenCalledTimes(10);
		});
	});
});
