"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface NewCanvasDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export const NewCanvasDialog = ({
	open,
	onOpenChange,
	onConfirm,
}: NewCanvasDialogProps) => {
	const handleConfirm = () => {
		onConfirm();
		onOpenChange(false);
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create New Canvas</DialogTitle>
					<DialogDescription>
						Are you sure you want to create a new canvas? Any unsaved changes in
						the current canvas will be lost.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex flex-row justify-end gap-2 mt-4">
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button onClick={handleConfirm}>Create New Canvas</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
