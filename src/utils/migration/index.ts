/**
 * Migration entry point — Phase 0 W1.
 *
 * `createMigrationRegistry()` returns a registry pre-loaded with the steps
 * that should run on plugin load. The set is stable for Phase 0; Phase 1+
 * will add steps as features are deprecated.
 */

export {
	MigrationRegistry,
	compareSemver,
} from "./MigrationRegistry";
export type {
	MigrationKind,
	MigrationContext,
	MigrationStep,
	MigrationStepResult,
	MigrationRunResult,
} from "./MigrationRegistry";

import { MigrationRegistry } from "./MigrationRegistry";
import { legacyBundleStep } from "./steps/legacy-bundle-0";
import { sentinelTombstoneStep } from "./steps/tombstone-0.0.2-sentinel";

/**
 * Build the canonical registry used by the plugin at load time. Centralized
 * here so tests can construct an identical registry without depending on
 * `index.ts`.
 */
export function createMigrationRegistry(): MigrationRegistry {
	const registry = new MigrationRegistry();
	registry.register(legacyBundleStep);
	registry.register(sentinelTombstoneStep);
	return registry;
}
