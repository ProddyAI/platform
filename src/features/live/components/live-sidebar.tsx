'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, FileText, Palette, ChevronLeft, ChevronRight, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Id } from '@/../convex/_generated/dataModel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Generic item interface that works for both notes and canvas
interface LiveItem {
  _id: string;
  title?: string;
  canvasName?: string;
  content?: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
  roomId?: string;
}

interface LiveSidebarProps {
  // Common props
  type: 'notes' | 'canvas';
  items: LiveItem[];
  selectedItemId?: string | null;
  onItemSelect: (itemId: string, roomId?: string, title?: string) => void;

  // Collapse props
  collapsed: boolean;
  onToggleCollapse: () => void;

  // Action props
  onCreateItem: () => void;
  onDeleteItem?: (itemId: string) => void;
  onRenameItem?: (itemId: string, newName: string) => void;

  // Context props
  workspaceId?: Id<'workspaces'>;
  channelId?: Id<'channels'>;

  // Styling
  className?: string;
}

export const LiveSidebar = ({
  type,
  items,
  selectedItemId,
  onItemSelect,
  collapsed,
  onToggleCollapse,
  onCreateItem,
  onDeleteItem,
  onRenameItem,
  workspaceId,
  channelId,
  className
}: LiveSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    return items.filter((item) => {
      const title = item.title || item.canvasName || '';
      const content = item.content || '';
      const tags = item.tags || [];

      const searchLower = searchQuery.toLowerCase();

      return (
        title.toLowerCase().includes(searchLower) ||
        content.toLowerCase().includes(searchLower) ||
        tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    });
  }, [items, searchQuery]);

  // Get preview text for notes
  const getPreviewText = (content: string) => {
    if (!content) return '';

    try {
      const delta = JSON.parse(content);
      if (delta.ops) {
        return delta.ops
          .map((op: any) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
          .replace(/\n/g, ' ')
          .trim()
          .substring(0, 100);
      }
    } catch {
      // Fallback for non-Quill content
      return content.substring(0, 100);
    }
    return '';
  };

  // Get display title for item
  const getItemTitle = (item: LiveItem) => {
    return item.title || item.canvasName || `Untitled ${type === 'notes' ? 'Note' : 'Canvas'}`;
  };

  // Handle item click
  const handleItemClick = (item: LiveItem) => {
    const title = getItemTitle(item);
    onItemSelect(item._id, item.roomId, title);
  };

  // Handle delete
  const handleDelete = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    onDeleteItem?.(itemId);
  };

  // Handle rename
  const handleRename = (e: React.MouseEvent, item: LiveItem) => {
    e.stopPropagation();
    setRenamingItemId(item._id);
    setRenameValue(getItemTitle(item));
    setOpenDropdownId(null);
  };

  // Handle rename submit
  const handleRenameSubmit = (itemId: string) => {
    if (renameValue.trim() && onRenameItem) {
      onRenameItem(itemId, renameValue.trim());
    }
    setRenamingItemId(null);
    setRenameValue('');
  };

  // Handle rename cancel
  const handleRenameCancel = () => {
    setRenamingItemId(null);
    setRenameValue('');
  };

  // Handle rename key down
  const handleRenameKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(itemId);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  if (collapsed) {
    return (
      <div className={cn("w-12 border-r bg-muted/30 dark:bg-[hsl(var(--card-accent))] flex flex-col", className)}>
        <div className="p-2 border-b dark:border-[hsl(var(--border))]">
          <Button
            onClick={onToggleCollapse}
            variant="ghost"
            size="sm"
            className="w-full h-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-2">
          <Button onClick={onCreateItem} size="sm" className="w-full h-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-80 border-r bg-muted/30 dark:bg-[hsl(var(--card-accent))] flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b dark:border-[hsl(var(--border))]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            {type === 'notes' ? (
              <FileText className="h-4 w-4" />
            ) : (
              <Palette className="h-4 w-4" />
            )}
            {type === 'notes' ? 'Notes' : 'Canvas'}
          </h2>

          <Button
            onClick={onToggleCollapse}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Search and Create */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${type}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={onCreateItem} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8">
              {type === 'notes' ? (
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              ) : (
                <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              )}
              <p className="text-sm text-muted-foreground">
                {searchQuery ? `No ${type} found` : `No ${type} yet`}
              </p>
              {!searchQuery && (
                <Button
                  onClick={onCreateItem}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create {type === 'notes' ? 'Note' : 'Canvas'}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setHoveredItemId(item._id)}
                  onMouseLeave={() => {
                    // Don't hide if dropdown is open for this item
                    if (openDropdownId !== item._id) {
                      setHoveredItemId(null);
                    }
                  }}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors group",
                    selectedItemId === item._id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {renamingItemId === item._id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyDown(e, item._id)}
                          onBlur={() => handleRenameSubmit(item._id)}
                          autoFocus
                          className="h-6 text-sm font-medium border-none shadow-none p-0 focus-visible:ring-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3 className="font-medium text-sm truncate">
                          {getItemTitle(item)}
                        </h3>
                      )}

                      {type === 'notes' && item.content && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {getPreviewText(item.content)}
                        </p>
                      )}

                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{item.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mt-1">
                        {item.updatedAt && new Date(item.updatedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Actions - Always show delete for both notes and canvas */}
                    {hoveredItemId === item._id && (
                      <DropdownMenu
                        onOpenChange={(open) => {
                          if (open) {
                            setOpenDropdownId(item._id);
                          } else {
                            setOpenDropdownId(null);
                            setHoveredItemId(null);
                          }
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onRenameItem && (
                            <DropdownMenuItem
                              onClick={(e) => handleRename(e, item)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                          )}
                          {onDeleteItem && (
                            <DropdownMenuItem
                              onClick={(e) => handleDelete(e, item._id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
