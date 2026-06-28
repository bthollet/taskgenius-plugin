import type TaskProgressBarPlugin from "../../index";
import { t } from "../../translations/helper";
import { moveTaskCommand } from "../../commands/taskMover";
import {
	autoMoveCompletedTasksCommand,
	moveCompletedTasksCommand,
	moveIncompletedTasksCommand,
} from "../../commands/completedTaskMover";

/**
 * Editor-initiated document/domain bridge command registrations.
 *
 * These commands begin from an editor command callback, but delegate to task mover
 * implementations that may rewrite document ranges or move tasks across files.
 * Phase 2C only moves this registration boundary; command implementations and
 * registration conditions stay unchanged.
 */
export function registerTaskMovementBridgeCommands(
	plugin: TaskProgressBarPlugin,
): void {
	// Add command for moving tasks
	plugin.addCommand({
		id: "move-task-to-file",
		name: t("Move task to another file"),
		editorCheckCallback: (checking, editor, ctx) => {
			return moveTaskCommand(checking, editor, ctx, plugin);
		},
	});

	// Add commands for moving completed tasks
	if (plugin.settings.completedTaskMover.enableCompletedTaskMover) {
		// Command for moving all completed subtasks and their children
		plugin.addCommand({
			id: "move-completed-subtasks-to-file",
			name: t("Move all completed subtasks to another file"),
			editorCheckCallback: (checking, editor, ctx) => {
				return moveCompletedTasksCommand(
					checking,
					editor,
					ctx,
					plugin,
					"allCompleted",
				);
			},
		});

		// Command for moving direct completed children
		plugin.addCommand({
			id: "move-direct-completed-subtasks-to-file",
			name: t("Move direct completed subtasks to another file"),
			editorCheckCallback: (checking, editor, ctx) => {
				return moveCompletedTasksCommand(
					checking,
					editor,
					ctx,
					plugin,
					"directChildren",
				);
			},
		});

		// Command for moving all subtasks (completed and uncompleted)
		plugin.addCommand({
			id: "move-all-subtasks-to-file",
			name: t("Move all subtasks to another file"),
			editorCheckCallback: (checking, editor, ctx) => {
				return moveCompletedTasksCommand(
					checking,
					editor,
					ctx,
					plugin,
					"all",
				);
			},
		});

		// Auto-move commands (using default settings)
		if (plugin.settings.completedTaskMover.enableAutoMove) {
			plugin.addCommand({
				id: "auto-move-completed-subtasks",
				name: t("Auto-move completed subtasks to default file"),
				editorCheckCallback: (checking, editor, ctx) => {
					return autoMoveCompletedTasksCommand(
						checking,
						editor,
						ctx,
						plugin,
						"allCompleted",
					);
				},
			});

			plugin.addCommand({
				id: "auto-move-direct-completed-subtasks",
				name: t(
					"Auto-move direct completed subtasks to default file",
				),
				editorCheckCallback: (checking, editor, ctx) => {
					return autoMoveCompletedTasksCommand(
						checking,
						editor,
						ctx,
						plugin,
						"directChildren",
					);
				},
			});

			plugin.addCommand({
				id: "auto-move-all-subtasks",
				name: t("Auto-move all subtasks to default file"),
				editorCheckCallback: (checking, editor, ctx) => {
					return autoMoveCompletedTasksCommand(
						checking,
						editor,
						ctx,
						plugin,
						"all",
					);
				},
			});
		}
	}

	// Add commands for moving incomplete tasks
	if (plugin.settings.completedTaskMover.enableIncompletedTaskMover) {
		// Command for moving all incomplete subtasks and their children
		plugin.addCommand({
			id: "move-incompleted-subtasks-to-file",
			name: t("Move all incomplete subtasks to another file"),
			editorCheckCallback: (checking, editor, ctx) => {
				return moveIncompletedTasksCommand(
					checking,
					editor,
					ctx,
					plugin,
					"allIncompleted",
				);
			},
		});

		// Command for moving direct incomplete children
		plugin.addCommand({
			id: "move-direct-incompleted-subtasks-to-file",
			name: t("Move direct incomplete subtasks to another file"),
			editorCheckCallback: (checking, editor, ctx) => {
				return moveIncompletedTasksCommand(
					checking,
					editor,
					ctx,
					plugin,
					"directIncompletedChildren",
				);
			},
		});

		// Auto-move commands for incomplete tasks (using default settings)
		if (plugin.settings.completedTaskMover.enableIncompletedAutoMove) {
			plugin.addCommand({
				id: "auto-move-incomplete-subtasks",
				name: t("Auto-move incomplete subtasks to default file"),
				editorCheckCallback: (checking, editor, ctx) => {
					return autoMoveCompletedTasksCommand(
						checking,
						editor,
						ctx,
						plugin,
						"allIncompleted",
					);
				},
			});

			plugin.addCommand({
				id: "auto-move-direct-incomplete-subtasks",
				name: t(
					"Auto-move direct incomplete subtasks to default file",
				),
				editorCheckCallback: (checking, editor, ctx) => {
					return autoMoveCompletedTasksCommand(
						checking,
						editor,
						ctx,
						plugin,
						"directIncompletedChildren",
					);
				},
			});
		}
	}
}
