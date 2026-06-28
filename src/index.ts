import {
	addIcon,
	Menu,
	Notice,
	Platform,
	Plugin,
} from "obsidian";
import { updateProgressBarInElement } from "./components/features/read-mode/ReadModeProgressBarWidget";
import { applyTaskTextMarks } from "./components/features/read-mode/ReadModeTextMark";
import {
	DEFAULT_SETTINGS,
	TaskProgressBarSettings,
} from "./common/setting-definition";
import { TaskProgressBarSettingTab } from "./setting";
import { EditorView } from "@codemirror/view";
import { autoCompleteParentExtension } from "./editor-extensions/autocomplete/parent-task-updater";
import { updateWorkflowContextMenu } from "./editor-extensions/workflow/workflow-handler";
import {
	LETTER_PRIORITIES,
	TASK_PRIORITIES,
} from "./editor-extensions/ui-widgets/priority-picker";
import {
	migrateOldFilterOptions,
	taskFilterState,
	toggleTaskFilter,
} from "./editor-extensions/core/task-filter-panel";
import { Task } from "./types/task";
// Import the enhanced QuickCaptureModal and MinimalQuickCaptureModal
import { QuickCaptureModal } from "./components/features/quick-capture/modals/QuickCaptureModalWithSwitch";
import { MinimalQuickCaptureModal } from "./components/features/quick-capture/modals/MinimalQuickCaptureModalWithSwitch";
import { MinimalQuickCaptureSuggest } from "./components/features/quick-capture/suggest/MinimalQuickCaptureSuggest";
import { SuggestManager } from "@/components/ui/suggest";
import { t, initializeTranslations } from "./translations/helper";
import { TASK_VIEW_TYPE, TaskView } from "./pages/TaskView";
import { SettingsModal } from "./components/features/settings/SettingsModal";
import "./styles/global.scss";
import "./styles/setting.scss";
import "./styles/view.scss";
import "./styles/native-layout.scss";
import "./styles/view-config.scss";
import "./styles/task-status.scss";
import "./styles/task-selection.scss";
import "./styles/quadrant/quadrant.scss";
import "./styles/universal-suggest.scss";
import "./styles/widgets.scss";

import {
	TASK_SPECIFIC_VIEW_TYPE,
	TaskSpecificView,
} from "./pages/TaskSpecificView";
import {
	TIMELINE_SIDEBAR_VIEW_TYPE,
	TimelineSidebarView,
} from "./components/features/timeline-sidebar/TimelineSidebarView";
import { getStatusIcon, getTaskGeniusIcon } from "./icon";
import { RewardManager } from "./managers/reward-manager";
import { HabitManager } from "./managers/habit-manager";
import { TaskGeniusIconManager } from "./managers/icon-manager";
import { monitorTaskCompletedExtension } from "./editor-extensions/task-operations/completion-monitor";
import { IcsManager } from "./managers/ics-manager";
import { CalendarAuthManager } from "./managers/calendar-auth-manager";
import { FluentIntegration } from "./components/features/fluent/FluentIntegration";
import { ObsidianUriHandler } from "./utils/ObsidianUriHandler";
import {
	migrateSettings,
	repairStatusCycles,
} from "./utils/settings-migration";
import { createMigrationRegistry } from "./utils/migration";
import { VersionManager } from "./managers/version-manager";
import { RebuildProgressManager } from "./managers/rebuild-progress-manager";
import DesktopIntegrationManager from "./managers/desktop-integration-manager";
import { OnCompletionManager } from "./managers/completion-manager";
import {
	registerWidgetCommands,
	registerWidgetViews,
} from "./widgets/registerWidgets";
import { registerWidgetCodeBlock } from "./widgets/codeblock/WidgetCodeBlockProcessor";
import { registerTaskGeniusBasesViews } from "@/pages/bases/registerBasesViews";
import { TaskTimerExporter } from "./services/timer-export-service";
import { TaskTimerManager } from "./managers/timer-manager";
import { createDataflow } from "./dataflow/createDataflow";
import type { DataflowOrchestrator } from "./dataflow/Orchestrator";
import { WriteAPI } from "./dataflow/api/WriteAPI";
import { Events } from "./dataflow/events/Events";
import {
	installWorkspaceDragMonitor,
	registerRestrictedDnDViewTypes,
} from "./patches/workspace-dnd-patch";
import { FLUENT_TASK_VIEW } from "./pages/FluentTaskView";
import { QuickCaptureSuggest } from "@/editor-extensions/autocomplete/task-metadata-suggest";
import { WorkspaceManager } from "@/components/features/fluent/managers/WorkspaceManager";
import {
	registerTaskPriorityCommands,
	registerTaskSortingCommands,
	registerTaskStatusCycleCommands,
} from "./modules/editor-tasks/registerEditorTaskCommands";
import { registerTaskMovementBridgeCommands } from "./modules/editor-tasks/registerDocumentTaskBridgeCommands";
import { registerEditorTaskModule } from "./modules/editor-tasks/EditorTaskModule";
import { registerWorkflowBridgeCommands } from "./modules/editor-tasks/registerWorkflowBridgeCommands";
import { registerQuickCaptureCommands } from "./modules/editor-tasks/registerQuickCaptureCommands";
import { registerTaskTimerCommands } from "./modules/editor-tasks/registerTaskTimerCommands";
import {
	removePriorityAtCursor,
	setPriorityAtCursor,
} from "./utils/task/curosr-priority-utils";

export default class TaskProgressBarPlugin extends Plugin {
	settings: TaskProgressBarSettings;

	// Dataflow orchestrator instance (primary architecture)
	dataflowOrchestrator?: DataflowOrchestrator;

	// Write API for dataflow architecture
	writeAPI?: WriteAPI;

	// Resolves once all async cleanup work scheduled by onunload() has settled.
	// Obsidian's onunload() signature is sync (void), so async cleanup work has
	// to be fired off without awaiting. Tests and any code that needs to know
	// when the plugin is fully torn down should `await plugin.unloadComplete`.
	// Reset on each onload(); see W2 in the v10 Phase 0 plan.
	public unloadComplete: Promise<void> = Promise.resolve();

	// Notification manager (desktop)
	notificationManager?: DesktopIntegrationManager;

	rewardManager: RewardManager;

	habitManager: HabitManager;

	// Task timer manager and exporter
	taskTimerManager: TaskTimerManager;
	taskTimerExporter: TaskTimerExporter;

	// ICS manager instance
	icsManager: IcsManager;

	// Calendar auth manager instance (for OAuth providers)
	calendarAuthManager?: CalendarAuthManager;

	// Minimal quick capture suggest
	minimalQuickCaptureSuggest: MinimalQuickCaptureSuggest;

	// Regular quick capture suggest
	quickCaptureSuggest: QuickCaptureSuggest;

	// Global suggest manager
	globalSuggestManager: SuggestManager;

	// Version manager instance
	versionManager: VersionManager;

	// Rebuild progress manager instance
	rebuildProgressManager: RebuildProgressManager;

	// Preloaded tasks:
	preloadedTasks: Task[] = [];

	// Setting tab
	settingTab: TaskProgressBarSettingTab;

	// Workspace manager instance
	workspaceManager?: WorkspaceManager;

	// Task Genius Icon manager instance
	taskGeniusIconManager: TaskGeniusIconManager;

	// URI handler instance
	uriHandler?: ObsidianUriHandler;

	mcpServerManager?: any;

	// OnCompletion manager instance
	onCompletionManager?: OnCompletionManager;

	// fluent Integration instance
	fluentIntegration?: FluentIntegration;

	// Deferred initialization guards
	private coreCommandsRegistered = false;
	private viewsRegistered = false;
	private viewCommandsRegistered = false;
	private extendedCommandsScheduled = false;
	private editorExtensionsRegistered = false;
	private iconsDeferred = false;

	async onload() {
		console.time("[Task Genius] onload");
		await initializeTranslations();
		await this.loadSettings();

		// Initialize version manager first
		this.versionManager = new VersionManager(this.app, this);
		this.addChild(this.versionManager);

		// Initialize global suggest manager
		this.globalSuggestManager = new SuggestManager(this.app, this);

		this.workspaceManager = new WorkspaceManager(this);
		this.workspaceManager.ensureDefaultWorkspaceInvariant();

		// Initialize URI handler
		this.uriHandler = new ObsidianUriHandler(this);
		this.uriHandler.register();

		// Initialize rebuild progress manager
		this.rebuildProgressManager = new RebuildProgressManager();

		if (this.settings.enableIndexer && this.settings.enableView) {
			this.loadViews();
		}

		this.settingTab = new TaskProgressBarSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				if (this.settings.enablePriorityKeyboardShortcuts) {
					menu.addItem((item) => {
						item.setTitle(t("Set priority"));
						item.setIcon("list-ordered");
						// @ts-ignore
						const submenu = item.setSubmenu() as Menu;
						// Emoji priority commands
						Object.entries(TASK_PRIORITIES).forEach(
							([key, priority]) => {
								if (key !== "none") {
									submenu.addItem((item) => {
										item.setTitle(
											`${t("Set priority")}: ${
												priority.text
											}`,
										);
										item.setIcon("arrow-big-up-dash");
										item.onClick(() => {
											setPriorityAtCursor(
												editor,
												priority.emoji,
											);
										});
									});
								}
							},
						);

						submenu.addSeparator();

						// Letter priority commands
						Object.entries(LETTER_PRIORITIES).forEach(
							([key, priority]) => {
								submenu.addItem((item) => {
									item.setTitle(
										`${t("Set priority")}: ${key}`,
									);
									item.setIcon("a-arrow-up");
									item.onClick(() => {
										setPriorityAtCursor(
											editor,
											`[#${key}]`,
										);
									});
								});
							},
						);

						// Remove priority command
						submenu.addItem((item) => {
							item.setTitle(t("Remove Priority"));
							item.setIcon("list-x");
							// @ts-ignore
							item.setWarning(true);
							item.onClick(() => {
								removePriorityAtCursor(editor);
							});
						});
					});
				}

				// Add workflow context menu
				if (this.settings.workflow.enableWorkflow) {
					updateWorkflowContextMenu(menu, editor, this);
				}
			}),
		);

		this.app.workspace.onLayoutReady(async () => {
			console.time("[Task Genius] onLayoutReady");

			await this.initializeDeferredStartup();

			// Update workspace leaves when layout is ready
			const deferWorkspaceLeaves =
				this.app.workspace.getLeavesOfType(TASK_VIEW_TYPE);
			const deferSpecificLeaves = this.app.workspace.getLeavesOfType(
				TASK_SPECIFIC_VIEW_TYPE,
			);
			const deferTaskGeniusLeaves =
				this.app.workspace.getLeavesOfType(FLUENT_TASK_VIEW);
			[
				...deferWorkspaceLeaves,
				...deferSpecificLeaves,
				...deferTaskGeniusLeaves,
			].forEach((leaf) => {
				leaf.loadIfDeferred();
			});
			// Initialize Task Genius Icon Manager
			this.taskGeniusIconManager = new TaskGeniusIconManager(this);
			this.addChild(this.taskGeniusIconManager);

			// Initialize Notification Manager (desktop only)
			if (Platform.isDesktopApp) {
				this.notificationManager = new DesktopIntegrationManager(this);
				this.addChild(this.notificationManager);

				// Subscribe to task cache updates to inform notifications
				this.registerEvent(
					this.app.workspace.on(
						Events.TASK_CACHE_UPDATED as any,
						() => this.notificationManager?.onTaskCacheUpdated(),
					),
				);
			}

			if (this.settings.autoCompleteParent) {
				this.registerEditorExtension([
					autoCompleteParentExtension(this.app, this),
				]);
			}

			this.registerMarkdownPostProcessor((el, ctx) => {
				// Apply custom task text marks (replaces checkboxes with styled marks)
				if (this.settings.enableTaskStatusSwitcher) {
					applyTaskTextMarks({
						plugin: this,
						element: el,
						ctx: ctx,
					});
				}

				// Apply progress bars (existing functionality)
				if (
					this.settings.enableProgressbarInReadingMode &&
					this.settings.progressBarDisplayMode !== "none"
				) {
					updateProgressBarInElement({
						plugin: this,
						element: el,
						ctx: ctx,
					});
				}
			});

			if (this.settings.habit.enableHabits) {
				this.habitManager = new HabitManager(this);
				this.addChild(this.habitManager);
			}

			// Initialize Calendar Auth Manager for OAuth providers
			this.calendarAuthManager = new CalendarAuthManager();
			this.addChild(this.calendarAuthManager);
			this.calendarAuthManager.registerProtocolHandler(this);

			// Initialize ICS manager if sources are configured
			if (this.settings.icsIntegration.sources.length > 0) {
				this.icsManager = new IcsManager(
					this.settings.icsIntegration,
					this.settings,
					this,
					undefined, // timeParsingService
					this.calendarAuthManager, // Pass auth manager for OAuth providers
				);
				this.addChild(this.icsManager);

				// Initialize ICS manager
				this.icsManager.initialize().catch((error) => {
					console.error("Failed to initialize ICS manager:", error);
				});
			}

			// Auto-open timeline sidebar if enabled
			if (
				this.settings.timelineSidebar.enableTimelineSidebar &&
				this.settings.timelineSidebar.autoOpenOnStartup
			) {
				// Delay opening to ensure workspace is ready
				setTimeout(() => {
					this.activateTimelineSidebarView().catch((error) => {
						console.error(
							"Failed to auto-open timeline sidebar:",
							error,
						);
					});
				}, 1000);
			}

			console.timeEnd("[Task Genius] onLayoutReady");
		});

		await this.migratePresetTaskFiltersIfNeeded();

		this.registerCoreCommands();

		console.timeEnd("[Task Genius] onload");
	}

	private async initializeDeferredStartup(): Promise<void> {
		if (!this.settings.enableIndexer) {
			this.scheduleExtendedCommands();
			return;
		}

		console.time("[Task Genius] initializeIndexer");

		await this.ensureFluentIntegration();

		this.registerTaskViews();
		this.installWorkspaceGuards();
		this.registerViewCommands();
		this.deferIconRegistration();

		const dataflowInitialized = await this.initializeDataflowOrchestrator();
		if (!dataflowInitialized) {
			this.scheduleExtendedCommands();
			console.timeEnd("[Task Genius] initializeIndexer");
			return;
		}

		try {
			await this.initializeDataflowWithVersionCheck();
		} catch (error) {
			console.error(
				"[Plugin] Dataflow version check failed during startup:",
				error,
			);
		}

		this.initializeWriteAPI();
		this.initializeOnCompletionManager();

		if (this.settings.rewards.enableRewards) {
			this.initializeRewardManager();
		}

		this.scheduleExtendedCommands();

		console.timeEnd("[Task Genius] initializeIndexer");
	}

	private async ensureFluentIntegration(): Promise<void> {
		if (this.fluentIntegration) {
			return;
		}

		this.fluentIntegration = new FluentIntegration(this);
		await this.fluentIntegration.migrateSettings();
		this.fluentIntegration.register();
	}

	private registerTaskViews(): void {
		if (this.viewsRegistered) {
			return;
		}
		this.viewsRegistered = true;

		// this.registerView(FLUENT_TASK_VIEW, (leaf) => new TaskView(leaf, this));

		this.registerView(
			TASK_SPECIFIC_VIEW_TYPE,
			(leaf) => new TaskSpecificView(leaf, this),
		);

		this.registerView(
			TIMELINE_SIDEBAR_VIEW_TYPE,
			(leaf) => new TimelineSidebarView(leaf, this),
		);

		try {
			registerTaskGeniusBasesViews(this);
		} catch (error) {
			console.log("Failed to register Bases views:", error);
		}

		try {
			registerWidgetViews(this);
		} catch (error) {
			console.log("Failed to register Widget views:", error);
		}
	}

	private registerViewCommands(): void {
		if (this.viewCommandsRegistered) {
			return;
		}
		this.viewCommandsRegistered = true;

		this.addCommand({
			id: "open-task-genius-view",
			name: t("Open Task Genius view"),
			callback: () => {
				this.activateTaskView();
			},
		});

		this.addCommand({
			id: "open-timeline-sidebar-view",
			name: t("Open Timeline Sidebar"),
			callback: () => {
				this.activateTimelineSidebarView();
			},
		});

		this.addCommand({
			id: "open-task-genius-settings-modal",
			name: t("Open Task Genius settings"),
			callback: () => {
				this.openSettingsModal();
			},
		});

		try {
			registerWidgetCommands(this);
		} catch (error) {
			console.log("Failed to register Widget commands:", error);
		}

		try {
			registerWidgetCodeBlock(this);
		} catch (error) {
			console.log(
				"Failed to register Widget codeblock processor:",
				error,
			);
		}
	}

	private deferIconRegistration(): void {
		if (this.iconsDeferred) {
			return;
		}
		this.iconsDeferred = true;

		const registerIcons = () => {
			addIcon("task-genius", getTaskGeniusIcon());
			addIcon("completed", getStatusIcon("completed"));
			addIcon("inProgress", getStatusIcon("inProgress"));
			addIcon("planned", getStatusIcon("planned"));
			addIcon("abandoned", getStatusIcon("abandoned"));
			addIcon("notStarted", getStatusIcon("notStarted"));

			this.addRibbonIcon(
				"task-genius",
				t("Open Task Genius view"),
				() => {
					this.activateTaskView();
				},
			);
		};

		const idle = (window as any)?.requestIdleCallback;
		if (typeof idle === "function") {
			idle(registerIcons);
		} else {
			setTimeout(registerIcons, 0);
		}
	}

	private installWorkspaceGuards(): void {
		installWorkspaceDragMonitor(this);
		try {
			registerRestrictedDnDViewTypes(FLUENT_TASK_VIEW);
		} catch {}
	}

	private async initializeDataflowOrchestrator(): Promise<boolean> {
		try {
			this.dataflowOrchestrator = await createDataflow(
				this.app,
				this.app.vault,
				this.app.metadataCache,
				this,
				{
					configFileName:
						this.settings.projectConfig?.configFile?.fileName ||
						"project.md",
					searchRecursively:
						this.settings.projectConfig?.configFile
							?.searchRecursively ?? true,
					metadataKey:
						this.settings.projectConfig?.metadataConfig
							?.metadataKey || "project",
					pathMappings:
						this.settings.projectConfig?.pathMappings || [],
					metadataMappings:
						this.settings.projectConfig?.metadataMappings || [],
					defaultProjectNaming: this.settings.projectConfig
						?.defaultProjectNaming || {
						strategy: "filename",
						stripExtension: true,
						enabled: false,
					},
					enhancedProjectEnabled:
						this.settings.projectConfig?.enableEnhancedProject ??
						false,
					metadataConfigEnabled:
						this.settings.projectConfig?.metadataConfig?.enabled ??
						false,
					configFileEnabled:
						this.settings.projectConfig?.configFile?.enabled ??
						false,
					detectionMethods:
						this.settings.projectConfig?.metadataConfig
							?.detectionMethods || [],
				},
			);
			return true;
		} catch (error) {
			console.error(
				"[Plugin] Failed to initialize dataflow orchestrator:",
				error,
			);
			new Notice(
				t("Failed to initialize task system. Please restart Obsidian."),
			);
			this.dataflowOrchestrator = undefined;
			return false;
		}
	}

	private initializeWriteAPI(): void {
		const dataflow = this.dataflowOrchestrator;
		if (!dataflow) {
			return;
		}

		const repository = dataflow.getRepository();

		const getTaskById = async (id: string): Promise<Task | null> => {
			try {
				const task = await repository.getTaskById(id);
				return task ?? null;
			} catch (e) {
				console.warn("Failed to get task from dataflow", e);
				return null;
			}
		};

		this.writeAPI = new WriteAPI(
			this.app,
			this.app.vault,
			this.app.metadataCache,
			this,
			getTaskById,
		);
	}

	private initializeOnCompletionManager(): void {
		if (this.onCompletionManager) {
			return;
		}
		this.onCompletionManager = new OnCompletionManager(this.app, this);
		this.addChild(this.onCompletionManager);
		console.log("[Plugin] OnCompletionManager initialized");
	}

	private initializeRewardManager(): void {
		if (this.rewardManager) {
			return;
		}
		this.rewardManager = new RewardManager(this);
		this.addChild(this.rewardManager);

		this.registerEditorExtension([
			monitorTaskCompletedExtension(this.app, this),
		]);
	}

	private scheduleExtendedCommands(): void {
		if (this.extendedCommandsScheduled) {
			return;
		}
		this.extendedCommandsScheduled = true;

		setTimeout(() => {
			try {
				this.registerCommands();
				this.ensureEditorExtensionsRegistered();
			} catch (error) {
				console.error(
					"[Plugin] Failed registering deferred commands:",
					error,
				);
			}
		}, 100);
	}

	private ensureEditorExtensionsRegistered(): void {
		if (this.editorExtensionsRegistered) {
			return;
		}
		this.editorExtensionsRegistered = true;
		this.registerEditorExt();
	}

	private registerCoreCommands(): void {
		if (this.coreCommandsRegistered) {
			return;
		}
		this.coreCommandsRegistered = true;

		this.addCommand({
			id: "quick-capture",
			name: t("Quick Capture"),
			callback: () => {
				new QuickCaptureModal(this.app, this, undefined, true).open();
			},
		});

		this.addCommand({
			id: "minimal-quick-capture",
			name: t("Minimal Quick Capture"),
			callback: () => {
				new MinimalQuickCaptureModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: "quick-file-create",
			name: t("Quick File Create"),
			callback: () => {
				const modal = new QuickCaptureModal(this.app, this, {
					location: "file",
				});
				modal.open();
			},
		});

		this.addCommand({
			id: "toggle-task-filter",
			name: t("Toggle task filter panel"),
			editorCallback: (editor) => {
				const view = editor.cm as EditorView;
				if (!view) {
					return;
				}
				view.dispatch({
					effects: toggleTaskFilter.of(
						!view.state.field(taskFilterState),
					),
				});
			},
		});
	}

	private async migratePresetTaskFiltersIfNeeded(): Promise<void> {
		const presets = this.settings.taskFilter?.presetTaskFilters;
		if (!presets) {
			return;
		}

		console.time("[Task Genius] migratePresetTaskFilters");
		this.settings.taskFilter.presetTaskFilters = presets.map(
			(preset: any) => {
				if (preset.options) {
					preset.options = migrateOldFilterOptions(preset.options);
				}
				return preset;
			},
		);
		await this.saveSettings();
		console.timeEnd("[Task Genius] migratePresetTaskFilters");
	}

	registerCommands() {
		registerTaskSortingCommands(this);
		registerTaskStatusCycleCommands(this);

		if (this.settings.enableIndexer) {
			// // Add command to refresh the task index
			// this.addCommand({
			// 	id: "refresh-task-index",
			// 	name: t("Refresh task index"),
			// 	callback: async () => {
			// 		try {
			// 			new Notice(t("Refreshing task index..."));

			// 			// Check if dataflow is enabled
			// 			if (
			// 				this.settings?.enableIndexer &&
			// 				this.dataflowOrchestrator
			// 			) {
			// 				// Use dataflow orchestrator for refresh
			// 				console.log(
			// 					"[Command] Refreshing task index via dataflow",
			// 				);

			// 				// Re-scan all files to refresh the index
			// 				const files = this.app.vault.getMarkdownFiles();
			// 				const canvasFiles = this.app.vault
			// 					.getFiles()
			// 					.filter((f) => f.extension === "canvas");
			// 				const allFiles = [...files, ...canvasFiles];

			// 				// Process files in batches
			// 				const batchSize = 50;
			// 				for (
			// 					let i = 0;
			// 					i < allFiles.length;
			// 					i += batchSize
			// 				) {
			// 					const batch = allFiles.slice(i, i + batchSize);
			// 					await Promise.all(
			// 						batch.map((file) =>
			// 							(
			// 								this.dataflowOrchestrator as any
			// 							).processFileImmediate(file),
			// 						),
			// 					);
			// 				}

			// 				// Refresh ICS events if available
			// 				const icsSource = (this.dataflowOrchestrator as any)
			// 					.icsSource;
			// 				if (icsSource) {
			// 					await icsSource.refresh();
			// 				}
			// 			}
			// 			// else {
			// 			// 	// Use legacy task manager
			// 			// 	await this.taskManager.initialize();
			// 			// }

			// 			new Notice(t("Task index refreshed"));
			// 		} catch (error) {
			// 			console.error("Failed to refresh task index:", error);
			// 			new Notice(t("Failed to refresh task index"));
			// 		}
			// 	},
			// });

			// Add command to force reindex all tasks by clearing cache
			this.addCommand({
				id: "force-reindex-tasks",
				name: t("Force reindex all tasks"),
				callback: async () => {
					try {
						// Check if dataflow is enabled
						if (
							this.settings?.enableIndexer &&
							this.dataflowOrchestrator
						) {
							// Use dataflow orchestrator for force reindex
							console.log(
								"[Command] Force reindexing via dataflow",
							);
							new Notice(
								t(
									"Clearing task cache and rebuilding index...",
								),
							);

							// Clear all caches and rebuild from scratch
							await this.dataflowOrchestrator.rebuild();

							// Refresh ICS events after rebuild
							const icsSource = (
								this
									.dataflowOrchestrator as DataflowOrchestrator
							).icsSource;
							if (icsSource) {
								await icsSource.refresh();
							}

							new Notice(t("Task index completely rebuilt"));
						} else {
							// No dataflow available
							new Notice(t("Task system not initialized"));
						}
					} catch (error) {
						console.error("Failed to force reindex tasks:", error);
						new Notice(t("Failed to force reindex tasks"));
					}
				},
			});
		}

		// Habit commands
		this.addCommand({
			id: "reindex-habits",
			name: t("Reindex habits"),
			callback: async () => {
				try {
					await this.habitManager?.initializeHabits();
					new Notice(t("Habit index refreshed"));
				} catch (e) {
					console.error("Failed to reindex habits", e);
					new Notice(t("Failed to refresh habit index"));
				}
			},
		});

		registerTaskPriorityCommands(this);

		registerTaskMovementBridgeCommands(this);

		registerQuickCaptureCommands(this);

		registerWorkflowBridgeCommands(this);

		registerTaskTimerCommands(this);
	}

	registerEditorExt() {
		registerEditorTaskModule(this);
	}

	onunload() {
		// Synchronous cleanup paths run immediately. Asynchronous cleanup
		// (currently just dataflowOrchestrator.cleanup() which awaits Repository
		// persistence) is gathered into a single promise exposed as
		// `unloadComplete` so tests and any external observer can await full
		// teardown. Obsidian itself never awaits this — its onunload signature
		// is sync — but at least listeners + workers + persistence get a chance
		// to settle before the next plugin lifecycle, instead of racing.
		const asyncTasks: Array<Promise<void>> = [];

		// Clean up global suggest manager (sync)
		if (this.globalSuggestManager) {
			this.globalSuggestManager.cleanup();
		}

		// Bases views are automatically unregistered by Obsidian when plugin unloads

		// Clean up dataflow orchestrator (async — capture into asyncTasks)
		if (this.dataflowOrchestrator) {
			const orch = this.dataflowOrchestrator;
			// Null out immediately so any other code path that fires during
			// teardown can't reach into a half-cleaned-up orchestrator.
			this.dataflowOrchestrator = undefined;
			asyncTasks.push(
				orch.cleanup().catch((error) => {
					console.error(
						"Error cleaning up dataflow orchestrator:",
						error,
					);
				}),
			);
		}

		// Task Genius Icon Manager cleanup is handled automatically by Component system

		// Expose a promise so tests / external observers can know when async
		// cleanup is fully done. Never rejects — individual catches above
		// already log errors.
		this.unloadComplete = Promise.all(asyncTasks).then(() => undefined);
	}

	async closeAllViewsFromTaskGenius() {
		const { workspace } = this.app;
		const v1Leaves = workspace.getLeavesOfType(TASK_VIEW_TYPE);
		v1Leaves.forEach((leaf) => leaf.detach());
		const v2Leaves = workspace.getLeavesOfType(FLUENT_TASK_VIEW);
		v2Leaves.forEach((leaf) => leaf.detach());
		const specificLeaves = workspace.getLeavesOfType(
			TASK_SPECIFIC_VIEW_TYPE,
		);
		specificLeaves.forEach((leaf) => leaf.detach());
		const timelineLeaves = workspace.getLeavesOfType(
			TIMELINE_SIDEBAR_VIEW_TYPE,
		);
		timelineLeaves.forEach((leaf) => leaf.detach());
	}

	async loadSettings() {
		const savedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
		this.settings.changelog = Object.assign(
			{
				enabled: true,
				lastVersion: "",
			},
			this.settings.changelog ?? {},
		);
		try {
			console.debug(
				"[Plugin][loadSettings] fileMetadataInheritance (raw):",
				savedData?.fileMetadataInheritance,
			);
			console.debug(
				"[Plugin][loadSettings] fileMetadataInheritance (effective):",
				this.settings.fileMetadataInheritance,
			);
		} catch {}

		// Run migrations through the version-keyed registry. Phase 0 W1.
		// The legacy bundle step wraps the prior migrateSettings + inheritance
		// + fluent default-backfill paths under one atomic try/commit, so a
		// throw in any of them leaves settings untouched. The bundle reads
		// `savedData` to detect old projectConfig.metadataConfig.* keys that
		// got dropped during the Object.assign with DEFAULT_SETTINGS — we
		// stash it on the settings object briefly so the step can see it.
		try {
			(this.settings as any).__transient_savedData__ = savedData;
			const registry = createMigrationRegistry();
			const result = await registry.run(this.settings, {
				toVersion: this.manifest.version,
			});
			if (!result.ok) {
				console.error(
					"[Task Genius] MigrationRegistry run failed:",
					result.error,
				);
				// Fall back to the legacy direct calls so the user isn't left
				// in a half-migrated state. Behavior is identical to before W1.
				migrateSettings(this.settings);
				this.migrateInheritanceSettings(savedData);
			} else if (result.changed) {
				console.log(
					"[Task Genius] Migrations applied:",
					Object.values(result.results).flatMap((r) => r.details),
				);
			}
		} finally {
			delete (this.settings as any).__transient_savedData__;
		}

		// Repair and validate status cycles (independent of migration registry —
		// runs every load to clean up dynamically-corrupted state).
		if (this.settings.statusCycles) {
			this.settings.statusCycles = repairStatusCycles(
				this.settings.statusCycles,
			);
		}
	}

	private migrateInheritanceSettings(savedData: any) {
		// Check if old inheritance settings exist and new ones don't
		if (
			savedData?.projectConfig?.metadataConfig &&
			!savedData?.fileMetadataInheritance
		) {
			const oldConfig = savedData.projectConfig.metadataConfig;

			// Migrate to new structure
			this.settings.fileMetadataInheritance = {
				enabled: true,
				inheritFromFrontmatter:
					oldConfig.inheritFromFrontmatter ?? true,
				inheritFromFrontmatterForSubtasks:
					oldConfig.inheritFromFrontmatterForSubtasks ?? false,
			};

			// Remove old inheritance settings from project config
			if (this.settings.projectConfig?.metadataConfig) {
				delete (this.settings.projectConfig.metadataConfig as any)
					.inheritFromFrontmatter;
				delete (this.settings.projectConfig.metadataConfig as any)
					.inheritFromFrontmatterForSubtasks;
			}

			// Save the migrated settings
			this.saveSettings();
		}
	}

	async saveSettings() {
		try {
			console.debug(
				"[Plugin][saveSettings] fileMetadataInheritance:",
				this.settings?.fileMetadataInheritance,
			);
		} catch {}
		await this.saveData(this.settings);
	}

	async loadViews() {
		const defaultViews = DEFAULT_SETTINGS.viewConfiguration;

		// Ensure all default views exist in user settings
		if (!this.settings.viewConfiguration) {
			this.settings.viewConfiguration = [];
		}

		// Add any missing default views to user settings
		defaultViews.forEach((defaultView) => {
			const existingView = this.settings.viewConfiguration.find(
				(v) => v.id === defaultView.id,
			);
			if (!existingView) {
				this.settings.viewConfiguration.push({ ...defaultView });
			}
		});

		await this.saveSettings();
	}

	// Helper method to set priority at cursor position

	private isActivatingView = false;

	async activateTaskView() {
		// Prevent multiple simultaneous activations
		if (this.isActivatingView) {
			return;
		}

		this.isActivatingView = true;
		try {
			const { workspace } = this.app;

			// Always use Fluent View as the default
			const viewType = FLUENT_TASK_VIEW;
			// Check if view is already open
			const existingLeaves = workspace.getLeavesOfType(viewType);

			if (existingLeaves.length > 0) {
				// If view is already open, just reveal the first one
				workspace.revealLeaf(existingLeaves[0]);

				// Close any duplicate views
				for (let i = 1; i < existingLeaves.length; i++) {
					existingLeaves[i].detach();
				}
				return;
			}

			// Otherwise, create a new leaf and open the view
			const leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: viewType });
			await workspace.revealLeaf(leaf);
		} finally {
			this.isActivatingView = false;
		}
	}

	private isActivatingSidebar = false;

	async activateTimelineSidebarView() {
		// Prevent multiple simultaneous activations
		if (this.isActivatingSidebar) {
			return;
		}

		this.isActivatingSidebar = true;
		try {
			const { workspace } = this.app;

			// Check if view is already open
			const existingLeaves = workspace.getLeavesOfType(
				TIMELINE_SIDEBAR_VIEW_TYPE,
			);

			if (existingLeaves.length > 0) {
				// If view is already open, just reveal the first one
				workspace.revealLeaf(existingLeaves[0]);

				// Close any duplicate views
				for (let i = 1; i < existingLeaves.length; i++) {
					existingLeaves[i].detach();
				}
				return;
			}

			// Open in the right sidebar
			const leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: TIMELINE_SIDEBAR_VIEW_TYPE });
				workspace.revealLeaf(leaf);
			}
		} finally {
			this.isActivatingSidebar = false;
		}
	}

	async triggerViewUpdate() {
		// Update Task Views
		const taskViewLeaves =
			this.app.workspace.getLeavesOfType(TASK_VIEW_TYPE);
		if (taskViewLeaves.length > 0) {
			for (const leaf of taskViewLeaves) {
				if (leaf.view instanceof TaskView) {
					// Avoid overwriting existing tasks with empty preloadedTasks during settings updates
					if (
						Array.isArray(this.preloadedTasks) &&
						this.preloadedTasks.length > 0
					) {
						leaf.view.tasks = this.preloadedTasks;
					}
					leaf.view.triggerViewUpdate();
				}
			}
		}

		// Update Timeline Sidebar Views
		const timelineViewLeaves = this.app.workspace.getLeavesOfType(
			TIMELINE_SIDEBAR_VIEW_TYPE,
		);
		if (timelineViewLeaves.length > 0) {
			for (const leaf of timelineViewLeaves) {
				if (leaf.view instanceof TimelineSidebarView) {
					await leaf.view.triggerViewUpdate();
				}
			}
		}
	}

	/**
	 * Get the ICS manager instance
	 */
	getIcsManager(): IcsManager | undefined {
		return this.icsManager;
	}

	/**
	 * Get the Calendar Auth Manager instance
	 */
	getAuthManager(): CalendarAuthManager | undefined {
		return this.calendarAuthManager;
	}

	/**
	 * Initialize dataflow with version checking and rebuild handling
	 */
	private async initializeDataflowWithVersionCheck(): Promise<void> {
		if (!this.dataflowOrchestrator) {
			console.error("Dataflow orchestrator not available");
			return;
		}

		try {
			// Validate version storage integrity first
			const diagnosticInfo =
				await this.versionManager.getDiagnosticInfo();

			if (!diagnosticInfo.canWrite) {
				throw new Error(
					"Cannot write to version storage - storage may be corrupted",
				);
			}

			if (
				!diagnosticInfo.versionValid &&
				diagnosticInfo.previousVersion
			) {
				console.warn(
					"Invalid version data detected, attempting recovery",
				);
				await this.versionManager.recoverFromCorruptedVersion();
			}

			// Check for version changes
			const versionResult =
				await this.versionManager.checkVersionChange();

			if (versionResult.requiresRebuild) {
				console.log(
					`Task Genius (Dataflow): ${versionResult.rebuildReason}`,
				);

				// Get all supported files for progress tracking
				const allFiles = this.app.vault
					.getFiles()
					.filter(
						(file) =>
							file.extension === "md" ||
							file.extension === "canvas",
					);

				// Start rebuild progress tracking
				this.rebuildProgressManager.startRebuild(
					allFiles.length,
					versionResult.rebuildReason,
				);

				// After dataflow rebuild, refresh habits to keep in sync
				try {
					await this.habitManager?.initializeHabits();
				} catch (e) {
					console.warn("Failed to refresh habits after rebuild", e);
				}

				// Trigger dataflow rebuild
				await this.dataflowOrchestrator.rebuild();

				// Get final task count from dataflow
				const queryAPI = this.dataflowOrchestrator.getQueryAPI();
				const allTasks = await queryAPI.getAllTasks();
				const finalTaskCount = allTasks.length;

				// Mark rebuild as complete
				this.rebuildProgressManager.completeRebuild(finalTaskCount);

				// Mark version as processed
				await this.versionManager.markVersionProcessed();
			} else {
				// No rebuild needed, dataflow already initialized during creation
				console.log(
					"Task Genius (Dataflow): No rebuild needed, using existing cache",
				);
			}
		} catch (error) {
			console.error(
				"Error during dataflow initialization with version check:",
				error,
			);

			// Trigger emergency rebuild for dataflow
			try {
				const emergencyResult =
					await this.versionManager.handleEmergencyRebuild(
						`Dataflow initialization failed: ${error.message}`,
					);

				// Get all supported files for progress tracking
				const allFiles = this.app.vault
					.getFiles()
					.filter(
						(file) =>
							file.extension === "md" ||
							file.extension === "canvas",
					);

				// Start emergency rebuild
				this.rebuildProgressManager.startRebuild(
					allFiles.length,
					emergencyResult.rebuildReason,
				);

				// Force rebuild dataflow
				await this.dataflowOrchestrator.rebuild();

				// Get final task count
				const queryAPI = this.dataflowOrchestrator.getQueryAPI();
				const allTasks = await queryAPI.getAllTasks();
				const finalTaskCount = allTasks.length;

				// Mark emergency rebuild as complete
				this.rebuildProgressManager.completeRebuild(finalTaskCount);

				// Store current version
				await this.versionManager.markVersionProcessed();

				console.log(
					"Emergency dataflow rebuild completed successfully",
				);
			} catch (emergencyError) {
				console.error(
					"Emergency dataflow rebuild failed:",
					emergencyError,
				);
				throw emergencyError;
			}
		}
	}

	/**
	 * Initialize task manager with version checking and rebuild handling
	 * @deprecated This method is no longer used as TaskManager has been removed
	 * This method is kept for reference only and will be removed in future versions
	 */
	private async initializeTaskManagerWithVersionCheck(): Promise<void> {
		// This method is deprecated and should not be called
		console.warn(
			"initializeTaskManagerWithVersionCheck is deprecated and should not be used",
		);
		return Promise.resolve();
	}

	/**
	 * Open the settings modal
	 * @param tabId Optional tab ID to open directly
	 */
	openSettingsModal(tabId?: string): void {
		const modal = new SettingsModal(this.app, this);
		modal.open();
		if (tabId) {
			modal.openTab(tabId);
		}
	}
}
