import type TaskProgressBarPlugin from "../index";
import { EditorView } from "@codemirror/view";
import { QuickCaptureModal } from "../components/features/quick-capture/modals/QuickCaptureModalWithSwitch";
import { MinimalQuickCaptureModal } from "../components/features/quick-capture/modals/MinimalQuickCaptureModalWithSwitch";
import {
	taskFilterState,
	toggleTaskFilter,
} from "../editor-extensions/core/task-filter-panel";
import { t } from "../translations/helper";

export function registerGlobalTaskCommands(
	plugin: TaskProgressBarPlugin,
): void {
	plugin.addCommand({
		id: "quick-capture",
		name: t("Quick Capture"),
		callback: () => {
			new QuickCaptureModal(plugin.app, plugin, undefined, true).open();
		},
	});

	plugin.addCommand({
		id: "minimal-quick-capture",
		name: t("Minimal Quick Capture"),
		callback: () => {
			new MinimalQuickCaptureModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "quick-file-create",
		name: t("Quick File Create"),
		callback: () => {
			const modal = new QuickCaptureModal(plugin.app, plugin, {
				location: "file",
			});
			modal.open();
		},
	});

	plugin.addCommand({
		id: "toggle-task-filter",
		name: t("Toggle task filter panel"),
		editorCallback: (editor) => {
			const view = editor.cm as EditorView;
			if (!view) {
				return;
			}
			view.dispatch({
				effects: toggleTaskFilter.of(!view.state.field(taskFilterState)),
			});
		},
	});
}
