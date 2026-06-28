import type TaskProgressBarPlugin from "../../index";
import { TaskTimerExporter } from "../../services/timer-export-service";
import { TaskTimerManager } from "../../managers/timer-manager";
import { taskProgressBarExtension } from "../../editor-extensions/ui-widgets/progress-bar-widget";
import { taskTimerExtension } from "../../editor-extensions/date-time/task-timer";
import { taskStatusSwitcherExtension } from "../../editor-extensions/task-operations/status-switcher";
import { cycleCompleteStatusExtension } from "../../editor-extensions/task-operations/status-cycler";
import { workflowExtension } from "../../editor-extensions/workflow/workflow-handler";
import { workflowDecoratorExtension } from "../../editor-extensions/ui-widgets/workflow-decorator";
import { workflowRootEnterHandlerExtension } from "../../editor-extensions/workflow/workflow-enter-handler";
import { priorityPickerExtension } from "../../editor-extensions/ui-widgets/priority-picker";
import { datePickerExtension } from "../../editor-extensions/date-time/date-picker";
import { quickCaptureExtension } from "../../editor-extensions/core/quick-capture-panel";
import { taskFilterExtension } from "../../editor-extensions/core/task-filter-panel";
import { MinimalQuickCaptureSuggest } from "../../components/features/quick-capture/suggest/MinimalQuickCaptureSuggest";
import { taskGutterExtension } from "../../editor-extensions/task-operations/gutter-marker";
import { autoDateManagerExtension } from "../../editor-extensions/date-time/date-manager";
import { taskMarkCleanupExtension } from "../../editor-extensions/task-operations/mark-cleanup";

/**
 * Registers editor task extensions in the exact legacy bootstrap order.
 *
 * Phase 2A only moves this responsibility behind the editor task module
 * boundary. Do not reorder these calls: several CodeMirror transaction filters
 * depend on registration order. Phase 2B should move auto-date/completion,
 * workflow parent updates, gutter/timer metadata reads, and task-filter
 * projections behind explicit domain bridge/projection services.
 */
export function registerEditorExtensions(plugin: TaskProgressBarPlugin): void {
	// editor-only interaction/rendering: inline progress display.
	plugin.registerEditorExtension([
		taskProgressBarExtension(plugin.app, plugin),
	]);

	// editor projection/global-data-backed: timer state is managed/exported globally.
	if (plugin.settings.taskTimer?.enabled) {
		// Initialize task timer manager and exporter
		if (!plugin.taskTimerManager) {
			plugin.taskTimerManager = new TaskTimerManager(
				plugin.settings.taskTimer,
			);
		}
		if (!plugin.taskTimerExporter) {
			plugin.taskTimerExporter = new TaskTimerExporter(
				plugin.taskTimerManager,
			);
		}

		plugin.registerEditorExtension([taskTimerExtension(plugin)]);
	}

	// editor projection/global-data-backed: gutter markers read task metadata/state.
	plugin.settings.taskGutter.enableTaskGutter &&
		plugin.registerEditorExtension([taskGutterExtension(plugin.app, plugin)]);
	// editor-only interaction/rendering: status switcher UI.
	plugin.settings.enableTaskStatusSwitcher &&
		plugin.settings.enableCustomTaskMarks &&
		plugin.registerEditorExtension([
			taskStatusSwitcherExtension(plugin.app, plugin),
		]);

	// editor-only interaction/rendering: priority picker UI.
	if (plugin.settings.enablePriorityPicker) {
		plugin.registerEditorExtension([
			priorityPickerExtension(plugin.app, plugin),
		]);
	}

	// editor-only interaction/rendering: date picker UI.
	if (plugin.settings.enableDatePicker) {
		plugin.registerEditorExtension([datePickerExtension(plugin.app, plugin)]);
	}

	// editor-domain bridge: workflow handlers can update task/workflow state.
	if (plugin.settings.workflow.enableWorkflow) {
		plugin.registerEditorExtension([workflowExtension(plugin.app, plugin)]);
		plugin.registerEditorExtension([
			workflowDecoratorExtension(plugin.app, plugin),
		]);
		plugin.registerEditorExtension([
			workflowRootEnterHandlerExtension(plugin.app, plugin),
		]);
	}

	// CRITICAL: Register in reverse order of desired execution
	// (transactionFilters execute in reverse registration order)
	//
	// Desired execution order:
	//   1. cycleCompleteStatus (processes Obsidian toggle, cycles status)
	//   2. autoDateManager (adds/removes dates based on new status)
	//   3. workflow (updates workflow stages if needed)
	//
	// Registration order (reverse):
	//   1. workflow (already registered above)
	//   2. autoDateManager (register second, executes second)
	//   3. cycleCompleteStatus (register last, executes first)

	// editor-domain bridge: auto date has status/date side effects.
	if (plugin.settings.autoDateManager.enabled) {
		plugin.registerEditorExtension([
			autoDateManagerExtension(plugin.app, plugin),
		]);
	}

	// editor-domain bridge: status cycling mutates task status semantics.
	if (plugin.settings.enableCycleCompleteStatus) {
		plugin.registerEditorExtension([
			cycleCompleteStatusExtension(plugin.app, plugin),
		]);
	}

	// editor-only interaction/rendering: quick capture panel.
	if (plugin.settings.quickCapture.enableQuickCapture) {
		plugin.registerEditorExtension([
			quickCaptureExtension(plugin.app, plugin),
		]);
	}

	// editor-only interaction/rendering: minimal quick capture suggest.
	if (plugin.settings.quickCapture.enableMinimalMode) {
		plugin.minimalQuickCaptureSuggest = new MinimalQuickCaptureSuggest(
			plugin.app,
			plugin,
		);
		plugin.registerEditorSuggest(plugin.minimalQuickCaptureSuggest);
	}

	// editor projection/global-data-backed: task filter decorations project task/filter state.
	if (plugin.settings.taskFilter.enableTaskFilter) {
		plugin.registerEditorExtension([taskFilterExtension(plugin)]);
	}

	// editor-only interaction/rendering: task mark cleanup extension (always enabled).
	plugin.registerEditorExtension([taskMarkCleanupExtension()]);
}
