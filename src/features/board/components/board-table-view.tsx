import React, { useState, useMemo } from 'react';
import { Pencil, Trash, ArrowUpDown, Clock, AlertCircle, ArrowRightCircle, CheckCircle2, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Id } from '@/../convex/_generated/dataModel';

interface BoardTableViewProps {
  lists: any[];
  allCards: any[];
  onEditCard: (card: any) => void;
  onDeleteCard: (cardId: Id<'cards'>) => void;
  members?: any[];
}

const BoardTableView: React.FC<BoardTableViewProps> = ({ lists, allCards, onEditCard, onDeleteCard, members = [] }) => {
  // Create a map of member data for easy lookup
  const memberDataMap = useMemo(() => {
    const map: Record<Id<'members'>, { name: string; image?: string }> = {};
    members.forEach(member => {
      if (member._id) {
        map[member._id] = {
          name: member.user?.name || 'Unknown',
          image: member.user?.image
        };
      }
    });
    return map;
  }, [members]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Flatten all cards and add list title
  const flattenedCards = allCards.map(card => {
    const list = lists.find(l => l._id === card.listId);
    return {
      ...card,
      listTitle: list ? list.title : 'Unknown List'
    };
  });

  // Sort cards
  const sortedCards = [...flattenedCards].sort((a, b) => {
    if (!sortField) return 0;

    let valueA, valueB;

    switch (sortField) {
      case 'title':
        valueA = a.title.toLowerCase();
        valueB = b.title.toLowerCase();
        break;
      case 'list':
        valueA = a.listTitle.toLowerCase();
        valueB = b.listTitle.toLowerCase();
        break;
      case 'priority':
        const priorityOrder = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1, undefined: 0 };
        valueA = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        valueB = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        break;
      default:
        return 0;
    }

    if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Filter cards by search query
  const filteredCards = sortedCards.filter(card => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.title.toLowerCase().includes(query) ||
      (card.description && card.description.toLowerCase().includes(query)) ||
      card.listTitle.toLowerCase().includes(query) ||
      (card.labels && card.labels.some((label: string) => label.toLowerCase().includes(query)))
    );
  });

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: string | undefined) => {
    switch (priority) {
      case 'highest':
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      case 'high':
        return <AlertCircle className="w-3 h-3 text-orange-500" />;
      case 'medium':
        return <ArrowRightCircle className="w-3 h-3 text-secondary" />;
      case 'low':
        return <ArrowRightCircle className="w-3 h-3 text-blue-400" />;
      case 'lowest':
        return <CheckCircle2 className="w-3 h-3 text-secondary/70" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Table Search */}
      <div className="p-4 bg-white border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cards..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Showing {filteredCards.length} of {allCards.length} cards
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-auto overflow-x-hidden flex-1 bg-white" style={{ WebkitOverflowScrolling: 'touch' }}>
        <style jsx>{`
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            <tr className="border-b">
              <th className="p-3 text-left font-medium text-sm">
                <button
                  className="flex items-center gap-1 hover:text-secondary transition-colors"
                  onClick={() => handleSort('title')}
                >
                  Title
                  {sortField === 'title' && (
                    <ArrowUpDown className={cn(
                      "h-3 w-3 transition-transform",
                      sortDirection === 'desc' && "transform rotate-180"
                    )} />
                  )}
                </button>
              </th>
              <th className="p-3 text-left font-medium text-sm">Description</th>
              <th className="p-3 text-left font-medium text-sm">
                <button
                  className="flex items-center gap-1 hover:text-secondary transition-colors"
                  onClick={() => handleSort('list')}
                >
                  List
                  {sortField === 'list' && (
                    <ArrowUpDown className={cn(
                      "h-3 w-3 transition-transform",
                      sortDirection === 'desc' && "transform rotate-180"
                    )} />
                  )}
                </button>
              </th>
              <th className="p-3 text-left font-medium text-sm">
                <button
                  className="flex items-center gap-1 hover:text-secondary transition-colors"
                  onClick={() => handleSort('priority')}
                >
                  Priority
                  {sortField === 'priority' && (
                    <ArrowUpDown className={cn(
                      "h-3 w-3 transition-transform",
                      sortDirection === 'desc' && "transform rotate-180"
                    )} />
                  )}
                </button>
              </th>
              <th className="p-3 text-left font-medium text-sm">Labels</th>
              <th className="p-3 text-left font-medium text-sm">Due Date</th>
              <th className="p-3 text-left font-medium text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>Assignees</span>
                </div>
              </th>
              <th className="p-3 text-left font-medium text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCards.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'No cards match your search' : 'No cards found'}
                </td>
              </tr>
            ) : (
              filteredCards.map(card => (
                <tr key={card._id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">
                    <div className="flex items-center gap-2">
                      {card.title}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground max-w-[200px]">
                    <div className="truncate">{card.description || '-'}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="font-normal">
                      {card.listTitle}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {card.priority ? (
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(card.priority)}
                        <Badge variant={
                          card.priority === 'highest' ? 'destructive' :
                            card.priority === 'high' ? 'default' :
                              card.priority === 'medium' ? 'secondary' :
                                card.priority === 'low' ? 'outline' :
                                  'outline'
                        } className={cn(
                          "text-xs px-2 py-0.5",
                          card.priority === 'high' && "bg-orange-500 hover:bg-orange-500/90",
                          card.priority === 'low' && "border-blue-400 text-blue-400",
                          card.priority === 'lowest' && "border-secondary/30 text-secondary/70"
                        )}>
                          {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(card.labels) && card.labels.length > 0 ? (
                        card.labels.map((label: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5 bg-secondary/20">{label}</Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    {card.dueDate ? (
                      <div className={cn(
                        "flex items-center gap-1",
                        new Date(card.dueDate) < new Date() && "text-destructive"
                      )}>
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(card.dueDate), { addSuffix: true })}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {card.assignees && card.assignees.length > 0 ? (
                      <div className="flex -space-x-2">
                        {card.assignees.slice(0, 3).map((assigneeId: Id<'members'>, index: number) => {
                          const assignee = memberDataMap[assigneeId];
                          const fallback = assignee?.name?.charAt(0).toUpperCase() || '?';

                          return (
                            <TooltipProvider key={assigneeId}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border border-background">
                                    <AvatarImage src={assignee?.image} alt={assignee?.name} />
                                    <AvatarFallback className="text-[10px]">{fallback}</AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{assignee?.name || 'Unknown user'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}

                        {card.assignees.length > 3 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar className="h-6 w-6 border border-background bg-muted">
                                  <AvatarFallback className="text-[10px]">+{card.assignees.length - 3}</AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{card.assignees.length - 3} more assignees</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="iconSm" variant="ghost" onClick={() => onEditCard(card)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit Card</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="iconSm" variant="ghost" onClick={() => onDeleteCard(card._id)}>
                              <Trash className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Card</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BoardTableView;
