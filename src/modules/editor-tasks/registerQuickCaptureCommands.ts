import { EditorView } from "@codemirror/view";
import { MarkdownView, Notice } from "obsidian";
import type TaskProgressBarPlugin from "../../index";
import {
	quickCaptureExtension,
	quickCaptureState,
	toggleQuickCapture,
} from "../../editor-extensions/core/quick-capture-panel";
import { t } from "../../translations/helper";

/**
 * Editor/UI quick-capture command boundary.
 *
 * Phase 2E only moves the remaining quick-capture panel command
 * registrations out of index.ts. Core modal commands such as
 * quick-capture/minimal-quick-capture/quick-file-create stay in the core
 * command boundary where they were already registered.
 */
export function registerQuickCaptureCommands(
	plugin: TaskProgressBarPlugin,
): void {
	// Add command for toggling quick capture panel in editor
	plugin.addCommand({
		id: "toggle-quick-capture",
		name: t("Toggle quick capture panel in editor"),
		editorCallback: (editor) => {
			const editorView = editor.cm as EditorView;

			try {
				// Check if the state field exists
				const stateField = editorView.state.field(quickCaptureState);

				// Toggle the quick capture panel
				editorView.dispatch({
					effects: toggleQuickCapture.of(!stateField),
				});
			} catch (e) {
				// Field doesn't exist, create it with value true (to show panel)
				editorView.dispatch({
					effects: toggleQuickCapture.of(true),
				});
			}
		},
	});

	plugin.addCommand({
		id: "toggle-quick-capture-globally",
		name: t("Toggle quick capture panel in editor (Globally)"),
		callback: () => {
			const activeLeaf =
				plugin.app.workspace.getActiveViewOfType(MarkdownView);

			if (activeLeaf && activeLeaf.editor) {
				// If we're in a markdown editor, use the editor command
				const editorView = activeLeaf.editor.cm as EditorView;

				// Import necessary functions dynamically to avoid circular dependencies

				try {
					// Show the quick capture panel
					editorView.dispatch({
						effects: toggleQuickCapture.of(true),
					});
				} catch (e) {
					// No quick capture state found, try to add the extension first
					// This is a simplified approach and might not work in all cases
					plugin.registerEditorExtension([
						quickCaptureExtension(plugin.app, plugin),
					]);

					// Try again after registering the extension
					setTimeout(() => {
						try {
							editorView.dispatch({
								effects: toggleQuickCapture.of(true),
							});
						} catch (e) {
							new Notice(
								t(
									"Could not open quick capture panel in the current editor",
								),
							);
						}
					}, 100);
				}
			}
		},
	});
}
