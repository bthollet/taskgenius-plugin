import { Notice } from "obsidian";
import type TaskProgressBarPlugin from "../../index";
import { TaskTimerManager } from "../../managers/timer-manager";
import { TaskTimerExporter } from "../../services/timer-export-service";

/**
 * Editor/global task-timer report/import/export command boundary.
 *
 * Phase 2E only moves timer command registrations out of index.ts while
 * preserving manager/exporter initialization, settings guards, command IDs,
 * callbacks, and Notice behavior.
 */
export function registerTaskTimerCommands(plugin: TaskProgressBarPlugin): void {
	// Task timer export/import commands
	// Ensure timer manager and exporter are initialized if timer is enabled
	if (plugin.settings.taskTimer?.enabled) {
		if (!plugin.taskTimerManager) {
			plugin.taskTimerManager = new TaskTimerManager(plugin.settings.taskTimer);
		}
		if (!plugin.taskTimerExporter) {
			plugin.taskTimerExporter = new TaskTimerExporter(
				plugin.taskTimerManager,
			);
		}
	}
	if (plugin.settings.taskTimer?.enabled && plugin.taskTimerExporter) {
		plugin.addCommand({
			id: "export-task-timer-data",
			name: "Export task timer data",
			callback: async () => {
				try {
					const stats = plugin.taskTimerExporter.getExportStats();
					if (stats.activeTimers === 0) {
						new Notice("No timer data to export");
						return;
					}

					const jsonData = plugin.taskTimerExporter.exportToJSON(true);

					// Create a blob and download link
					const blob = new Blob([jsonData], {
						type: "application/json",
					});
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = `task-timer-data-${
						new Date().toISOString().split("T")[0]
					}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					new Notice(`Exported ${stats.activeTimers} timer records`);
				} catch (error) {
					console.error("Error exporting timer data:", error);
					new Notice("Failed to export timer data");
				}
			},
		});

		plugin.addCommand({
			id: "import-task-timer-data",
			name: "Import task timer data",
			callback: async () => {
				try {
					// Create file input for JSON import
					const input = document.createElement("input");
					input.type = "file";
					input.accept = ".json";

					input.onchange = async (e) => {
						const file = (e.target as HTMLInputElement).files?.[0];
						if (!file) return;

						try {
							const text = await file.text();
							const success =
								plugin.taskTimerExporter.importFromJSON(text);

							if (success) {
								new Notice("Timer data imported successfully");
							} else {
								new Notice(
									"Failed to import timer data - invalid format",
								);
							}
						} catch (error) {
							console.error("Error importing timer data:", error);
							new Notice("Failed to import timer data");
						}
					};

					input.click();
				} catch (error) {
					console.error("Error setting up import:", error);
					new Notice("Failed to set up import");
				}
			},
		});

		plugin.addCommand({
			id: "export-task-timer-yaml",
			name: "Export task timer data (YAML)",
			callback: async () => {
				try {
					const stats = plugin.taskTimerExporter.getExportStats();
					if (stats.activeTimers === 0) {
						new Notice("No timer data to export");
						return;
					}

					const yamlData = plugin.taskTimerExporter.exportToYAML(true);

					// Create a blob and download link
					const blob = new Blob([yamlData], {
						type: "text/yaml",
					});
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = `task-timer-data-${
						new Date().toISOString().split("T")[0]
					}.yaml`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					new Notice(
						`Exported ${stats.activeTimers} timer records to YAML`,
					);
				} catch (error) {
					console.error("Error exporting timer data to YAML:", error);
					new Notice("Failed to export timer data to YAML");
				}
			},
		});

		plugin.addCommand({
			id: "backup-task-timer-data",
			name: "Create task timer backup",
			callback: async () => {
				try {
					const backupData = plugin.taskTimerExporter.createBackup();

					// Create a blob and download link
					const blob = new Blob([backupData], {
						type: "application/json",
					});
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = `task-timer-backup-${new Date()
						.toISOString()
						.replace(/[:.]/g, "-")}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					new Notice("Task timer backup created");
				} catch (error) {
					console.error("Error creating timer backup:", error);
					new Notice("Failed to create timer backup");
				}
			},
		});

		plugin.addCommand({
			id: "show-task-timer-stats",
			name: "Show task timer statistics",
			callback: () => {
				try {
					const stats = plugin.taskTimerExporter.getExportStats();

					let message = `Task Timer Statistics:\n`;
					message += `Active timers: ${stats.activeTimers}\n`;
					message += `Total duration: ${Math.round(
						stats.totalDuration / 60000,
					)} minutes\n`;

					if (stats.oldestTimer) {
						message += `Oldest timer: ${stats.oldestTimer}\n`;
					}
					if (stats.newestTimer) {
						message += `Newest timer: ${stats.newestTimer}`;
					}

					new Notice(message, 10000);
				} catch (error) {
					console.error("Error getting timer stats:", error);
					new Notice("Failed to get timer statistics");
				}
			},
		});
	}
}
