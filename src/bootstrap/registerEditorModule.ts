import type TaskProgressBarPlugin from "../index";
import { registerEditorTaskModule } from "../modules/editor-tasks/EditorTaskModule";

/**
 * Phase 1 bootstrap compatibility wrapper.
 *
 * Phase 2A moves editor task registration behind the editor-task module
 * boundary while keeping this scanned bootstrap entry point intact.
 */
export function registerEditorModule(plugin: TaskProgressBarPlugin): void {
	registerEditorTaskModule(plugin);
}
