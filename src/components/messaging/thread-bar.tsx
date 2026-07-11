import { ChevronRight } from "lucide-react";

interface ThreadBarProps {
	count?: number;
	image?: string;
	name?: string;
	timestamp?: number;
	onClick?: () => void;
}

const formatRelativeTime = (timestamp: number) => {
	const diffMs = Date.now() - timestamp;
	const diffMinutes = Math.round(diffMs / 60000);

	if (diffMinutes < 1) return "just now";
	if (diffMinutes < 60) return `${diffMinutes}m ago`;

	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;

	const diffDays = Math.round(diffHours / 24);
	return `${diffDays}d ago`;
};

export const ThreadBar = ({ count, timestamp, onClick }: ThreadBarProps) => {
	if (!count || !timestamp) return null;

	return (
		<button
			className="group mt-2 flex items-center gap-1 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">
				{count} {count === 1 ? "reply" : "replies"} · last reply{" "}
				{formatRelativeTime(timestamp)}
			</span>
			<ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
		</button>
	);
};
