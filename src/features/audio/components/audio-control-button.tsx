import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioControlButtonProps {
	icon: LucideIcon;
	label: string;
	onClick: () => void;
	isMuted?: boolean;
	variant?: "mic" | "speaker" | "action";
	disabled?: boolean;
	className?: string;
}

export const AudioControlButton = ({
	icon: Icon,
	label,
	onClick,
	isMuted = false,
	variant = "action",
	disabled = false,
	className,
}: AudioControlButtonProps) => {
	const getButtonStyles = () => {
		if (variant === "mic" || variant === "speaker") {
			// Audio control buttons (mic/speaker)
			return cn(
				"h-10 w-10 rounded-full transition-all duration-200 shadow-sm",
				isMuted
					? "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive"
					: "bg-muted hover:bg-muted/80 text-muted-foreground border-border",
				"border-2",
				disabled && "opacity-50 cursor-not-allowed"
			);
		} else {
			// Action buttons (join/leave)
			return cn(
				"px-4 py-2 rounded-full transition-all duration-200 shadow-lg",
				"flex items-center gap-2 font-medium",
				disabled && "opacity-50 cursor-not-allowed"
			);
		}
	};

	return (
		<Button
			aria-label={label}
			aria-pressed={variant !== "action" ? isMuted : undefined}
			className={cn(
				"focus-visible:ring-2 focus-visible:ring-offset-2",
				isMuted ? "focus-visible:ring-destructive" : "focus-visible:ring-ring",
				getButtonStyles(),
				className
			)}
			disabled={disabled}
			onClick={onClick}
			size={variant === "action" ? "default" : "icon"}
			title={label}
			variant="ghost"
		>
			<Icon className="h-5 w-5" />
			{variant === "action" && <span className="text-sm">{label}</span>}
		</Button>
	);
};
