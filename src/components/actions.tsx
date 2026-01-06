"use client";

import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRenameModal } from "../features/canvas/hooks/use-rename-modal";

interface ActionsProps {
	children: React.ReactNode;
	side?: "top" | "bottom" | "left" | "right";
	sideOffset?: number;
	id: string;
	title: string;
}

export const Actions = ({
	children,
	side = "bottom",
	sideOffset = 0,
	id,
	title,
}: ActionsProps) => {
	const router = useRouter();
	const { onOpen } = useRenameModal();

	const onDelete = async () => {
		try {
			// In a real app, you would call an API to delete the board
			// await deleteBoard({ id });
			toast.success("Board deleted");
			router.push("/");
		} catch (_error) {
			toast.error("Failed to delete board");
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent
				side={side}
				sideOffset={sideOffset}
				className="w-60"
				onClick={(e) => e.stopPropagation()}
			>
				<DropdownMenuItem onClick={() => onOpen(id, title)}>
					<Trash className="h-4 w-4 mr-2" />
					Rename
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onDelete}>
					<Trash className="h-4 w-4 mr-2" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
