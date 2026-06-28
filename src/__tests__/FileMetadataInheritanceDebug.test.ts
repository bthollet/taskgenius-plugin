/**
 * Debug File Metadata Inheritance
 */

import { MarkdownTaskParser } from "../dataflow/core/ConfigurableTaskParser";
import { getConfig } from "../common/task-parser-config";
import { createMockPlugin } from "./mockUtils";
import { DEFAULT_SETTINGS } from "../common/setting-definition";

describe("Debug File Metadata Inheritance", () => {
	test("should debug inheritance process", () => {
		const mockPlugin = createMockPlugin({
			...DEFAULT_SETTINGS,
			fileMetadataInheritance: {
				enabled: true,
				inheritFromFrontmatter: true,
				inheritFromFrontmatterForSubtasks: false,
			},
		});

		const config = getConfig("tasks", mockPlugin);
		console.log("Config fileMetadataInheritance:", config.fileMetadataInheritance);

		const parser = new MarkdownTaskParser(config);

		const content = "- [ ] Test task";
		const fileMetadata = {
			priority: "high",
			testField: "testValue",
		};

		const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

		// 检查 priority 字段在任务中是否正确继承
		const task = tasks[0];
		
		expect(tasks).toHaveLength(1);
		expect(task).toBeDefined();
		expect(task.metadata.priority).toBe(4);
		expect(task.metadata.testField).toBeUndefined();
		expect("testField" in task.metadata).toBe(false);
	});
});
