import type TaskProgressBarPlugin from "../../index";
import { registerEditorExtensions } from "./registerEditorExtensions";

/**
 * Phase 2A editor task module boundary.
 *
 * This is the stable registration entry point for editor task features. The
 * implementation remains behavior-preserving while later Phase 2B work extracts
 * domain side effects/projections from CodeMirror extension registration.
 */
export function registerEditorTaskModule(plugin: TaskProgressBarPlugin): void {
	registerEditorExtensions(plugin);
}
