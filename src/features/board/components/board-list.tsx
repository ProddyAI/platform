import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	GripVertical,
	LayoutGrid,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash,
} from "lucide-react";
import type React from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import BoardCard from "./board-card";

interface BoardListProps {
	list: any;
	cards: any[];
	onEditList: () => void;
	onDeleteList: () => void;
	onAddCard: () => void;
	onEditCard: (card: any) => void;
	onDeleteCard: (cardId: Id<"cards">) => void;
	assigneeData?: Record<Id<"members">, { name: string; image?: string }>;
	listCount?: number;
	selectionMode?: boolean;
	selectedCardIds?: Set<Id<"cards">>;
	onToggleSelect?: (cardId: Id<"cards">) => void;
	disableListDrag?: boolean;
}

const BoardList: React.FC<BoardListProps> = ({
	list,
	cards,
	onEditList,
	onDeleteList,
	onAddCard,
	onEditCard,
	onDeleteCard,
	assigneeData = {},
	listCount = 0,
	selectionMode = false,
	selectedCardIds,
	onToggleSelect,
	disableListDrag = false,
}) => {
	// Make the list sortable
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: list._id,
		data: {
			type: "list",
			list,
		},
		disabled: disableListDrag,
	});

	// Make the list a drop target for cards
	const { setNodeRef: setDroppableRef, isOver } = useDroppable({
		id: `droppable-${list._id}`,
		data: {
			type: "list",
			listId: list._id,
			list,
			accepts: ["card"],
		},
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	// Get priority counts
	const priorityCounts = {
		highest: cards.filter((c) => c.priority === "highest").length,
		high: cards.filter((c) => c.priority === "high").length,
		medium: cards.filter((c) => c.priority === "medium").length,
		low: cards.filter((c) => c.priority === "low").length,
		lowest: cards.filter((c) => c.priority === "lowest").length,
	};

	// Responsive width: 4 lists (XL), 3 lists (LG), 2 lists (MD), 1 list (SM)
	const getWidthClass = () => {
		return "w-[calc(25%-12px)] min-w-[280px] max-w-[400px] xl:w-[calc(25%-12px)] lg:w-[calc(33.333%-10.667px)] md:w-[calc(50%-8px)] sm:w-full";
	};

	return (
		<>
			<style jsx>{`
                /* Custom scrollbar styling for list cards */
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                .dark ::-webkit-scrollbar-thumb {
                    background: #4b5563;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .dark ::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                }
            `}</style>
			<div
				ref={setNodeRef}
				style={style}
				{...attributes}
				className={cn(
					"bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-md flex flex-col border border-gray-200 dark:border-gray-700",
					getWidthClass(),
					isDragging &&
						"opacity-70 border-2 border-dashed border-secondary shadow-lg"
				)}
			>
				{/* List Header */}
				<div className="p-3 font-bold border-b dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 rounded-t-lg dark:text-gray-100">
					<div className="flex items-center gap-2">
						<div
							className="cursor-grab hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
							{...listeners}
						>
							<GripVertical className="w-4 h-4 text-muted-foreground" />
						</div>
						<span className="truncate">{list.title}</span>
						<Badge
							className="ml-1 bg-white dark:bg-gray-800 dark:border-gray-600"
							variant="outline"
						>
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
								<DropdownMenuItem
									className="text-destructive"
									onClick={onDeleteList}
								>
									<Trash className="w-3.5 h-3.5 mr-2" /> Delete List
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* List Stats */}
				{cards.length > 0 && (
					<div className="px-3 py-1.5 bg-muted/50 dark:bg-gray-800/50 border-b dark:border-gray-700 flex items-center justify-between text-[10px] text-muted-foreground">
						<div className="flex items-center gap-1">
							<LayoutGrid className="w-3 h-3" />
							<span>{cards.length} cards</span>
						</div>
						<div className="flex gap-1 flex-wrap">
							{priorityCounts.highest > 0 && (
								<Badge
									className="text-[9px] px-1 py-0 h-4"
									variant="destructive"
								>
									{priorityCounts.highest} high+
								</Badge>
							)}
							{priorityCounts.high > 0 && (
								<Badge className="text-[9px] px-1 py-0 h-4 bg-orange-500 text-white">
									{priorityCounts.high} high
								</Badge>
							)}
							{priorityCounts.medium > 0 && (
								<Badge className="text-[9px] px-1 py-0 h-4" variant="secondary">
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

				{/* Cards Container - expanded to push Add Card button to bottom */}
				<div
					className={cn(
						"transition-colors duration-200 flex-1 flex flex-col",
						isOver
							? "bg-secondary/10 ring-2 ring-secondary/40"
							: "bg-transparent"
					)}
					ref={setDroppableRef}
				>
					<SortableContext
						items={cards.map((c) => c._id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="p-2 flex flex-col gap-2 flex-1">
							{cards.length === 0 && (
								<div
									className={cn(
										"h-16 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground dark:text-gray-400 text-sm",
										isOver
											? "border-secondary/40 bg-secondary/5 dark:bg-secondary/10"
											: "border-gray-200 dark:border-gray-700"
									)}
								>
									{isOver ? "Drop card here" : "No cards yet"}
								</div>
							)}
							{cards.map((card) => (
								<BoardCard
									assigneeData={assigneeData}
									card={card}
									isSelected={selectedCardIds?.has(card._id) || false}
									key={card._id}
									onDelete={() => onDeleteCard(card._id)}
									onEdit={() => onEditCard(card)}
									onToggleSelect={onToggleSelect}
									selectionMode={selectionMode}
								/>
							))}
							{cards.length > 0 && isOver && (
								<div className="h-16 border-2 border-dashed border-secondary/40 rounded-md flex items-center justify-center text-secondary/60 dark:text-secondary/80 mt-2 bg-secondary/5 dark:bg-secondary/10">
									Drop card here
								</div>
							)}
						</div>
					</SortableContext>
				</div>

				{/* Add Card Button - stays at bottom */}
				<div className="p-2 bg-white dark:bg-gray-800 rounded-b-lg border-t dark:border-gray-700 mt-auto">
					<Button
						className="w-full bg-white dark:bg-gray-800 hover:bg-secondary/5 dark:hover:bg-secondary/10 transition-colors dark:border-gray-600"
						onClick={onAddCard}
						size="sm"
						variant="outline"
					>
						<Plus className="w-4 h-4 mr-1" /> Add Card
					</Button>
				</div>
			</div>
		</>
	);
};

export default BoardList;
