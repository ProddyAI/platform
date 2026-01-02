import React from 'react';
import type { Id } from '@/../convex/_generated/dataModel';
import { Pencil, Trash, Plus, MoreHorizontal, GripVertical, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import BoardCard from './board-card';

interface BoardListProps {
    list: any;
    cards: any[];
    onEditList: () => void;
    onDeleteList: () => void;
    onAddCard: () => void;
    onEditCard: (card: any) => void;
    onDeleteCard: (cardId: Id<'cards'>) => void;
    assigneeData?: Record<Id<'members'>, { name: string; image?: string }>;
    listCount?: number;
}

const BoardList: React.FC<BoardListProps> = ({ list, cards, onEditList, onDeleteList, onAddCard, onEditCard, onDeleteCard, assigneeData = {}, listCount = 0 }) => {
    // Make the list sortable
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: list._id,
        data: {
            type: 'list',
            list
        }
    });

    // Make the list a drop target for cards
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `droppable-${list._id}`,
        data: {
            type: 'list',
            listId: list._id,
            list,
            accepts: ['card']
        }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Get priority counts
    const priorityCounts = {
        highest: cards.filter(c => c.priority === 'highest').length,
        high: cards.filter(c => c.priority === 'high').length,
        medium: cards.filter(c => c.priority === 'medium').length,
        low: cards.filter(c => c.priority === 'low').length,
        lowest: cards.filter(c => c.priority === 'lowest').length,
    };

    // Calculate responsive width based on number of lists
    const getWidthClass = () => {
        if (listCount <= 3) {
            return "flex-1 min-w-[280px]";
        } else if (listCount === 4) {
            return "flex-1 min-w-[250px]";
        } else if (listCount === 5) {
            return "flex-1 min-w-[220px]";
        } else {
            return "flex-1 min-w-[200px]";
        }
    };

    return (
        <>
            <style jsx>{`
                /* Hide scrollbars for list cards */
                ::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                className={cn(
                    "bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg shadow-md flex flex-col border border-gray-200 max-h-[calc(100vh-180px)]",
                    getWidthClass(),
                    isDragging && "opacity-70 border-2 border-dashed border-secondary shadow-lg"
                )}
            >
            {/* List Header */}
            <div className="p-3 font-bold border-b flex items-center justify-between bg-white rounded-t-lg">
                <div className="flex items-center gap-2">
                    <div
                        className="cursor-grab hover:bg-gray-100 p-1 rounded"
                        {...listeners}
                    >
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="truncate">{list.title}</span>
                    <Badge variant="outline" className="ml-1 bg-white">
                        {cards.length}
                    </Badge>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="iconSm" variant="ghost">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEditList}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit List
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDeleteList} className="text-destructive">
                                <Trash className="w-3.5 h-3.5 mr-2" /> Delete List
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* List Stats */}
            {cards.length > 0 && (
                <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <LayoutGrid className="w-3 h-3" />
                        <span>{cards.length} cards</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {priorityCounts.highest > 0 && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                {priorityCounts.highest} high+
                            </Badge>
                        )}
                        {priorityCounts.high > 0 && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-orange-500 text-white">
                                {priorityCounts.high} high
                            </Badge>
                        )}
                        {priorityCounts.medium > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                {priorityCounts.medium} med
                            </Badge>
                        )}
                        {priorityCounts.low > 0 && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-blue-400 text-white">
                                {priorityCounts.low} low
                            </Badge>
                        )}
                        {priorityCounts.lowest > 0 && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-secondary/30 text-secondary-foreground">
                                {priorityCounts.lowest} low-
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {/* Cards Container */}
            <div
                ref={setDroppableRef}
                className={cn(
                    "flex-1 min-h-[100px] transition-colors duration-200 overflow-y-auto",
                    isOver ? "bg-secondary/10 ring-2 ring-secondary/40" : "bg-transparent"
                )}
                style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#cbd5e1 transparent'
                }}
            >
                <SortableContext items={cards.map(c => c._id)} strategy={verticalListSortingStrategy}>
                    <div className="flex-1 p-2 flex flex-col gap-2">
                        {cards.length === 0 && (
                            <div className={cn(
                                "h-20 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground text-sm",
                                isOver ? "border-secondary/40 bg-secondary/5" : "border-gray-200"
                            )}>
                                {isOver ? "Drop card here" : "No cards yet"}
                            </div>
                        )}
                        {cards.map((card) => (
                            <BoardCard
                                key={card._id}
                                card={card}
                                onEdit={() => onEditCard(card)}
                                onDelete={() => onDeleteCard(card._id)}
                                assigneeData={assigneeData}
                            />
                        ))}
                        {cards.length > 0 && isOver && (
                            <div className="h-16 border-2 border-dashed border-secondary/40 rounded-md flex items-center justify-center text-secondary/60 mt-2 bg-secondary/5">
                                Drop card here
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>

            {/* Add Card Button */}
            <div className="p-2 bg-white rounded-b-lg border-t">
                <Button
                    size="sm"
                    variant="outline"
                    className="w-full bg-white hover:bg-secondary/5 transition-colors"
                    onClick={onAddCard}
                >
                    <Plus className="w-4 h-4 mr-1" /> Add Card
                </Button>
            </div>
            </div>
        </>
    );
};

export default BoardList;