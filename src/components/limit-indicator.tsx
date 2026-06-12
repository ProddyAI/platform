import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Hint } from "@/components/hint";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface LimitIndicatorProps {
	featureLabel: string;
	className?: string;
}

export const LimitIndicator = ({
	featureLabel,
	className,
}: LimitIndicatorProps) => {
	const workspaceId = useWorkspaceId();

	return (
		<Hint
			label={`You have reached the limit for ${featureLabel} on your current plan. Click here to upgrade.`}
			side="top"
		>
			<Link
				className={className}
				href={`/workspace/${workspaceId}/manage#billing`}
			>
				<Badge
					className="cursor-pointer gap-1.5 border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-2.5 py-1 text-xs font-semibold transition-all duration-300 rounded-md animate-pulse"
					variant="destructive"
				>
					<AlertTriangle className="h-3.5 w-3.5" />
					Limit Reached
				</Badge>
			</Link>
		</Hint>
	);
};
