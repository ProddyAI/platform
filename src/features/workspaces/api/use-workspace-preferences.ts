import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import type { DashboardWidget } from "../../../../convex/preferences";

export const useWorkspacePreferences = ({
	workspaceId,
}: {
	workspaceId: Id<"workspaces">;
}) => {
	const data = useQuery(api.preferences.getWorkspacePreferences, {
		workspaceId,
	});
	const isLoading = data === undefined;

	return { data, isLoading };
};

export const useUpdateWorkspacePreferences = () => {
	return useMutation(api.preferences.updateWorkspacePreferences);
};

export const useSidebarCollapsed = ({
	workspaceId,
}: {
	workspaceId: Id<"workspaces">;
}) => {
	const [isCollapsed, setIsCollapsedLocal] = useState(false);

	const { data: preferences, isLoading } = useWorkspacePreferences({
		workspaceId,
	});

	const updateSidebarCollapsed = useMutation(
		api.preferences.updateSidebarCollapsed
	);

	useEffect(() => {
		if (!isLoading && preferences) {
			setIsCollapsedLocal(preferences.sidebarCollapsed || false);
		}
	}, [preferences, isLoading]);

	const setIsCollapsed = (collapsed: boolean) => {
		setIsCollapsedLocal(collapsed);
		updateSidebarCollapsed({ workspaceId, isCollapsed: collapsed });
	};

	return [isCollapsed, setIsCollapsed] as const;
};

export const useDashboardWidgets = ({
	workspaceId,
}: {
	workspaceId: Id<"workspaces">;
}) => {
	type WidgetConfig = DashboardWidget;

	const defaultWidgets: WidgetConfig[] = [
		{
			id: "calendar",
			title: "Upcoming Events",
			description: "Shows events for the next 7 days",
			visible: true,
			size: "large",
		},
		{
			id: "mentions",
			title: "Mentions",
			description: "Shows messages where you were mentioned",
			visible: true,
			size: "small",
		},
		{
			id: "threads",
			title: "Thread Replies",
			description: "Shows replies to your message threads",
			visible: true,
			size: "small",
		},
		{
			id: "tasks",
			title: "Your Tasks",
			description: "Shows your assigned tasks",
			visible: true,
			size: "small",
		},
		{
			id: "cards",
			title: "Board Cards",
			description: "Shows your assigned board cards",
			visible: true,
			size: "small",
		},
		{
			id: "notes",
			title: "Recent Notes",
			description: "Shows recently updated notes",
			visible: true,
			size: "medium",
		},
		{
			id: "canvas",
			title: "Recent Canvas",
			description: "Shows recently updated canvas items",
			visible: true,
			size: "medium",
		},
	];

	const [widgets, setWidgetsLocal] = useState<WidgetConfig[]>(defaultWidgets);

	const { data: preferences, isLoading } = useWorkspacePreferences({
		workspaceId,
	});

	const updateDashboardWidgets = useMutation(
		api.preferences.updateDashboardWidgets
	);

	useEffect(() => {
		if (!isLoading && preferences && preferences.dashboardWidgets) {
			setWidgetsLocal(preferences.dashboardWidgets);
		}
	}, [preferences, isLoading]);

	const setWidgets = (
		newWidgetsOrUpdater:
			| WidgetConfig[]
			| ((prev: WidgetConfig[]) => WidgetConfig[])
	) => {
		if (typeof newWidgetsOrUpdater === "function") {
			setWidgetsLocal((prev) => {
				const newWidgets = newWidgetsOrUpdater(prev);
				updateDashboardWidgets({ workspaceId, dashboardWidgets: newWidgets });
				return newWidgets;
			});
		} else {
			setWidgetsLocal(newWidgetsOrUpdater);
			updateDashboardWidgets({
				workspaceId,
				dashboardWidgets: newWidgetsOrUpdater,
			});
		}
	};

	return [widgets, setWidgets] as const;
};
