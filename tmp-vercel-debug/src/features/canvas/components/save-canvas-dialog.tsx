"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface SaveCanvasDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (fileName: string) => void;
}

export const SaveCanvasDialog = ({
	open,
	onOpenChange,
	onSave,
}: SaveCanvasDialogProps) => {
	const _router = useRouter();
	const _workspaceId = useWorkspaceId();
	const _channelId = useChannelId();
	const [fileName, setFileName] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	// Convex mutation for creating a message
	const _createMessage = useMutation(api.messages.create);

	const handleClose = () => {
		setFileName("");
		onOpenChange(false);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!fileName.trim()) {
			toast.error("Please enter a file name");
			return;
		}

		try {
			setIsSaving(true);

			// Call the onSave callback with the file name
			onSave(fileName);

			// Close the dialog
			handleClose();
		} catch (error) {
			console.error("Error saving canvas:", error);
			toast.error("Failed to save canvas");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog onOpenChange={handleClose} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save Canvas</DialogTitle>
					<DialogDescription>
						Enter a name for your canvas. It will be saved and shared in the
						channel.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<Input
						autoFocus
						disabled={isSaving}
						onChange={(e) => setFileName(e.target.value)}
						placeholder="Canvas name"
						required
						value={fileName}
					/>

					<DialogFooter>
						<Button
							disabled={isSaving}
							onClick={handleClose}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={isSaving || !fileName.trim()} type="submit">
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
