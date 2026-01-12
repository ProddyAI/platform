import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import {
	AlertCircle,
	ArrowRightCircle,
	CheckCircle2,
	Clock,
	Pencil,
	Trash,
	Users,
} from "lucide-react";
import type React from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BoardCardProps {
	card: any;
	onEdit: () => void;
	onDelete: () => void;
	assigneeData?: Record<Id<"members">, { name: string; image?: string }>;
}

const BoardCard: React.FC<BoardCardProps> = ({
	card,
	onEdit,
	onDelete,
	assigneeData = {},
}) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: card._id,
		data: {
			type: "card",
			card,
		},
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	// Get priority color for card styling
	const getPriorityColor = () => {
		switch (card.priority) {
			case "highest":
				return "border-l-4 border-l-destructive bg-destructive/5 dark:bg-destructive/10";
			case "high":
				return "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30";
			case "medium":
				return "border-l-4 border-l-secondary bg-secondary/5 dark:bg-secondary/10";
			case "low":
				return "border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/30";
			case "lowest":
				return "border-l-4 border-l-secondary/30 bg-secondary/5 dark:bg-secondary/10";
			default:
				return "";
		}
	};

	// Get priority icon
	const getPriorityIcon = () => {
		switch (card.priority) {
			case "highest":
				return <AlertCircle className="w-3 h-3 text-destructive" />;
			case "high":
				return <AlertCircle className="w-3 h-3 text-orange-500" />;
			case "medium":
				return <ArrowRightCircle className="w-3 h-3 text-secondary" />;
			case "low":
				return <ArrowRightCircle className="w-3 h-3 text-blue-400" />;
			case "lowest":
				return <CheckCircle2 className="w-3 h-3 text-secondary/70" />;
			default:
				return null;
		}
	};

	// Format due date if exists
	const formattedDueDate = card.dueDate
		? formatDistanceToNow(new Date(card.dueDate), { addSuffix: true })
		: null;

	// Determine if card is overdue
	const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={cn(
				"bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 flex flex-col gap-2 border dark:border-gray-700 hover:border-secondary/40 dark:hover:border-secondary/60 cursor-pointer transition-all duration-200 hover:shadow-md",
				getPriorityColor(),
				isDragging &&
					"opacity-70 border-dashed border-secondary shadow-lg scale-105"
			)}
		>
			{/* Card Header */}
			<div className="flex items-center justify-between">
				<span className="font-semibold text-sm truncate dark:text-gray-100">
					{card.title}
				</span>
				<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button size="iconSm" variant="ghost" onClick={onEdit}>
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
								<Button size="iconSm" variant="ghost" onClick={onDelete}>
									<Trash className="w-3.5 h-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Delete Card</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>

			{/* Card Description */}
			{card.description && (
				<div className="text-xs text-muted-foreground dark:text-gray-400 line-clamp-2 bg-muted/30 dark:bg-gray-700/30 p-1.5 rounded-sm">
					{card.description}
				</div>
			)}

			{/* Card Labels */}
			{Array.isArray(card.labels) && card.labels.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{card.labels.map((label: string, i: number) => (
						<Badge
							key={i}
							variant="secondary"
							className="text-xs px-2 py-0.5 bg-secondary/20 dark:bg-secondary/30 text-secondary-foreground dark:text-gray-200"
						>
							{label}
						</Badge>
					))}
				</div>
			)}

			{/* Card Footer */}
			<div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-muted dark:border-gray-700">
				{/* Priority Badge */}
				{card.priority && (
					<div className="flex items-center gap-1">
						{getPriorityIcon()}
						<span className="text-[10px] text-muted-foreground dark:text-gray-400">
							{card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
						</span>
					</div>
				)}

				{/* Due Date */}
				{formattedDueDate && (
					<div
						className={cn(
							"flex items-center gap-1",
							isOverdue && "text-destructive dark:text-red-400"
						)}
					>
						<Clock className="w-3 h-3" />
						<span className="text-[10px] dark:text-gray-400">
							{formattedDueDate}
						</span>
					</div>
				)}

				{/* Assignees */}
				{card.assignees && card.assignees.length > 0 ? (
					<div className="flex -space-x-2">
						{card.assignees
							.slice(0, 3)
							.map((assigneeId: Id<"members">, _index: number) => {
								const assignee = assigneeData[assigneeId];
								const fallback = assignee?.name?.charAt(0).toUpperCase() || "?";

								return (
									<TooltipProvider key={assigneeId}>
										<Tooltip>
											<TooltipTrigger asChild>
												<Avatar className="h-5 w-5 border border-background">
													<AvatarImage
														src={assignee?.image}
														alt={assignee?.name}
													/>
													<AvatarFallback className="text-[10px]">
														{fallback}
													</AvatarFallback>
												</Avatar>
											</TooltipTrigger>
											<TooltipContent>
												<p>{assignee?.name || "Unknown user"}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								);
							})}

						{card.assignees.length > 3 && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Avatar className="h-5 w-5 border border-background bg-muted">
											<AvatarFallback className="text-[10px]">
												+{card.assignees.length - 3}
											</AvatarFallback>
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
					<div className="flex items-center text-muted-foreground dark:text-gray-500">
						<Users className="h-3.5 w-3.5" />
					</div>
				)}
			</div>
		</div>
	);
};

export default BoardCard;
