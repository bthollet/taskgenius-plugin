import type TaskProgressBarPlugin from "../index";
import { t } from "../translations/helper";
import {
	TASK_SPECIFIC_VIEW_TYPE,
	TaskSpecificView,
} from "../pages/TaskSpecificView";
import {
	TIMELINE_SIDEBAR_VIEW_TYPE,
	TimelineSidebarView,
} from "../components/features/timeline-sidebar/TimelineSidebarView";
import { registerTaskGeniusBasesViews } from "@/pages/bases/registerBasesViews";
import {
	registerWidgetCommands,
	registerWidgetViews,
} from "../widgets/registerWidgets";
import { registerWidgetCodeBlock } from "../widgets/codeblock/WidgetCodeBlockProcessor";

export function registerTaskViewShells(plugin: TaskProgressBarPlugin): void {
	// plugin.registerView(FLUENT_TASK_VIEW, (leaf) => new TaskView(leaf, plugin));

	plugin.registerView(
		TASK_SPECIFIC_VIEW_TYPE,
		(leaf) => new TaskSpecificView(leaf, plugin),
	);

	plugin.registerView(
		TIMELINE_SIDEBAR_VIEW_TYPE,
		(leaf) => new TimelineSidebarView(leaf, plugin),
	);

	try {
		registerTaskGeniusBasesViews(plugin);
	} catch (error) {
		console.log("Failed to register Bases views:", error);
	}

	try {
		registerWidgetViews(plugin);
	} catch (error) {
		console.log("Failed to register Widget views:", error);
	}
}

export function registerViewShellCommands(plugin: TaskProgressBarPlugin): void {
	plugin.addCommand({
		id: "open-task-genius-view",
		name: t("Open Task Genius view"),
		callback: () => {
			plugin.activateTaskView();
		},
	});

	plugin.addCommand({
		id: "open-timeline-sidebar-view",
		name: t("Open Timeline Sidebar"),
		callback: () => {
			plugin.activateTimelineSidebarView();
		},
	});

	plugin.addCommand({
		id: "open-task-genius-settings-modal",
		name: t("Open Task Genius settings"),
		callback: () => {
			plugin.openSettingsModal();
		},
	});

	try {
		registerWidgetCommands(plugin);
	} catch (error) {
		console.log("Failed to register Widget commands:", error);
	}

	try {
		registerWidgetCodeBlock(plugin);
	} catch (error) {
		console.log(
			"Failed to register Widget codeblock processor:",
			error,
		);
	}
}
