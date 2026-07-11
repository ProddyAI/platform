import {
	Bot,
	Check,
	GanttChart,
	LayoutGrid,
	Link2,
	Loader2,
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
	onAnalyzeBlockersClick?: () => void;
	analyzeBlockersLoading?: boolean;
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
	<div className="flex items-center bg-muted rounded-full p-1">
		{(
			[
				{ id: "kanban", icon: LayoutGrid, label: "Board" },
				{ id: "gantt", icon: GanttChart, label: "Gantt" },
			] as const
		).map(({ id, icon: Icon, label }) => (
			<Button
				aria-label={label}
				className={cn(
					"h-7 px-3 flex items-center gap-1.5 rounded-full text-xs transition-colors duration-fast",
					view === id
						? "bg-card text-foreground shadow-sm"
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
					className="h-8 gap-1.5 text-xs"
					onClick={onClick}
					size="sm"
					variant="outline"
				>
					<Plus className="w-3.5 h-3.5" />
					<span className="hidden md:inline">Add status</span>
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
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="Search issues"
					className="h-8 w-8 p-0 flex-shrink-0 hover:bg-muted transition-colors"
					onClick={onClick}
					size="icon"
					variant="ghost"
				>
					<Search className="w-4 h-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Search issues (⌘K)</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

interface LinkageDiagramButtonProps {
	onClick?: () => void;
}

const LinkageDiagramButton = ({ onClick }: LinkageDiagramButtonProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="View linkage diagram"
					className="h-8 w-8 p-0 flex-shrink-0 hover:bg-muted transition-colors"
					onClick={onClick}
					size="icon"
					variant="ghost"
				>
					<Network className="w-4 h-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>View issue linkage diagram</TooltipContent>
		</Tooltip>
	</TooltipProvider>
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
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label={
						isConnected && channelName
							? `Connected to #${channelName}. Update connection`
							: "Connect status updates channel"
					}
					className={cn(
						"h-8 w-8 p-0 flex-shrink-0 relative transition-colors",
						isConnected ? "text-success hover:bg-success/10" : "hover:bg-muted"
					)}
					onClick={onClick}
					size="icon"
					variant="ghost"
				>
					<Link2 className="w-4 h-4" />
					{isConnected && (
						<Check className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-background text-success" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				{isConnected && channelName
					? `Connected to #${channelName}. Update connection`
					: "Connect status updates channel"}
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

interface AnalyzeBlockersButtonProps {
	onClick?: () => void;
	loading?: boolean;
}

const AnalyzeBlockersButton = ({
	onClick,
	loading,
}: AnalyzeBlockersButtonProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="Detect blockers"
					className="h-8 gap-1.5 text-xs"
					disabled={loading}
					onClick={onClick}
					size="sm"
					variant="outline"
				>
					{loading ? (
						<>
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
							<span className="hidden md:inline">Detecting…</span>
						</>
					) : (
						<>
							<Bot className="w-3.5 h-3.5" />
							<span className="hidden md:inline">Detect blockers</span>
						</>
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				Auto-detect task dependencies on this board
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
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
	onAnalyzeBlockersClick,
	analyzeBlockersLoading,
}) => {
	return (
		<div className="flex w-full min-w-0 max-w-full items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 bg-background overflow-x-hidden">
			<StatusStats statusCount={statusCount} totalIssues={totalIssues} />

			<div className="flex items-center gap-2">
				<SearchButton onClick={onSearchClick} />
				<LinkageDiagramButton onClick={onLinkageDiagramClick} />
				{onAnalyzeBlockersClick && (
					<AnalyzeBlockersButton
						loading={analyzeBlockersLoading}
						onClick={onAnalyzeBlockersClick}
					/>
				)}
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
