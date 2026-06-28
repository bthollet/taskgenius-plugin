import type TaskProgressBarPlugin from "../../index";
import { t } from "../../translations/helper";
import {
	convertTaskToWorkflowCommand,
	convertToWorkflowRootCommand,
	createQuickWorkflowCommand,
	duplicateWorkflowCommand,
	showWorkflowQuickActionsCommand,
	startWorkflowHereCommand,
} from "../../commands/workflowCommands";

/**
 * Editor-initiated workflow/domain bridge command registrations.
 *
 * These commands begin from editor command callbacks, but delegate to the
 * workflow command implementations. Phase 2D only moves this registration
 * boundary; command implementations, IDs, conditions, and callbacks stay
 * unchanged.
 */
export function registerWorkflowBridgeCommands(
	plugin: TaskProgressBarPlugin,
): void {
	// Workflow commands
	if (plugin.settings.workflow.enableWorkflow) {
		plugin.addCommand({
			id: "create-quick-workflow",
			name: t("Create quick workflow"),
			editorCheckCallback: (checking, editor, ctx) => {
				return createQuickWorkflowCommand(checking, editor, ctx, plugin);
			},
		});

		plugin.addCommand({
			id: "convert-task-to-workflow",
			name: t("Convert task to workflow template"),
			editorCheckCallback: (checking, editor, ctx) => {
				return convertTaskToWorkflowCommand(checking, editor, ctx, plugin);
			},
		});

		plugin.addCommand({
			id: "start-workflow-here",
			name: t("Start workflow here"),
			editorCheckCallback: (checking, editor, ctx) => {
				return startWorkflowHereCommand(checking, editor, ctx, plugin);
			},
		});

		plugin.addCommand({
			id: "convert-to-workflow-root",
			name: t("Convert current task to workflow root"),
			editorCheckCallback: (checking, editor, ctx) => {
				return convertToWorkflowRootCommand(checking, editor, ctx, plugin);
			},
		});

		plugin.addCommand({
			id: "duplicate-workflow",
			name: t("Duplicate workflow"),
			editorCheckCallback: (checking, editor, ctx) => {
				return duplicateWorkflowCommand(checking, editor, ctx, plugin);
			},
		});

		plugin.addCommand({
			id: "workflow-quick-actions",
			name: t("Workflow quick actions"),
			editorCheckCallback: (checking, editor, ctx) => {
				return showWorkflowQuickActionsCommand(checking, editor, ctx, plugin);
			},
		});
	}
}
