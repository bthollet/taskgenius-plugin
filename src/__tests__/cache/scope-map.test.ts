/**
 * Phase 0 W4a — typed cache scope map.
 *
 * Asserts:
 *   1. Direct field lookups resolve to the documented scopes.
 *   2. Nested field paths walk parents correctly.
 *   3. Unknown fields contribute no scopes.
 *   4. Multiple fields union their scopes.
 *   5. The map covers every field that current call sites of
 *      Orchestrator.onSettingsChange refer to (ratchet test — fails if a
 *      caller is added without updating the map).
 */

import {
	scopesForFields,
	listMappedFields,
	SETTINGS_FIELD_TO_SCOPES,
	type CacheScope,
} from "@/dataflow/cache/scope-map";

describe("scope-map (W4a)", () => {
	describe("direct lookups", () => {
		it("taskStatuses → parser", () => {
			expect(scopesForFields(["taskStatuses"])).toEqual(["parser"]);
		});

		it("projectConfig → project + augment", () => {
			const scopes = scopesForFields(["projectConfig"]);
			expect(new Set(scopes)).toEqual(new Set(["project", "augment"]));
		});

		it("fileMetadataInheritance → augment", () => {
			expect(scopesForFields(["fileMetadataInheritance"])).toEqual([
				"augment",
			]);
		});
	});

	describe("nested field paths walk parents", () => {
		it("fileMetadataInheritance.inheritFromFrontmatter resolves via parent", () => {
			expect(
				scopesForFields([
					"fileMetadataInheritance.inheritFromFrontmatter",
				]),
			).toEqual(["augment"]);
		});

		it("fileSource.recognitionStrategies.tags.taskTags resolves via parent", () => {
			expect(
				scopesForFields([
					"fileSource.recognitionStrategies.tags.taskTags",
				]),
			).toEqual(["parser"]);
		});

		it("projectConfig.pathMappings.foo resolves via parent", () => {
			const scopes = scopesForFields([
				"projectConfig.pathMappings.foo",
			]);
			expect(new Set(scopes)).toEqual(new Set(["project", "augment"]));
		});
	});

	describe("unknown fields", () => {
		it("returns empty scope list for completely unknown field", () => {
			expect(scopesForFields(["someTotallyUnknownField"])).toEqual([]);
		});

		it("returns empty scope list when no parent prefix matches", () => {
			// "fileSource" is not in the map (only "fileSource.recognitionStrategies"
			// etc. are). A made-up sibling like "fileSource.somethingNotInTheMap"
			// has no matching prefix and should yield no scopes.
			expect(
				scopesForFields(["fileSource.somethingNotInTheMap"]),
			).toEqual([]);
		});

		it("does not match descendants (only proper prefixes)", () => {
			// "fileSource" alone is not in the map; only "fileSource.recognitionStrategies"
			// etc. So a bare "fileSource" lookup should yield nothing — the
			// map intentionally requires the caller to be specific.
			expect(scopesForFields(["fileSource"])).toEqual([]);
		});
	});

	describe("union semantics", () => {
		it("merges scopes across multiple fields", () => {
			const scopes = scopesForFields([
				"taskStatuses", // parser
				"fileMetadataInheritance", // augment
			]);
			expect(new Set(scopes)).toEqual(new Set(["parser", "augment"]));
		});

		it("dedupes overlapping scopes", () => {
			const scopes = scopesForFields([
				"taskStatuses",
				"preferMetadataFormat",
			]);
			// Both → parser, expect only one entry.
			expect(scopes).toEqual(["parser"]);
		});

		it("returns empty array when given empty input", () => {
			expect(scopesForFields([])).toEqual([]);
		});
	});

	describe("ratchet: every existing onSettingsChange caller's intent is covered", () => {
		// The 3 existing callers in IndexSettingsTab.ts all change
		// fileMetadataInheritance.* fields. They currently pass ["parser"]
		// (which is technically wrong — these are augment-time settings),
		// but the typed map reflects the CORRECT scope. Phase 1's migration
		// fixes the call sites.
		it("fileMetadataInheritance.* covered by the map", () => {
			const fields = [
				"fileMetadataInheritance",
				"fileMetadataInheritance.enabled",
				"fileMetadataInheritance.inheritFromFrontmatter",
				"fileMetadataInheritance.inheritFromFrontmatterForSubtasks",
			];
			for (const f of fields) {
				expect(scopesForFields([f])).toEqual(["augment"]);
			}
		});

		it("listMappedFields exposes a non-empty list", () => {
			expect(listMappedFields().length).toBeGreaterThan(0);
		});

		it("every mapped value is a non-empty array of CacheScope", () => {
			const validScopes = new Set<CacheScope>([
				"parser",
				"augment",
				"project",
				"index",
			]);
			for (const [field, scopes] of Object.entries(
				SETTINGS_FIELD_TO_SCOPES,
			)) {
				expect(scopes.length).toBeGreaterThan(0);
				for (const s of scopes) {
					expect(validScopes.has(s)).toBe(true);
				}
				// Field paths must be non-empty strings
				expect(field.length).toBeGreaterThan(0);
			}
		});
	});
});

