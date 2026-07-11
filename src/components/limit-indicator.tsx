import { AlertTriangle } from "lucide-react";
import Link from "next/link";
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
					className="cursor-pointer gap-1.5 px-2.5 py-1 text-xs font-semibold transition-standard hover:bg-destructive/20"
					variant="destructiveSoft"
				>
					<AlertTriangle className="size-3.5" />
					Limit Reached
				</Badge>
			</Link>
		</Hint>
	);
};
