/**
 * Phase 0 W4a — verify the typed sibling Orchestrator.onSettingsFieldsChanged
 * resolves field paths to scopes via the typed map and delegates to the
 * existing onSettingsChange.
 */

import { buildOrchestrator } from "./_fixtures/buildOrchestrator";

describe("Orchestrator.onSettingsFieldsChanged (W4a)", () => {
	it("delegates known fields to onSettingsChange with the right scopes", async () => {
		const fx = await buildOrchestrator();
		try {
			const onSettingsChange = jest.spyOn(
				fx.orchestrator,
				"onSettingsChange",
			);
			// Block the rebuild path so we don't actually rebuild during the test.
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});

			await fx.orchestrator.onSettingsFieldsChanged([
				"fileMetadataInheritance.inheritFromFrontmatter",
			]);

			expect(onSettingsChange).toHaveBeenCalledTimes(1);
			expect(onSettingsChange.mock.calls[0][0]).toEqual(["augment"]);

			onSettingsChange.mockRestore();
		} finally {
			await fx.dispose();
		}
	});

	it("merges scopes when multiple fields are passed", async () => {
		const fx = await buildOrchestrator();
		try {
			const onSettingsChange = jest.spyOn(
				fx.orchestrator,
				"onSettingsChange",
			);
			(fx.orchestrator as any).rebuild = jest.fn(async () => {});

			await fx.orchestrator.onSettingsFieldsChanged([
				"taskStatuses", // parser
				"projectConfig", // project + augment
			]);

			expect(onSettingsChange).toHaveBeenCalledTimes(1);
			const passedScopes = onSettingsChange.mock.calls[0][0] as string[];
			expect(new Set(passedScopes)).toEqual(
				new Set(["parser", "project", "augment"]),
			);

			onSettingsChange.mockRestore();
		} finally {
			await fx.dispose();
		}
	});

	it("skips delegation when no field maps to a scope, but still emits SETTINGS_CHANGED", async () => {
		const fx = await buildOrchestrator();
		try {
			const onSettingsChange = jest.spyOn(
				fx.orchestrator,
				"onSettingsChange",
			);

			const events: any[] = [];
			fx.app.workspace.on(
				"task-genius:settings-changed",
				(payload: any) => {
					events.push(payload);
				},
			);

			await fx.orchestrator.onSettingsFieldsChanged([
				"someTotallyUnknownField",
				"anotherUnknownField",
			]);

			// onSettingsChange should NOT have been invoked because no scopes resolved.
			expect(onSettingsChange).not.toHaveBeenCalled();
			// But the SETTINGS_CHANGED event should still fire so UI observers
			// can refresh.
			expect(events.length).toBe(1);
			expect(events[0].scopes).toEqual([]);
			expect(events[0].fields).toEqual([
				"someTotallyUnknownField",
				"anotherUnknownField",
			]);

			onSettingsChange.mockRestore();
		} finally {
			await fx.dispose();
		}
	});
});
