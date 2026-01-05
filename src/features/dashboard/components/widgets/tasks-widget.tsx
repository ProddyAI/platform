'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Clock, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { Id } from '@/../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { useGetTasks } from '@/features/tasks/api/use-get-tasks';
import { useGetTaskCategories } from '@/features/tasks/api/use-get-task-categories';
import { useUpdateTask } from '@/features/tasks/api/use-update-task';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useState } from 'react';

interface TasksWidgetProps {
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
  isEditMode?: boolean;
  controls?: React.ReactNode;
}



export const TasksWidget = ({ workspaceId, isEditMode, controls }: TasksWidgetProps) => {
  const router = useRouter();
  const [updatingTaskId, setUpdatingTaskId] = useState<Id<'tasks'> | null>(null);

  // Fetch your tasks
  const { data: tasks, isLoading } = useGetTasks({ workspaceId });
  const { data: categories } = useGetTaskCategories({ workspaceId });
  const updateTask = useUpdateTask();

  const sortedTasks = tasks ? [...tasks]
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      if (a.dueDate && b.dueDate) {
        return a.dueDate - b.dueDate;
      }

      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return b._creationTime - a._creationTime;
    })
    .slice(0, 10) : [];

  const handleViewTask = (taskId: Id<'tasks'>) => {
    router.push(`/workspace/${workspaceId}/tasks?taskId=${taskId}`);
  };

  const handleToggleTaskCompletion = async (id: Id<'tasks'>, completed: boolean) => {
    if (updatingTaskId) return;
    
    setUpdatingTaskId(id);
    
    try {
      const result = await updateTask({
        id,
        completed: !completed
      });
      
      if (result !== undefined) {
        toast.success(
          !completed ? 'Task completed' : 'Task marked as incomplete',
          {
            description: !completed ? 'Great job!' : 'Task reopened',
          }
        );
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task', {
        description: 'Please try again',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Get category name by ID
  const getCategoryName = (categoryId: Id<'categories'> | undefined) => {
    if (!categoryId || !categories) return 'Uncategorized';
    const category = categories.find(cat => cat._id === categoryId);
    return category ? category.name : 'Uncategorized';
  };

  // Get priority badge
  const getPriorityBadge = (priority: string | undefined) => {
    if (!priority) return null;

    const priorityColors: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={`${priorityColors[priority] || 'bg-gray-100 text-gray-800'}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between pr-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary dark:text-purple-400" />
          <h3 className="font-medium">Your Tasks</h3>
          {!isEditMode && sortedTasks.length > 0 && (
            <Badge variant="default" className="ml-2">
              {sortedTasks.length}
            </Badge>
          )}
        </div>
        {isEditMode ? (
          controls
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push(`/workspace/${workspaceId}/tasks`)}
            className='bg-primary/90 hover:bg-primary'
          >
            View all
          </Button>
        )}
      </div>

      {sortedTasks.length > 0 ? (
        <ScrollArea className="h-[250px] rounded-md border-2 dark:bg-[hsl(var(--card-accent))]">
          <div className="space-y-2 p-4">
            {sortedTasks.map((task) => (
              <Card
                key={task._id}
                className={`overflow-hidden border-2 dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] ${task.completed ? 'bg-muted/20' : ''}`}
              >
                <CardContent className="p-4 dark:bg-[hsl(var(--card))]">
                  <div className="flex items-start gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5"
                      onClick={() => handleToggleTaskCompletion(task._id, task.completed)}
                      disabled={updatingTaskId === task._id}
                    >
                      {updatingTaskId === task._id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : task.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                      )}
                    </Button>
                    <div className="flex-1 space-y-2 min-w-0">
                      <p className={`font-medium break-words leading-tight ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      {getPriorityBadge(task.priority)}
                      {task.dueDate && (
                        <div className={`flex items-center text-xs ${new Date(task.dueDate) < new Date() && !task.completed
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                          }`}>
                          <Clock className="mr-1 h-3 w-3 flex-shrink-0" />
                          <span>{formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}</span>
                          {new Date(task.dueDate) < new Date() && !task.completed && (
                            <AlertCircle className="ml-1 h-3 w-3 flex-shrink-0" />
                          )}
                        </div>
                      )}
                      <Badge variant="outline" className="border-2 text-xs w-fit">
                        {getCategoryName(task.categoryId)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs text-primary dark:text-purple-400 hover:bg-purple-500/10 hover:text-purple-600 hover:dark:bg-purple-400/10 hover:dark:text-purple-300 flex-shrink-0"
                      onClick={() => handleViewTask(task._id)}
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
          <CheckSquare className="mb-2 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">No tasks</h3>
          <p className="text-sm text-muted-foreground">
            You don't have any tasks created
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="default"
              size="sm"
              className='bg-primary/90 hover:bg-primary'
              onClick={() => router.push(`/workspace/${workspaceId}/tasks?action=create`)}
            >
              Create Task
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};