export const LEGACY_WORKSPACE_VIEW_STATE_FIXTURE = {
	main: {
		id: "root",
		type: "split",
		children: [
			{
				id: "legacy-task-list-leaf",
				type: "leaf",
				state: {
					type: "task-genius-view",
					state: {
						activeViewId: "inbox",
					},
				},
			},
			{
				id: "legacy-specific-kanban-leaf",
				type: "leaf",
				state: {
					type: "task-genius-specific-view",
					state: {
						viewId: "kanban",
					},
				},
			},
		],
	},
	left: {
		id: "left-sidebar",
		type: "split",
		children: [
			{
				id: "legacy-timeline-leaf",
				type: "leaf",
				state: {
					type: "tg-timeline-sidebar-view",
					state: {},
				},
			},
		],
	},
	right: {
		id: "right-sidebar",
		type: "split",
		children: [
			{
				id: "archived-gantt-leaf",
				type: "leaf",
				state: {
					type: "fluent-task-genius-view",
					state: {
						activeViewId: "gantt",
					},
				},
			},
			{
				id: "archived-table-leaf",
				type: "leaf",
				state: {
					type: "fluent-task-genius-view",
					state: {
						activeViewId: "table",
					},
				},
			},
			{
				id: "archived-quadrant-leaf",
				type: "leaf",
				state: {
					type: "fluent-task-genius-view",
					state: {
						activeViewId: "quadrant",
					},
				},
			},
		],
	},
};

export const LEGACY_WORKSPACE_VIEW_TYPES = [
	"task-genius-view",
	"task-genius-specific-view",
	"fluent-task-genius-view",
	"tg-timeline-sidebar-view",
] as const;

export const LEGACY_WORKSPACE_ARCHIVED_VIEW_IDS = [
	"gantt",
	"table",
	"quadrant",
] as const;
