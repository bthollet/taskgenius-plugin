import { Editor, editorInfoField, MarkdownView, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import type TaskProgressBarPlugin from "../../index";
import { t } from "../../translations/helper";
import { sortTasksInDocument } from "../../commands/sortTaskCommands";
import {
	cycleTaskStatusBackward,
	cycleTaskStatusForward,
} from "../../commands/taskCycleCommands";
import {
	LETTER_PRIORITIES,
	TASK_PRIORITIES,
} from "../../editor-extensions/ui-widgets/priority-picker";
import {
	removePriorityAtCursor,
	setPriorityAtCursor,
} from "../../utils/task/curosr-priority-utils";

/**
 * Editor-initiated task command registrations.
 *
 * Phase 2B only moves command registration behind an editor task module boundary.
 * Phase 2C+ can split pure editor-only cursor status/priority commands from
 * document/domain bridge commands such as sorting, whole-document mutations, and
 * cross-file movement.
 */
export function registerTaskSortingCommands(plugin: TaskProgressBarPlugin): void {
	if (plugin.settings.sortTasks) {
		plugin.addCommand({
			id: "sort-tasks-by-due-date",
			name: t("Sort Tasks in Section"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const editorView = (editor as any).cm as EditorView;
				if (!editorView) return;

				const changes = sortTasksInDocument(editorView, plugin, false);

				if (changes) {
					new Notice(
						t(
							"Tasks sorted (using settings). Change application needs refinement.",
						),
					);
				} else {
					// Notice is already handled within sortTasksInDocument if no changes or sorting disabled
				}
			},
		});

		plugin.addCommand({
			id: "sort-tasks-in-entire-document",
			name: t("Sort Tasks in Entire Document"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const editorView = (editor as any).cm as EditorView;
				if (!editorView) return;

				const changes = sortTasksInDocument(editorView, plugin, true);

				if (changes) {
					const info = editorView.state.field(editorInfoField);
					if (!info || !info.file) return;
					plugin.app.vault.process(info.file, (data) => {
						return changes;
					});
					new Notice(t("Entire document sorted (using settings)."));
				} else {
					new Notice(t("Tasks already sorted or no tasks found."));
				}
			},
		});
	}
}

export function registerTaskStatusCycleCommands(
	plugin: TaskProgressBarPlugin,
): void {
	// Add command for cycling task status forward
	plugin.addCommand({
		id: "cycle-task-status-forward",
		name: t("Cycle task status forward"),
		editorCheckCallback: (checking, editor, ctx) => {
			return cycleTaskStatusForward(checking, editor, ctx, plugin);
		},
	});

	// Add command for cycling task status backward
	plugin.addCommand({
		id: "cycle-task-status-backward",
		name: t("Cycle task status backward"),
		editorCheckCallback: (checking, editor, ctx) => {
			return cycleTaskStatusBackward(checking, editor, ctx, plugin);
		},
	});
}

export function registerTaskPriorityCommands(plugin: TaskProgressBarPlugin): void {
	// Add priority keyboard shortcuts commands
	if (plugin.settings.enablePriorityKeyboardShortcuts) {
		// Emoji priority commands
		Object.entries(TASK_PRIORITIES).forEach(([key, priority]) => {
			if (key !== "none") {
				plugin.addCommand({
					id: `set-priority-${key}`,
					name: `${t("Set priority")} ${priority.text}`,
					editorCallback: (editor) => {
						setPriorityAtCursor(editor, priority.emoji);
					},
				});
			}
		});

		// Letter priority commands
		Object.entries(LETTER_PRIORITIES).forEach(([key, priority]) => {
			plugin.addCommand({
				id: `set-priority-letter-${key}`,
				name: `${t("Set priority")} ${key}`,
				editorCallback: (editor) => {
					setPriorityAtCursor(editor, `[#${key}]`);
				},
			});
		});

		// Remove priority command
		plugin.addCommand({
			id: "remove-priority",
			name: t("Remove priority"),
			editorCallback: (editor) => {
				removePriorityAtCursor(editor);
			},
		});
	}
}
