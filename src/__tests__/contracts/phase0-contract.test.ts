import * as fs from "fs";
import * as path from "path";
import { DEFAULT_SETTINGS } from "@/common/setting-definition";
import {
	LEGACY_WORKSPACE_ARCHIVED_VIEW_IDS,
	LEGACY_WORKSPACE_VIEW_STATE_FIXTURE,
	LEGACY_WORKSPACE_VIEW_TYPES,
} from "./workspace-legacy.fixture";

const ROOT = path.resolve(__dirname, "../../..");
const readSource = (relativePath: string) =>
	fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const collectWorkspaceLeafStates = (node: unknown): Array<{
	type?: string;
	state?: Record<string, unknown>;
}> => {
	if (!node || typeof node !== "object") {
		return [];
	}

	const value = node as Record<string, unknown>;
	const current =
		value.type === "leaf" && value.state && typeof value.state === "object"
			? [value.state as { type?: string; state?: Record<string, unknown> }]
			: [];

	return Object.values(value).reduce<Array<{
		type?: string;
		state?: Record<string, unknown>;
	}>>(
		(acc, child) => acc.concat(collectWorkspaceLeafStates(child)),
		current,
	);
};

describe("Phase 0 public ID contracts", () => {
	test("registered Obsidian view type strings remain stable", () => {
		const contracts = [
			{
				file: "src/pages/TaskView.ts",
				exportName: "TASK_VIEW_TYPE",
				value: "task-genius-view",
			},
			{
				file: "src/pages/TaskSpecificView.ts",
				exportName: "TASK_SPECIFIC_VIEW_TYPE",
				value: "task-genius-specific-view",
			},
			{
				file: "src/pages/FluentTaskView.ts",
				exportName: "FLUENT_TASK_VIEW",
				value: "fluent-task-genius-view",
			},
			{
				file: "src/components/features/timeline-sidebar/TimelineSidebarView.ts",
				exportName: "TIMELINE_SIDEBAR_VIEW_TYPE",
				value: "tg-timeline-sidebar-view",
			},
			{
				file: "src/components/features/changelog/ChangelogView.ts",
				exportName: "CHANGELOG_VIEW_TYPE",
				value: "task-genius-changelog",
			},
			{
				file: "src/components/features/onboarding/OnboardingView.ts",
				exportName: "ONBOARDING_VIEW_TYPE",
				value: "task-genius-onboarding",
			},
		];

		for (const contract of contracts) {
			expect(readSource(contract.file)).toContain(
				`export const ${contract.exportName} = "${contract.value}"`,
			);
		}
	});

	test("default and legacy/archived view configuration IDs remain recognized", () => {
		const viewIds = DEFAULT_SETTINGS.viewConfiguration.map((view) => view.id);

		expect(viewIds).toEqual(
			expect.arrayContaining([
				"inbox",
				"projects",
				"forecast",
				"calendar",
				"kanban",
			]),
		);

		expect(viewIds).toEqual(
			expect.arrayContaining([
				"gantt",
				"table",
				"quadrant",
				"review",
				"habit",
				"tags",
			]),
		);
	});

	test("command IDs registered from index/bootstrap sources remain stable", () => {
		const commandContractFiles = [
			"src/index.ts",
			"src/bootstrap/registerViewShellModule.ts",
			"src/bootstrap/registerGlobalTaskModule.ts",
			"src/bootstrap/registerEditorModule.ts",
				"src/modules/editor-tasks/registerEditorTaskCommands.ts",
				"src/modules/editor-tasks/registerDocumentTaskBridgeCommands.ts",
				"src/modules/editor-tasks/registerWorkflowBridgeCommands.ts",
				"src/modules/editor-tasks/registerQuickCaptureCommands.ts",
				"src/modules/editor-tasks/registerTaskTimerCommands.ts",
		];
		const commandContractSource = commandContractFiles
			.map((file) => readSource(file))
			.join("\n");
		const literalCommandIds = Array.from(
			commandContractSource.matchAll(/id:\s*"([^"]+)"/g),
			(match) => match[1],
		);

		expect(literalCommandIds).toEqual(
			expect.arrayContaining([
				"open-task-genius-view",
				"open-timeline-sidebar-view",
				// NOTE: "open-task-genius-setup" and "open-task-genius-changelog"
				// were intentionally removed with the Onboarding/Changelog
				// subsystems during the slim-down refactor, so they are no longer
				// part of the command contract.
				"open-task-genius-settings-modal",
				"quick-capture",
				"minimal-quick-capture",
				"quick-file-create",
				"toggle-task-filter",
				"sort-tasks-by-due-date",
				"sort-tasks-in-entire-document",
				"cycle-task-status-forward",
				"cycle-task-status-backward",
				"force-reindex-tasks",
				"reindex-habits",
				"remove-priority",
				"move-task-to-file",
				"move-completed-subtasks-to-file",
				"move-direct-completed-subtasks-to-file",
				"move-all-subtasks-to-file",
				"auto-move-completed-subtasks",
				"auto-move-direct-completed-subtasks",
				"auto-move-all-subtasks",
				"move-incompleted-subtasks-to-file",
				"move-direct-incompleted-subtasks-to-file",
				"auto-move-incomplete-subtasks",
				"auto-move-direct-incomplete-subtasks",
				"toggle-quick-capture",
				"toggle-quick-capture-globally",
				"create-quick-workflow",
				"convert-task-to-workflow",
				"start-workflow-here",
				"convert-to-workflow-root",
				"duplicate-workflow",
				"workflow-quick-actions",
				"export-task-timer-data",
				"import-task-timer-data",
				"export-task-timer-yaml",
				"backup-task-timer-data",
				"show-task-timer-stats",
			]),
		);

		expect(commandContractSource).toContain("id: `set-priority-${key}`");
		expect(commandContractSource).toContain("id: `set-priority-letter-${key}`");
	});

	test("bootstrap editor module delegates to editor task module boundary", () => {
		const bootstrapSource = readSource("src/bootstrap/registerEditorModule.ts");
		const editorTaskModuleSource = readSource(
				"src/modules/editor-tasks/EditorTaskModule.ts",
		);

		expect(bootstrapSource).toContain(
			'import { registerEditorTaskModule } from "../modules/editor-tasks/EditorTaskModule";',
		);
		expect(bootstrapSource).toContain("registerEditorTaskModule(plugin);");
		expect(editorTaskModuleSource).toContain(
			"export function registerEditorTaskModule(plugin: TaskProgressBarPlugin): void",
		);
		expect(editorTaskModuleSource).toContain("registerEditorExtensions(plugin);");
	});

	test("default settings keep core/view/editor/integration keys", () => {
		expect(DEFAULT_SETTINGS).toEqual(
			expect.objectContaining({
				progressBarDisplayMode: expect.any(String),
				displayMode: expect.any(String),
				taskStatuses: expect.any(Object),
				taskStatusCycle: expect.any(Array),
				statusCycles: expect.any(Array),
				enableIndexer: expect.any(Boolean),
				viewConfiguration: expect.any(Array),
				defaultViewMode: expect.any(String),
				globalFilterRules: expect.any(Object),
				taskFilter: expect.any(Object),
				quickCapture: expect.any(Object),
				workflow: expect.any(Object),
				completedTaskMover: expect.any(Object),
				taskTimer: expect.any(Object),
				timelineSidebar: expect.any(Object),
				icsIntegration: expect.any(Object),
				fileSource: expect.any(Object),
				onboarding: expect.any(Object),
				changelog: expect.any(Object),
			}),
		);

		expect(DEFAULT_SETTINGS.quickCapture).toEqual(
			expect.objectContaining({
				enableQuickCapture: expect.any(Boolean),
				targetFile: expect.any(String),
				appendToFile: expect.any(String),
			}),
		);
		expect(DEFAULT_SETTINGS.workflow).toEqual(
			expect.objectContaining({
				enableWorkflow: expect.any(Boolean),
				definitions: expect.any(Array),
			}),
		);
		expect(DEFAULT_SETTINGS.timelineSidebar).toEqual(
			expect.objectContaining({
				enableTimelineSidebar: expect.any(Boolean),
				autoOpenOnStartup: expect.any(Boolean),
			}),
		);
	});

	test("legacy workspace fixture only uses recognized legacy view types and archived view IDs", () => {
		const knownViewTypes = new Set([
			"task-genius-view",
			"task-genius-specific-view",
			"fluent-task-genius-view",
			"tg-timeline-sidebar-view",
			"task-genius-changelog",
			"task-genius-onboarding",
		]);
		const knownViewIds = new Set(
			DEFAULT_SETTINGS.viewConfiguration.map((view) => view.id),
		);
		const fixtureStates = collectWorkspaceLeafStates(
			LEGACY_WORKSPACE_VIEW_STATE_FIXTURE,
		);

		expect(LEGACY_WORKSPACE_VIEW_TYPES).toEqual(
			expect.arrayContaining([
				"task-genius-view",
				"task-genius-specific-view",
				"fluent-task-genius-view",
				"tg-timeline-sidebar-view",
			]),
		);
		expect(LEGACY_WORKSPACE_ARCHIVED_VIEW_IDS).toEqual(
			expect.arrayContaining(["gantt", "table", "quadrant"]),
		);
		expect(fixtureStates.length).toBeGreaterThan(0);

		for (const state of fixtureStates) {
			expect(knownViewTypes.has(state.type as string)).toBe(true);
			const viewId = state.state?.activeViewId ?? state.state?.viewId;
			if (typeof viewId === "string") {
				expect(knownViewIds.has(viewId)).toBe(true);
			}
		}
	});
});
