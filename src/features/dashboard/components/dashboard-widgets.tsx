"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Edit3, GripVertical, Plus, X } from "lucide-react";
import { cloneElement, type ReactElement, useCallback, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardWidgets } from "@/features/workspaces/api/use-workspace-preferences";
import { cn } from "@/lib/utils";
import type {
	DashboardWidget,
	WidgetSize,
} from "../../../../convex/workspace/preferences";
import { AssignedCardsWidget } from "./widgets/assigned-cards-widget";
import { CalendarPreviewWidget } from "./widgets/calendar-preview-widget";
import { CanvasWidget } from "./widgets/canvas-widget";
import { MentionsWidget } from "./widgets/mentions-widget";
import { NotesWidget } from "./widgets/notes-widget";
import { StressWidget } from "./widgets/stress-widget";
import { TasksWidget } from "./widgets/tasks-widget";
import { TeamStatusWidget } from "./widgets/team-status-widget";
import { ThreadRepliesWidget } from "./widgets/thread-replies-widget";

interface DashboardWidgetsProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
}

// Widget types
type WidgetType =
	| "mentions"
	| "threads"
	| "tasks"
	| "cards"
	| "calendar"
	| "notes"
	| "canvas"
	| "team"
	| "stress";

// Available widgets configuration
const AVAILABLE_WIDGETS = [
	{
		id: "mentions",
		title: "Mentions",
		description: "Messages where you were mentioned",
	},
	{
		id: "threads",
		title: "Thread Replies",
		description: "Recent thread replies",
	},
	{ id: "tasks", title: "Tasks", description: "Your assigned tasks" },
	{
		id: "cards",
		title: "Assigned Issues",
		description: "Issues assigned to you",
	},
	{ id: "calendar", title: "Calendar Preview", description: "Upcoming events" },
	{ id: "notes", title: "Notes", description: "Recent notes" },
	{ id: "canvas", title: "Canvas", description: "Recent canvas items" },
	{
		id: "team",
		title: "Team Status",
		description: "See who's online and message teammates",
	},
	{
		id: "stress",
		title: "Stress & Focus",
		description: "AI-driven workload analysis and daily focus session",
	},
];

// Sortable widget wrapper component
interface SortableWidgetProps {
	id: string;
	children: React.ReactNode;
	size: "small" | "medium" | "large";
	isEditMode: boolean;
	onDelete: () => void;
	onResize: (newSize: "small" | "medium" | "large") => void;
}

const SortableWidget = ({
	id,
	children,
	size,
	isEditMode,
	onDelete,
	onResize,
}: SortableWidgetProps) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 1 : 0,
	};

	// Grid layout classes based on size
	const gridSizeClasses = {
		small: "col-span-1 md:col-span-3", // Small - 1/4 width on desktop
		medium: "col-span-1 md:col-span-6", // Medium - half width (6/12 columns)
		large: "col-span-1 md:col-span-12", // Large - Full width (12/12 columns)
	};

	const controls = isEditMode ? (
		<div className="flex items-center gap-2">
			{/* Size Toggle Buttons */}
			<div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5 shadow-sm">
				<Button
					aria-label="Small size"
					className="h-6 w-6 p-0 text-xs"
					onClick={() => onResize("small")}
					size="sm"
					variant={size === "small" ? "default" : "ghost"}
				>
					S
				</Button>
				<Button
					aria-label="Medium size"
					className="h-6 w-6 p-0 text-xs"
					onClick={() => onResize("medium")}
					size="sm"
					variant={size === "medium" ? "default" : "ghost"}
				>
					M
				</Button>
				<Button
					aria-label="Large size"
					className="h-6 w-6 p-0 text-xs"
					onClick={() => onResize("large")}
					size="sm"
					variant={size === "large" ? "default" : "ghost"}
				>
					L
				</Button>
			</div>

			{/* Delete Button */}
			<Button
				aria-label="Remove widget"
				className="h-8 w-8 border border-border bg-card p-0 shadow-sm hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
				onClick={onDelete}
				size="sm"
				variant="ghost"
			>
				<X className="h-4 w-4" />
			</Button>

			{/* Drag Handle */}
			<button
				aria-label="Reorder widget"
				className="cursor-grab rounded-full border border-border bg-card p-1.5 shadow-sm transition-fast hover:bg-muted/80 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				type="button"
				{...attributes}
				{...listeners}
			>
				<GripVertical className="h-4 w-4 text-muted-foreground" />
			</button>
		</div>
	) : null;

	return (
		<div
			className={cn(
				"relative group",
				gridSizeClasses[size],
				"h-auto",
				isDragging ? "z-10" : ""
			)}
			ref={setNodeRef}
			style={style}
		>
			{cloneElement(children as ReactElement, { controls })}
		</div>
	);
};

export const DashboardWidgets = ({
	workspaceId,
	member,
}: DashboardWidgetsProps) => {
	const [activeId, setActiveId] = useState<string | null>(null);
	const [isEditMode, setIsEditMode] = useState(false);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);

	// Use the Convex-backed dashboard widgets state
	const [widgets, setWidgets] = useDashboardWidgets({ workspaceId });

	// Set up sensors for drag and drop - only enabled in edit mode
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: isEditMode ? 5 : 999999, // Disable dragging when not in edit mode
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const toggleEditMode = () => {
		setIsEditMode((prev) => !prev);
	};

	// Handle drag start
	const handleDragStart = (event: DragStartEvent) => {
		if (isEditMode) {
			setActiveId(event.active.id as string);
		}
	};

	// Handle drag end
	const handleDragEnd = (event: DragEndEvent) => {
		if (!isEditMode) return;

		const { active, over } = event;

		if (over && active.id !== over.id) {
			setWidgets((items) => {
				const oldIndex = items.findIndex((item) => item.id === active.id);
				const newIndex = items.findIndex((item) => item.id === over.id);

				return arrayMove(items, oldIndex, newIndex);
			});
		}

		setActiveId(null);
	};

	// Toggle widget selection
	const toggleWidgetSelection = (widgetId: string) => {
		setSelectedWidgets((prev) =>
			prev.includes(widgetId)
				? prev.filter((id) => id !== widgetId)
				: [...prev, widgetId]
		);
	};

	// Add selected widgets
	const handleAddSelectedWidgets = () => {
		if (selectedWidgets.length === 0) return;

		const newWidgets = selectedWidgets
			.map((id) => {
				const widgetConfig = AVAILABLE_WIDGETS.find((w) => w.id === id);
				if (!widgetConfig) return null;

				return {
					id: widgetConfig.id,
					title: widgetConfig.title,
					description: widgetConfig.description,
					visible: true,
					size: "medium" as WidgetSize,
				};
			})
			.filter((widget): widget is DashboardWidget => widget !== null);

		setWidgets((prev) => [...prev, ...newWidgets]);
		setSelectedWidgets([]);
		setIsAddDialogOpen(false);
	};

	// Reset selections when dialog closes
	const handleDialogOpenChange = (open: boolean) => {
		setIsAddDialogOpen(open);
		if (!open) {
			setSelectedWidgets([]);
		}
	};

	// Delete widget
	const handleDeleteWidget = (id: string) => {
		setWidgets((prev) => prev.filter((widget) => widget.id !== id));
	};

	// Update widget size
	const updateWidgetSize = (id: string, size: WidgetSize) => {
		setWidgets((prev) =>
			prev.map((widget) => (widget.id === id ? { ...widget, size } : widget))
		);
	};

	// Get available widgets to add (not already in the dashboard)
	const availableWidgetsToAdd = AVAILABLE_WIDGETS.filter(
		(available) => !widgets.some((widget) => widget.id === available.id)
	);

	// Render the appropriate widget based on type
	const renderWidget = useCallback(
		(type: string) => {
			// Cast to WidgetType for switch statement
			const widgetType = type as WidgetType;
			switch (widgetType) {
				case "mentions":
					return (
						<MentionsWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				case "threads":
					return (
						<ThreadRepliesWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				case "tasks":
					return (
						<TasksWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				case "cards":
					return (
						<AssignedCardsWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				case "calendar":
					return (
						<CalendarPreviewWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				case "notes":
					return (
						<NotesWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);

				case "canvas":
					return (
						<CanvasWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				case "team":
					return (
						<TeamStatusWidget
							isEditMode={isEditMode}
							workspaceId={workspaceId}
						/>
					);
				case "stress":
					return (
						<StressWidget
							isEditMode={isEditMode}
							member={member}
							workspaceId={workspaceId}
						/>
					);
				default:
					return null;
			}
		},
		[workspaceId, member, isEditMode]
	);

	return (
		<>
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
						Workspace Overview
					</h2>
					<div className="flex items-center gap-2">
						{/* Add Widget Button - Only visible in edit mode */}
						{isEditMode && (
							<Button
								className="h-8 gap-2 px-3"
								disabled={availableWidgetsToAdd.length === 0}
								onClick={() => setIsAddDialogOpen(true)}
								size="sm"
								variant="outline"
							>
								<Plus className="h-4 w-4" />
								<span className="hidden sm:inline">Add Widget</span>
							</Button>
						)}

						{/* Edit Mode Toggle */}
						<Button
							className="h-8 gap-2 px-3"
							onClick={toggleEditMode}
							size="sm"
							variant={isEditMode ? "default" : "ghost"}
						>
							{isEditMode ? (
								<>
									<Check className="h-4 w-4" />
									<span className="hidden sm:inline">Done</span>
								</>
							) : (
								<>
									<Edit3 className="h-4 w-4" />
									<span className="hidden sm:inline">Edit</span>
								</>
							)}
						</Button>
					</div>
				</div>

				{isEditMode && (
					<div className="rounded-lg border border-dashed border-border bg-muted/50 p-3">
						<p className="text-sm text-muted-foreground">
							<strong>Edit Mode:</strong> Drag widgets to reorder, click the
							size buttons (S/M/L) to resize, or click Remove to delete.
						</p>
					</div>
				)}

				<DndContext
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
					onDragStart={handleDragStart}
					sensors={sensors}
				>
					<SortableContext
						items={widgets.map((w) => w.id)}
						strategy={rectSortingStrategy}
					>
						{/* Grid layout - 12 columns on desktop for more size flexibility */}
						<div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-12">
							{widgets.map((widget) => (
								<SortableWidget
									id={widget.id}
									isEditMode={isEditMode}
									key={widget.id}
									onDelete={() => handleDeleteWidget(widget.id)}
									onResize={(newSize) => updateWidgetSize(widget.id, newSize)}
									size={widget.size}
								>
									{renderWidget(widget.id)}
								</SortableWidget>
							))}
						</div>
					</SortableContext>

					{/* Drag overlay for visual feedback */}
					<DragOverlay>
						{activeId && isEditMode ? (
							<div className="w-full overflow-hidden rounded-2xl opacity-90 shadow-lg ring-1 ring-border">
								{renderWidget(activeId as WidgetType)}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>

				{widgets.length === 0 && (
					<EmptyState
						description='Click "Add Widget" to get started'
						icon={Plus}
						title="No widgets added yet"
					/>
				)}
			</div>

			{/* Add Widget Dialog */}
			<Dialog onOpenChange={handleDialogOpenChange} open={isAddDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Add Dashboard Widgets</DialogTitle>
						<DialogDescription>
							Select one or more widgets to add to your dashboard
						</DialogDescription>
					</DialogHeader>
					<ScrollArea className="max-h-[400px] pr-4">
						<div className="grid gap-3 py-4">
							{availableWidgetsToAdd.length === 0 ? (
								<div className="py-8 text-center text-muted-foreground">
									<p>
										All available widgets are already added to your dashboard.
									</p>
								</div>
							) : (
								availableWidgetsToAdd.map((widget) => {
									const isSelected = selectedWidgets.includes(widget.id);
									return (
										<button
											className={cn(
												"flex items-start gap-4 rounded-lg border p-4 text-left transition-fast",
												isSelected
													? "border-primary bg-primary/10 hover:bg-primary/15"
													: "border-border hover:border-primary/50 hover:bg-muted/50"
											)}
											key={widget.id}
											onClick={() => toggleWidgetSelection(widget.id)}
											type="button"
										>
											<div className="flex-1">
												<h4 className="mb-1 font-medium">{widget.title}</h4>
												<p className="text-sm text-muted-foreground">
													{widget.description}
												</p>
											</div>
											<div
												className={cn(
													"mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-fast",
													isSelected
														? "border-primary bg-primary"
														: "border-muted-foreground"
												)}
											>
												{isSelected && (
													<Check className="h-3.5 w-3.5 text-primary-foreground" />
												)}
											</div>
										</button>
									);
								})
							)}
						</div>
					</ScrollArea>
					{availableWidgetsToAdd.length > 0 && (
						<div className="flex items-center justify-between border-t pt-4">
							<p className="text-sm text-muted-foreground">
								{selectedWidgets.length} widget
								{selectedWidgets.length !== 1 ? "s" : ""} selected
							</p>
							<Button
								disabled={selectedWidgets.length === 0}
								onClick={handleAddSelectedWidgets}
							>
								Add {selectedWidgets.length} widget
								{selectedWidgets.length !== 1 ? "s" : ""}
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
};
