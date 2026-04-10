import {
	GanttChart,
	LayoutGrid,
	Link2,
	Network,
	Plus,
	Search,
} from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BoardHeaderProps {
	totalIssues: number;
	statusCount: number;
	view: "kanban" | "gantt";
	setView: (view: "kanban" | "gantt") => void;
	onAddStatus?: () => void;
	onSearchClick?: () => void;
	onLinkageDiagramClick?: () => void;
	onConnectChannelClick?: () => void;
	isProjectChannelConnected?: boolean;
	connectedChannelName?: string;
}

interface StatusStatsProps {
	totalIssues: number;
	statusCount: number;
}

const StatusStats = ({ totalIssues, statusCount }: StatusStatsProps) => (
	<div className="flex items-center gap-3 text-xs text-muted-foreground">
		<span className="flex items-center gap-1.5">
			<span className="w-2 h-2 rounded-full bg-primary/60" />
			<span>
				<strong className="text-foreground">{statusCount}</strong>{" "}
				{statusCount === 1 ? "status" : "statuses"}
			</span>
		</span>
		<span className="text-border/60">·</span>
		<span>
			<strong className="text-foreground">{totalIssues}</strong>{" "}
			{totalIssues === 1 ? "issue" : "issues"}
		</span>
	</div>
);

interface ViewSwitcherProps {
	view: "kanban" | "gantt";
	setView: (view: "kanban" | "gantt") => void;
}

const ViewSwitcher = ({ view, setView }: ViewSwitcherProps) => (
	<div className="flex items-center bg-muted/50 dark:bg-gray-800/60 rounded-lg p-0.5 border border-border/40 dark:border-gray-700">
		{(
			[
				{ id: "kanban", icon: LayoutGrid, label: "Board" },
				{ id: "gantt", icon: GanttChart, label: "Gantt" },
			] as const
		).map(({ id, icon: Icon, label }) => (
			<Button
				aria-label={label}
				className={cn(
					"h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs transition-all",
					view === id
						? "bg-background dark:bg-gray-900 text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				key={id}
				onClick={() => setView(id)}
				size="sm"
				variant="ghost"
			>
				<Icon className="w-3.5 h-3.5" />
				<span className="hidden sm:inline">{label}</span>
			</Button>
		))}
	</div>
);

interface AddStatusButtonProps {
	onClick?: () => void;
}

const AddStatusButton = ({ onClick }: AddStatusButtonProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="Add status"
					className="h-8 gap-1.5 text-xs border-border/50 dark:border-gray-700 bg-transparent hover:bg-muted/60 dark:hover:bg-gray-800"
					onClick={onClick}
					size="sm"
					variant="outline"
				>
					<Plus className="w-3.5 h-3.5" />
					<span className="hidden md:inline">Add Status</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>Add a new status column</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

interface SearchButtonProps {
	onClick?: () => void;
}

const SearchButton = ({ onClick }: SearchButtonProps) => (
	<Button
		aria-label="Search issues"
		className="h-8 w-8 p-0 flex-shrink-0 hover:bg-white/15 transition-colors"
		onClick={onClick}
		size="icon"
		title="Search issues (⌘K)"
		variant="ghost"
	>
		<Search className="w-4 h-4" />
	</Button>
);

interface LinkageDiagramButtonProps {
	onClick?: () => void;
}

const LinkageDiagramButton = ({ onClick }: LinkageDiagramButtonProps) => (
	<Button
		aria-label="View linkage diagram"
		className="h-8 w-8 p-0 flex-shrink-0 hover:bg-white/15 transition-colors"
		onClick={onClick}
		size="icon"
		title="View issue linkage diagram"
		variant="ghost"
	>
		<Network className="w-4 h-4" />
	</Button>
);

interface ConnectChannelButtonProps {
	onClick?: () => void;
	isConnected?: boolean;
	channelName?: string;
}

const ConnectChannelButton = ({
	onClick,
	isConnected = false,
	channelName,
}: ConnectChannelButtonProps) => (
	<Button
		aria-label="Connect project channel"
		className={cn(
			"h-8 w-8 p-0 flex-shrink-0 transition-colors",
			isConnected
				? "text-emerald-500 hover:bg-emerald-500/10"
				: "hover:bg-white/15"
		)}
		onClick={onClick}
		size="icon"
		title={
			isConnected && channelName
				? `Connected to #${channelName}. Update connection`
				: "Connect status updates channel"
		}
		variant="ghost"
	>
		<Link2 className="w-4 h-4" />
	</Button>
);

const BoardHeader: React.FC<BoardHeaderProps> = ({
	totalIssues,
	statusCount,
	view,
	setView,
	onAddStatus,
	onSearchClick,
	onLinkageDiagramClick,
	onConnectChannelClick,
	isProjectChannelConnected,
	connectedChannelName,
}) => {
	return (
		<div className="flex w-full min-w-0 max-w-full items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 dark:border-gray-800 bg-background dark:bg-gray-950 overflow-x-hidden">
			<StatusStats statusCount={statusCount} totalIssues={totalIssues} />

			<div className="flex items-center gap-2">
				<SearchButton onClick={onSearchClick} />
				<LinkageDiagramButton onClick={onLinkageDiagramClick} />
				{onConnectChannelClick && (
					<ConnectChannelButton
						channelName={connectedChannelName}
						isConnected={isProjectChannelConnected}
						onClick={onConnectChannelClick}
					/>
				)}

				{view === "kanban" && <AddStatusButton onClick={onAddStatus} />}

				<ViewSwitcher setView={setView} view={view} />
			</div>
		</div>
	);
};

export default BoardHeader;
