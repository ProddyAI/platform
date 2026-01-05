'use client';

import { isAfter, isBefore, isToday, startOfDay } from 'date-fns';
import { CheckSquare, Loader, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useWorkspaceId } from '@/hooks/use-workspace-id';
import { WorkspaceToolbar } from '../toolbar';
import { useTrackActivity } from '@/features/reports/hooks/use-track-activity';

import { useGetTaskCategories } from '@/features/tasks/api/use-get-task-categories';
import { useGetTasks } from '@/features/tasks/api/use-get-tasks';
import { TaskCreateForm } from '@/features/tasks/components/task-create-form';
import { TaskFilterOptions } from '@/features/tasks/components/task-filter';
import { TaskSidebar } from '@/features/tasks/components/task-sidebar';
import { TaskToggleView } from '@/features/tasks/components/task-toggle-view';

const TasksPage = () => {
  // Set document title
  useDocumentTitle('Tasks');

  const workspaceId = useWorkspaceId();
  
  // Track user activity and time spent on tasks page
  useTrackActivity({
    workspaceId,
    activityType: 'tasks_view',
  });
  const { data: tasks, isLoading } = useGetTasks({ workspaceId });
  const { data: categories, isLoading: categoriesLoading } = useGetTaskCategories({ workspaceId });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState<TaskFilterOptions>({
    status: 'all',
    priority: 'all',
    dueDate: 'all',
    categoryId: null,
    tags: [] as string[],
    sortBy: 'created',
    sortDirection: 'desc',
    view: 'list',
  });

  // Handle filter changes
  const handleFilterChange = useCallback((options: Partial<TaskFilterOptions>) => {
    setFilterOptions(prev => ({ ...prev, ...options }));
  }, []);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];

    // Start with all tasks
    let filtered = [...tasks];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query)) ||
        (task.tags && task.tags.some((tag: string) => tag.toLowerCase().includes(query)))
      );
    }

    // Apply status filter
    if (filterOptions.status !== 'all') {
      if (['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'].includes(filterOptions.status)) {
        // Filter by specific status
        filtered = filtered.filter(task => task.status === filterOptions.status);
      } else if (filterOptions.status === 'active') {
        // Filter by active (not completed)
        filtered = filtered.filter(task => !task.completed);
      } else if (filterOptions.status === 'completed') {
        // Filter by completed
        filtered = filtered.filter(task => task.completed);
      }
    }

    // Apply priority filter
    if (filterOptions.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterOptions.priority);
    }

    // Apply category filter
    if (filterOptions.categoryId) {
      filtered = filtered.filter(task => task.categoryId === filterOptions.categoryId);
    }

    // Apply tags filter
    if (filterOptions.tags && filterOptions.tags.length > 0) {
      filtered = filtered.filter(task =>
        task.tags && filterOptions.tags.some(tag => task.tags?.includes(tag))
      );
    }

    // Apply due date filter
    if (filterOptions.dueDate !== 'all') {
      const today = startOfDay(new Date());

      switch (filterOptions.dueDate) {
        case 'overdue':
          filtered = filtered.filter(task =>
            task.dueDate && isBefore(new Date(task.dueDate), today) && !task.completed
          );
          break;
        case 'today':
          filtered = filtered.filter(task =>
            task.dueDate && isToday(new Date(task.dueDate))
          );
          break;
        case 'upcoming':
          filtered = filtered.filter(task =>
            task.dueDate && isAfter(new Date(task.dueDate), today)
          );
          break;
        case 'no-date':
          filtered = filtered.filter(task => !task.dueDate);
          break;
      }
    }

    // Sort tasks
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filterOptions.sortBy) {
        case 'created':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'dueDate':
          // Handle tasks without due dates
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          comparison = a.dueDate - b.dueDate;
          break;
        case 'priority':
          // Convert priority to numeric value for sorting
          const priorityValues = { high: 3, medium: 2, low: 1, undefined: 0 };
          const aPriority = priorityValues[a.priority || 'undefined'];
          const bPriority = priorityValues[b.priority || 'undefined'];
          comparison = bPriority - aPriority; // Higher priority first
          break;
      }

      // Apply sort direction
      return filterOptions.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [tasks, searchQuery, filterOptions]);

  // Handle task creation success
  const handleTaskCreated = useCallback(() => {
    toast.success('Task created successfully', {
      description: 'Your new task has been added to the list',
    });
  }, []);

  return (
    <div className="flex h-full flex-col">
      <WorkspaceToolbar>
        <Button
          variant="ghost"
          className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
          size="sm"
        >
          <CheckSquare className="mr-2 size-5" />
          <span className="truncate">Tasks</span>
        </Button>
      </WorkspaceToolbar>
      <div className="flex h-[calc(100%-4rem)] bg-white">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Header with search */}
            <div className="mb-8 space-y-4">
              {/* <h1 className="text-2xl font-bold text-gray-900">Tasks</h1> */}
              <div className="relative">
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full bg-gray-50 border-gray-200 focus:bg-white transition-colors dark:bg-[hsl(var(--muted))] dark:border-[hsl(var(--border))] dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-[hsl(var(--muted))]"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader className="h-6 w-6 animate-spin text-secondary" />
              </div>
            ) : (
              <div className="space-y-6 pb-8">
                <div className="pt-4 mt-8 border-t border-gray-100 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Create a new task</h2>
                  <TaskCreateForm workspaceId={workspaceId} onSuccess={handleTaskCreated} />
                </div>
                <div className="space-y-4">
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="rounded-full bg-gray-100 p-4">
                        <CheckSquare className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="mt-4 text-xl font-semibold">No tasks found</h3>
                      <p className="mt-2 text-gray-500 max-w-md mx-auto">
                        {searchQuery || filterOptions.status !== 'all' || filterOptions.priority !== 'all' || filterOptions.dueDate !== 'all' || filterOptions.categoryId !== null
                          ? "Try adjusting your filters or search query"
                          : "Create your first task to get started"}
                      </p>
                    </div>
                  ) : (
                    <TaskToggleView tasks={filteredTasks} workspaceId={workspaceId} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar with filters */}
        <TaskSidebar
          filterOptions={filterOptions}
          onFilterChange={handleFilterChange}
          categories={categories}
          categoriesLoading={categoriesLoading}
        />
      </div>
    </div>
  );
};

export default TasksPage;

