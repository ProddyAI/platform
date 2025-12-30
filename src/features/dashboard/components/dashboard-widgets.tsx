'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Id } from '@/../convex/_generated/dataModel';
import { MentionsWidget } from './widgets/mentions-widget';
import { ThreadRepliesWidget } from './widgets/thread-replies-widget';
import { TasksWidget } from './widgets/tasks-widget';
import { AssignedCardsWidget } from './widgets/assigned-cards-widget';
import { CalendarPreviewWidget } from './widgets/calendar-preview-widget';
import { NotesWidget } from './widgets/notes-widget';
import { CanvasWidget } from './widgets/canvas-widget';
import { useState, useCallback, useEffect, useRef, cloneElement, ReactElement } from 'react';
import {
  RefreshCw,
  GripVertical,
  Edit3,
  Plus,
  X,
  GripHorizontal,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDashboardWidgets } from '@/features/workspaces/api/use-workspace-preferences';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { DashboardWidget, WidgetSize } from '../../../../convex/preferences';

interface DashboardWidgetsProps {
  workspaceId: Id<'workspaces'>;
  member: {
    _id: Id<'members'>;
    userId: Id<'users'>;
    role: string;
    workspaceId: Id<'workspaces'>;
    user?: {
      name: string;
      image?: string;
    };
  };
}

// Widget types
type WidgetType = 'mentions' | 'threads' | 'tasks' | 'cards' | 'calendar' | 'notes' | 'canvas';

// Available widgets configuration
const AVAILABLE_WIDGETS = [
  { id: 'mentions', title: 'Mentions', description: 'Messages where you were mentioned' },
  { id: 'threads', title: 'Thread Replies', description: 'Recent thread replies' },
  { id: 'tasks', title: 'Tasks', description: 'Your assigned tasks' },
  { id: 'cards', title: 'Assigned Cards', description: 'Cards assigned to you' },
  { id: 'calendar', title: 'Calendar Preview', description: 'Upcoming events' },
  { id: 'notes', title: 'Notes', description: 'Recent notes' },
  { id: 'canvas', title: 'Canvas', description: 'Recent canvas items' },
];

// Sortable widget wrapper component
interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  size: 'small' | 'medium' | 'large';
  isEditMode: boolean;
  onDelete: () => void;
  onResize: (newSize: 'small' | 'medium' | 'large') => void;
}

const SortableWidget = ({ id, children, size, isEditMode, onDelete, onResize }: SortableWidgetProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  // Grid layout classes based on size
  const gridSizeClasses = {
    small: 'col-span-1 md:col-span-3', // Small - 1/4 width on desktop
    medium: 'col-span-1 md:col-span-6', // Medium - half width (6/12 columns)
    large: 'col-span-1 md:col-span-12', // Large - Full width (12/12 columns)
  };

    const controls = isEditMode ? (
    <div className="flex items-center gap-2">
      {/* Size Toggle Buttons */}
      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-md shadow-sm p-0.5">
        <Button
          variant={size === 'small' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 w-6 p-0 text-xs"
          onClick={() => onResize('small')}
        >
          S
        </Button>
        <Button
          variant={size === 'medium' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 w-6 p-0 text-xs"
          onClick={() => onResize('medium')}
        >
          M
        </Button>
        <Button
          variant={size === 'large' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 w-6 p-0 text-xs"
          onClick={() => onResize('large')}
        >
          L
        </Button>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
        onClick={onDelete}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Drag Handle */}
      <div
        className="cursor-grab active:cursor-grabbing p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-md shadow-sm hover:bg-muted/80 transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        gridSizeClasses[size],
        "h-auto",
        isDragging ? "z-10" : ""
      )}
    >
      {cloneElement(children as ReactElement, { controls })}
    </div>
  );
};

export const DashboardWidgets = ({ workspaceId, member }: DashboardWidgetsProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
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

  const handleRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const toggleEditMode = () => {
    setIsEditMode(prev => !prev);
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
          size: 'medium' as WidgetSize,
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
    setWidgets((prev) => prev.filter(widget => widget.id !== id));
  };

  // Update widget size
  const updateWidgetSize = (id: string, size: WidgetSize) => {
    setWidgets((prev) =>
      prev.map(widget =>
        widget.id === id
          ? { ...widget, size }
          : widget
      )
    );
  };

  // Get available widgets to add (not already in the dashboard)
  const availableWidgetsToAdd = AVAILABLE_WIDGETS.filter(
    available => !widgets.some(widget => widget.id === available.id)
  );

  // Render the appropriate widget based on type
  const renderWidget = useCallback((type: string) => {
    // Cast to WidgetType for switch statement
    const widgetType = type as WidgetType;
    switch (widgetType) {
      case 'mentions':
        return (
          <MentionsWidget
            key={`mentions-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );
      case 'threads':
        return (
          <ThreadRepliesWidget
            key={`threads-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );
      case 'tasks':
        return (
          <TasksWidget
            key={`tasks-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );
      case 'cards':
        return (
          <AssignedCardsWidget
            key={`cards-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );
      case 'calendar':
        return (
          <CalendarPreviewWidget
            key={`calendar-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );
      case 'notes':
        return (
          <NotesWidget
            key={`notes-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );

      case 'canvas':
        return (
          <CanvasWidget
            key={`canvas-${refreshKey}`}
            workspaceId={workspaceId}
            member={member}
            isEditMode={isEditMode}
          />
        );
      default:
        return null;
    }
  }, [workspaceId, member, refreshKey, isEditMode]);

  return (
    <>
      <Card className="h-full shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Workspace Overview</CardTitle>
            <div className="flex items-center gap-2">
              {/* Add Card Button - Only visible in edit mode */}
              {isEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddDialogOpen(true)}
                  className="h-8 px-3 gap-2"
                  disabled={availableWidgetsToAdd.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Card</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              {/* Edit Mode Toggle */}
              <Button
                variant={isEditMode ? "default" : "ghost"}
                size="sm"
                onClick={toggleEditMode}
                className="h-8 px-3 gap-2"
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
        </CardHeader>
        <CardContent className="p-4">
          <ScrollArea className="h-[calc(100vh-180px)] pb-8">
            {isEditMode && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  <strong>Edit Mode:</strong> Drag cards to reorder • Click size buttons (S/M/L) to resize • Click (✕) to remove
                </p>
              </div>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={widgets.map(w => w.id)}
                strategy={rectSortingStrategy}
              >
                {/* Grid layout - 12 columns on desktop for more size flexibility */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4">
                  {widgets.map((widget) => (
                    <SortableWidget
                      key={widget.id}
                      id={widget.id}
                      size={widget.size}
                      isEditMode={isEditMode}
                      onDelete={() => handleDeleteWidget(widget.id)}
                      onResize={(newSize) => updateWidgetSize(widget.id, newSize)}
                    >
                      {renderWidget(widget.id)}
                    </SortableWidget>
                  ))}
                </div>
              </SortableContext>

              {/* Drag overlay for visual feedback */}
              <DragOverlay>
                {activeId && isEditMode ? (
                  <div className="opacity-80 w-full">
                    {renderWidget(activeId as WidgetType)}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {widgets.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="text-muted-foreground mb-4">
                  <Plus className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-lg font-medium">No widgets added yet</p>
                  <p className="text-sm">Click "Add Card" to get started</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Widget Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Dashboard Cards</DialogTitle>
            <DialogDescription>
              Select one or more cards to add to your dashboard
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="grid gap-3 py-4">
              {availableWidgetsToAdd.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>All available widgets are already added to your dashboard.</p>
                </div>
              ) : (
                availableWidgetsToAdd.map((widget) => {
                  const isSelected = selectedWidgets.includes(widget.id);
                  return (
                    <button
                      key={widget.id}
                      onClick={() => toggleWidgetSelection(widget.id)}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border transition-all text-left",
                        isSelected
                          ? "bg-primary/10 border-primary hover:bg-primary/15"
                          : "border-border hover:bg-muted/50 hover:border-primary/50"
                      )}
                    >
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{widget.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {widget.description}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground"
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
          {availableWidgetsToAdd.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedWidgets.length} card{selectedWidgets.length !== 1 ? 's' : ''} selected
              </p>
              <Button
                onClick={handleAddSelectedWidgets}
                disabled={selectedWidgets.length === 0}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};