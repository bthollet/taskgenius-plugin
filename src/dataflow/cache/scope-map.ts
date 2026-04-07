/**
 * Typed cache scope map.
 *
 * Phase 0 W4a — Background
 * ------------------------
 * `Orchestrator.onSettingsChange(scopes: string[])` takes a free-form list of
 * scope names and uses them to decide which cache namespaces to invalidate.
 * Today, every caller has to:
 *   1. know which scope name applies to the field they're touching
 *   2. spell it correctly (no type checking)
 *   3. remember to update its scopes if the field's caching impact changes
 *
 * That works for one or two callers but breaks down when settings consolidation
 * begins in Phase 1 (25 tabs → 7) and field paths shift around. This file gives
 * us a single source of truth for "which fields invalidate which cache scopes"
 * so the migration can be mechanical instead of error-prone.
 *
 * Usage
 * -----
 * Phase 0 ships this map and a `scopesForFields()` helper, but does NOT migrate
 * any existing callers. The new sibling method `Orchestrator.onSettingsFieldsChanged`
 * (added separately) wraps the existing onSettingsChange — Phase 1+ will switch
 * call sites over progressively as features are touched.
 *
 * The keys are dot-separated field paths into `TaskProgressBarSettings`. We
 * intentionally use string keys instead of `keyof` because (a) many fields
 * are nested objects whose entire subtree is one cache concern, and (b) Phase 1
 * will rename and consolidate these fields, so a stringly-typed map is more
 * resilient to refactoring than a structural type that fights every move.
 *
 * Discovery
 * ---------
 * The current set of mappings was derived by walking every existing caller of
 * `Orchestrator.onSettingsChange` (only 3 sites at the time of writing, all in
 * `IndexSettingsTab.ts`). Note: those callers currently pass `["parser"]` for
 * `fileMetadataInheritance` changes which is technically wrong — file metadata
 * inheritance is an augment-time concern. The map below reflects the CORRECT
 * mapping; Phase 1's migration will fix the call sites.
 */

/** The four cache namespaces the Orchestrator manages. */
export type CacheScope = "parser" | "augment" | "project" | "index";

/**
 * Field path → list of cache scopes that need invalidation when that field changes.
 *
 * Field paths are dot-separated (e.g. "fileSource.recognitionStrategies"). A path
 * matches both itself and any descendant — so a change to
 * "fileMetadataInheritance.inheritFromFrontmatter" matches the entry for
 * "fileMetadataInheritance".
 *
 * If a field is not in this map, it has no cache impact.
 */
export const SETTINGS_FIELD_TO_SCOPES: Readonly<
	Record<string, readonly CacheScope[]>
> = Object.freeze({
	// --- Parser scope ---
	// Anything that changes how raw markdown / canvas / file-metadata is parsed
	// into Task records. Invalidates the "raw" cache namespace.
	taskStatuses: ["parser"],
	preferMetadataFormat: ["parser"],
	enableCustomDateFormats: ["parser"],
	customDateFormats: ["parser"],
	projectTagPrefix: ["parser"],
	contextTagPrefix: ["parser"],
	areaTagPrefix: ["parser"],
	useDailyNotePathAsDate: ["parser"],
	dailyNoteFormat: ["parser"],
	useAsDateType: ["parser"],
	dailyNotePath: ["parser"],
	ignoreHeading: ["parser"],
	focusHeading: ["parser"],
	"fileSource.recognitionStrategies": ["parser"],
	"fileSource.fileTaskProperties": ["parser"],
	"fileSource.relationships": ["parser"],

	// --- Augment scope ---
	// Anything that changes how parsed tasks are merged with file/project metadata.
	// Invalidates the "augmented" cache namespace.
	fileMetadataInheritance: ["augment"],

	// --- Project scope ---
	// Anything that changes project detection or project metadata enrichment.
	// Invalidates "project" + "augment" namespaces (project changes ripple
	// through augmentation).
	projectConfig: ["project", "augment"],

	// --- Index scope ---
	// Anything that changes the consolidated index shape itself. Rare — most
	// settings are parser/augment concerns. Currently no fields use this.
	// Reserved for future use; left here as documentation.
});

/**
 * Resolve a list of changed field paths into the minimal set of cache scopes
 * that need invalidation. Unknown fields contribute no scopes (no cache impact).
 *
 * Field path matching is prefix-based on dotted segments: a change to
 * "fileMetadataInheritance.inheritFromFrontmatter" matches the entry for
 * "fileMetadataInheritance" (because "fileMetadataInheritance" is a prefix
 * along a `.` boundary). This lets callers pass either the parent or any
 * leaf without needing to know the granularity of the map.
 */
export function scopesForFields(
	fields: readonly string[],
): CacheScope[] {
	const out = new Set<CacheScope>();
	for (const field of fields) {
		const matchedScopes = lookupField(field);
		for (const s of matchedScopes) out.add(s);
	}
	return [...out];
}

/**
 * Look up the cache scopes for a single field path.
 *
 * Returns the scopes for the longest matching prefix in the map. For example:
 *   - "fileMetadataInheritance.inheritFromFrontmatter" → ["augment"]
 *     (matches "fileMetadataInheritance")
 *   - "fileSource.recognitionStrategies.tags.taskTags" → ["parser"]
 *     (matches "fileSource.recognitionStrategies")
 *   - "fileSource.somethingElse" → []
 *     (no entry, falls through)
 */
function lookupField(field: string): readonly CacheScope[] {
	// Direct hit
	if (field in SETTINGS_FIELD_TO_SCOPES) {
		return SETTINGS_FIELD_TO_SCOPES[field];
	}
	// Walk parents (drop one segment at a time from the right)
	let current = field;
	while (true) {
		const lastDot = current.lastIndexOf(".");
		if (lastDot === -1) return [];
		current = current.substring(0, lastDot);
		if (current in SETTINGS_FIELD_TO_SCOPES) {
			return SETTINGS_FIELD_TO_SCOPES[current];
		}
	}
}

/**
 * Test-only helper: enumerate every field path registered in the map. Used by
 * scope-map.test.ts to assert all known caller fields are covered without
 * having to import the test fixture.
 */
export function listMappedFields(): readonly string[] {
	return Object.keys(SETTINGS_FIELD_TO_SCOPES);
}
