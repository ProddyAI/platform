import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioControlButtonProps {
	icon: LucideIcon;
	label: string;
	onClick: () => void;
	isActive?: boolean;
	isMuted?: boolean;
	variant?: "mic" | "speaker" | "action";
	disabled?: boolean;
	className?: string;
}

export const AudioControlButton = ({
	icon: Icon,
	label,
	onClick,
	isActive = true,
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
					? "bg-red-500 hover:bg-red-600 text-white border-red-500"
					: "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200",
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
			className={cn(getButtonStyles(), className)}
			disabled={disabled}
			onClick={onClick}
			size={variant === "action" ? "default" : "icon"}
			title={label}
			variant="ghost"
		>
			<Icon className={cn(variant === "action" ? "h-5 w-5" : "h-5 w-5")} />
			{variant === "action" && <span className="text-sm">{label}</span>}
		</Button>
	);
};
