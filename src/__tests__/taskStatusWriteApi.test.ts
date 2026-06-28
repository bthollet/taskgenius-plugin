import { App, MetadataCache } from "obsidian";
import { WriteAPI } from "@/dataflow/api/WriteAPI";
import type { Task } from "@/types/task";

function createHarness(options: {
	content: string;
	task?: Partial<Task>;
	settings?: any;
}) {
	let fileContent = options.content;
	const filePath = "WriteAPIStatus.md";
	const app = new App();
	(app as any).workspace = {
		...(app as any).workspace,
		trigger: jest.fn(),
		on: jest.fn(() => ({ unload: () => {} })),
	};
	const fakeVault: any = {
		getAbstractFileByPath: (path: string) => ({ path }),
		read: async () => fileContent,
		modify: async (_file: any, next: string) => {
			fileContent = next;
		},
	};
	const baseTask: Task = {
		id: "task-1",
		content: "Task",
		filePath,
		line: 0,
		completed: false,
		status: " ",
		originalMarkdown: options.content.split("\n")[0],
		metadata: {},
	} as Task;
	const task = { ...baseTask, ...options.task } as Task;
	const updateEventMock = jest.fn(async (_sourceId: string, args: any) => ({
		success: true,
		event: args.event,
	}));
	const plugin: any = {
		settings: {
			preferMetadataFormat: "tasks",
			projectTagPrefix: { tasks: "project", dataview: "project" },
			contextTagPrefix: { tasks: "@", dataview: "context" },
			taskStatuses: {
				notStarted: " ",
				inProgress: ">|/|p",
				completed: "x|X|done",
				abandoned: "-|cancelled",
			},
			autoDateManager: {
				manageCompletedDate: true,
				manageCancelledDate: true,
				manageStartDate: true,
			},
			...(options.settings || {}),
		},
		icsManager: {
			supportsWrite: jest.fn(() => true),
			updateEvent: updateEventMock,
		},
	};
	const writeAPI = new WriteAPI(
		app as any,
		fakeVault,
		new MetadataCache() as any,
		plugin,
		async () => task,
	);
	return {
		writeAPI,
		app,
		updateEventMock,
		get fileContent() {
			return fileContent;
		},
	};
}

describe("WriteAPI task status transition decisions", () => {
	it("updateTaskStatus status-only configured completed alias writes completion effects and triggers event/recurrence", async () => {
		const h = createHarness({
			content: "- [ ] Task 🔁 every day 📅 2025-01-01",
			task: { metadata: { recurrence: "every day", dueDate: Date.now() } as any },
		});

		const result = await h.writeAPI.updateTaskStatus({
			taskId: "task-1",
			status: "done",
		});

		expect(result.success).toBe(true);
		expect(h.fileContent).toContain("- [done] Task");
		expect(h.fileContent).toMatch(/✅\s*\d{4}-\d{2}-\d{2}/);
		expect(h.fileContent.split("\n").length).toBeGreaterThan(1);
		expect((h.app as any).workspace.trigger).toHaveBeenCalledWith(
			"task-genius:task-completed",
			expect.objectContaining({ completed: true, status: "done" }),
		);
	});

	it("abandoned update sets completed false, writes cancelled date, and does not trigger completion event or recurrence", async () => {
		const h = createHarness({
			content: "- [ ] Task 🔁 every day",
			task: { metadata: { recurrence: "every day" } as any },
		});

		const result = await h.writeAPI.updateTaskStatus({
			taskId: "task-1",
			status: "cancelled",
		});

		expect(result.success).toBe(true);
		expect(h.fileContent).toContain("- [cancelled] Task");
		expect(h.fileContent).toMatch(/❌\s*\d{4}-\d{2}-\d{2}/);
		expect(h.fileContent.split("\n")).toHaveLength(1);
		expect((h.app as any).workspace.trigger).not.toHaveBeenCalledWith(
			"task-genius:task-completed",
			expect.anything(),
		);
	});

	it("completed to abandoned removes completed date and adds cancelled date", async () => {
		const h = createHarness({
			content: "- [done] Task ✅ 2025-01-01",
			task: { status: "done", completed: false },
		});

		const result = await h.writeAPI.updateTaskStatus({
			taskId: "task-1",
			status: "cancelled",
		});

		expect(result.success).toBe(true);
		expect(h.fileContent).not.toContain("✅ 2025-01-01");
		expect(h.fileContent).toMatch(/❌\s*\d{4}-\d{2}-\d{2}/);
	});

	it("stale completed false with already completed status does not duplicate date/event/recurrence", async () => {
		const h = createHarness({
			content: "- [done] Task ✅ 2025-01-01 🔁 every day",
			task: {
				status: "done",
				completed: false,
				metadata: { recurrence: "every day" } as any,
			},
		});

		const result = await h.writeAPI.updateTaskStatus({
			taskId: "task-1",
			status: "done",
		});

		expect(result.success).toBe(true);
		expect(h.fileContent.match(/✅/g)).toHaveLength(1);
		expect(h.fileContent.split("\n")).toHaveLength(1);
		expect((h.app as any).workspace.trigger).not.toHaveBeenCalledWith(
			"task-genius:task-completed",
			expect.anything(),
		);
	});

	it("configured in-progress alias adds start date", async () => {
		const h = createHarness({ content: "- [ ] Task" });

		const result = await h.writeAPI.updateTask({
			taskId: "task-1",
			updates: { status: "p" },
		});

		expect(result.success).toBe(true);
		expect(h.fileContent).toContain("- [p] Task");
		expect(h.fileContent).toMatch(/🛫\s*\d{4}-\d{2}-\d{2}/);
	});

	it("auto-date flags false suppress corresponding date actions", async () => {
		const h = createHarness({
			content: "- [done] Task ✅ 2025-01-01",
			task: { status: "done", completed: true },
			settings: {
				autoDateManager: {
					manageCompletedDate: false,
					manageCancelledDate: false,
					manageStartDate: false,
				},
			},
		});

		const result = await h.writeAPI.updateTaskStatus({
			taskId: "task-1",
			status: "cancelled",
		});

		expect(result.success).toBe(true);
		expect(h.fileContent).toContain("✅ 2025-01-01");
		expect(h.fileContent).not.toMatch(/❌\s*\d{4}-\d{2}-\d{2}/);
	});
	describe("WriteAPI completed checkbox synthesis", () => {
		it("createTask uses configured primary completed mark instead of hardcoded x", async () => {
			const h = createHarness({
				content: "",
				settings: {
					taskStatuses: {
						notStarted: " ",
						inProgress: ">|/|p",
						completed: "✓|done",
						abandoned: "-|cancelled",
					},
				},
			});

			const result = await h.writeAPI.createTask({
				content: "Done with checkmark",
				filePath: "WriteAPIStatus.md",
				completed: true,
			});

			expect(result.success).toBe(true);
			expect(h.fileContent).toContain("- [✓] Done with checkmark");
			expect(h.fileContent).not.toContain("- [x] Done with checkmark");
		});

		it("addTaskToCanvasNode uses configured primary completed mark before delegating to Canvas updater", async () => {
			const h = createHarness({
				content: JSON.stringify({ nodes: [], edges: [] }),
				settings: {
					taskStatuses: {
						notStarted: " ",
						inProgress: ">|/|p",
						completed: "✓|done",
						abandoned: "-|cancelled",
					},
				},
			});
			const addTaskSpy = jest
				.spyOn(h.writeAPI.canvasTaskUpdater, "addTaskToCanvasNode")
				.mockResolvedValue({ success: true });

			const result = await h.writeAPI.addTaskToCanvasNode({
				filePath: "Canvas.canvas",
				content: "Canvas done",
				completed: true,
			});

			expect(result.success).toBe(true);
			expect(addTaskSpy).toHaveBeenCalledWith(
				"Canvas.canvas",
				"- [✓] Canvas done",
				undefined,
				undefined,
			);
		});

		describe("WriteAPI ICS status mapping", () => {
			function createIcsHarness(statusConfig?: string) {
				return createHarness({
					content: "",
					task: {
						id: "ics-local-event-1",
						filePath: "ics://local/event-1",
						status: " ",
						completed: false,
						icsEvent: {
							uid: "event-1",
							summary: "Task",
							status: "CONFIRMED",
							providerCalendarId: "cal-1",
						},
						source: { id: "local" },
					} as any,
					settings: statusConfig
						? {
								taskStatuses: {
									notStarted: " ",
									inProgress: ">|/|p",
									completed: "x|X|done",
									abandoned: statusConfig,
								},
						  }
						: undefined,
				});
			}

			async function expectIcsStatus(
				updates: Partial<Task>,
				expectedIcsStatus: string,
				statusConfig?: string,
			) {
				const h = createIcsHarness(statusConfig);

				const result = await h.writeAPI.updateTask({
					taskId: "ics-local-event-1",
					updates,
				});

				expect(result.success).toBe(true);
				expect(h.updateEventMock).toHaveBeenCalledWith(
					"local",
					expect.objectContaining({
						event: expect.objectContaining({ status: expectedIcsStatus }),
					}),
				);
			}

			it("maps default abandoned '-' to ICS CANCELLED", async () => {
				await expectIcsStatus({ status: "-" }, "CANCELLED");
			});

			it("maps a configured abandoned alias to ICS CANCELLED", async () => {
				await expectIcsStatus(
					{ status: "abandoned" },
					"CANCELLED",
					"-|abandoned",
				);
			});

			it("maps a configured completed alias to ICS COMPLETED, not CANCELLED", async () => {
				await expectIcsStatus({ status: "done" }, "COMPLETED");
			});

			it("maps an in-progress status to ICS CONFIRMED", async () => {
				await expectIcsStatus({ status: "p" }, "CONFIRMED");
			});

			it("treats completed alias status as authoritative over stale completed false", async () => {
				await expectIcsStatus(
					{ status: "done", completed: false },
					"COMPLETED",
				);
			});

			it("treats abandoned status as authoritative over stale completed true", async () => {
				await expectIcsStatus(
					{ status: "abandoned", completed: true },
					"CANCELLED",
					"-|abandoned",
				);
			});

			it("treats in-progress status as authoritative over stale completed true", async () => {
				await expectIcsStatus(
					{ status: "p", completed: true },
					"CONFIRMED",
				);
			});

			it("maps completed true without status to ICS COMPLETED", async () => {
				await expectIcsStatus({ completed: true }, "COMPLETED");
			});

			it("maps completed false without status to ICS CONFIRMED", async () => {
				await expectIcsStatus({ completed: false }, "CONFIRMED");
			});
		});
	});
});
