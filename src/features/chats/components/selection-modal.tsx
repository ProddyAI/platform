"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Copy, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useRemoveMessage } from "@/features/messages/api/use-remove-message";
import { SummaryModal } from "@/features/smart/components/summary-modal";
import { useMessageSelection } from "@/features/smart/contexts/message-selection-context";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const SelectionModal = () => {
	const { selectedMessages, clearSelectedMessages } = useMessageSelection();
	const [isSummarizing, setIsSummarizing] = useState(false);
	const [summaryData, setSummaryData] = useState<{
		summary: string;
		isCached: boolean;
	} | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const workspaceId = useWorkspaceId();
	const { mutate: removeMessage } = useRemoveMessage();
	const { data: currentMember } = useCurrentMember({ workspaceId });
	const [ConfirmDialog, confirm] = useConfirm(
		"Delete selected messages",
		"Are you sure you want to delete the selected messages? This cannot be undone."
	);

	// Fetch message content for each selected message - more efficiently
	const messageContents = useQuery(api.messages.getMessageBodies, {
		messageIds: selectedMessages.length > 0 ? selectedMessages : [],
	});

	// Early return if no messages selected
	if (selectedMessages.length === 0) {
		return null;
	}

	const handleSummarize = async () => {
		try {
			setIsSummarizing(true);

			// If we're still loading message contents, show a message
			if (!messageContents) {
				toast.error("Loading message content, please try again in a moment");
				setIsSummarizing(false);
				return;
			}

			// Check if we have too many messages selected
			if (selectedMessages.length > 200) {
				toast.warning(
					"Too many messages selected. Please select fewer messages for better summarization.",
					{
						duration: 5000,
					}
				);
			}

			// Format messages with author names and timestamps
			const formattedMessages = messageContents.map((msg) => ({
				body: msg.body,
				authorName: msg.authorName,
				creationTime: msg.creationTime,
			}));

			// Show loading toast for better UX
			const loadingToast = toast.loading("Generating summary...", {
				duration: 10000,
			});

			const response = await fetch("/api/smart/summarize", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ messages: formattedMessages }),
				credentials: "include",
			});

			// Dismiss loading toast
			toast.dismiss(loadingToast);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to summarize messages");
			}

			const data = await response.json();
			const summary = data.summary;

			// Set summary data and open modal
			setSummaryData({
				summary,
				isCached: Boolean(data.cached),
			});
			setIsModalOpen(true);

			// Show a small toast notification
			toast.success(
				data.cached
					? "Summary retrieved from cache"
					: "Summary generated successfully"
			);

			// Don't clear selected messages until modal is closed
		} catch (error) {
			console.error("Error summarizing messages:", error);
			toast.error("Failed to summarize messages. Please try again.");
		} finally {
			setIsSummarizing(false);
		}
	};

	// Handle modal close
	const handleModalClose = () => {
		setIsModalOpen(false);
		clearSelectedMessages();
	};

	// Handle copying selected messages
	const handleCopyMessages = async () => {
		try {
			if (!messageContents) {
				toast.error("Loading message content, please try again in a moment");
				return;
			}

			// Format messages for copying
			const formattedText = messageContents
				.map((msg) => {
					const timestamp = format(
						new Date(msg.creationTime),
						"MMM d, yyyy h:mm a"
					);
					return `${msg.authorName} (${timestamp}):\n${msg.body}`;
				})
				.join("\n\n");

			await navigator.clipboard.writeText(formattedText);
			toast.success(`${selectedMessages.length} messages copied to clipboard`);
		} catch (error) {
			console.error("Error copying messages:", error);
			toast.error("Failed to copy messages");
		}
	};

	// Handle deleting selected messages
	const handleDeleteMessages = async () => {
		try {
			// Check if all selected messages are from the current user
			if (!messageContents || !currentMember) {
				toast.error("Unable to verify message ownership");
				return;
			}

			const allOwnedByCurrentUser = messageContents.every(
				(msg) => msg.memberId === currentMember._id
			);

			if (!allOwnedByCurrentUser) {
				toast.error("You can only delete messages that you sent");
				return;
			}

			const ok = await confirm();
			if (!ok) return;

			setIsDeleting(true);

			// Delete messages one by one (since there's no bulk delete API)
			let deletedCount = 0;
			for (const messageId of selectedMessages) {
				try {
					await removeMessage({ id: messageId });
					deletedCount++;
				} catch (error) {
					console.error(`Failed to delete message ${messageId}:`, error);
				}
			}

			if (deletedCount === selectedMessages.length) {
				toast.success(`${deletedCount} messages deleted successfully`);
			} else {
				toast.warning(
					`${deletedCount} of ${selectedMessages.length} messages deleted`
				);
			}

			clearSelectedMessages();
		} catch (error) {
			console.error("Error deleting messages:", error);
			toast.error("Failed to delete messages");
		} finally {
			setIsDeleting(false);
		}
	};

	// Check if all selected messages are owned by current user
	const canDeleteMessages =
		messageContents &&
		currentMember &&
		messageContents.every((msg) => msg.memberId === currentMember._id);

	return (
		<>
			<ConfirmDialog />
			{summaryData && (
				<SummaryModal
					isCached={summaryData.isCached}
					isOpen={isModalOpen}
					messageCount={selectedMessages.length}
					onClose={handleModalClose}
					summary={summaryData.summary}
				/>
			)}

			<div className="fixed bottom-6 right-6 z-50">
				<div className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-lg dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700">
					<span className="text-sm font-medium pl-2">
						{selectedMessages.length}{" "}
						{selectedMessages.length === 1 ? "message" : "messages"} selected
					</span>

					<Button
						aria-label="Copy selected messages"
						disabled={!messageContents}
						onClick={handleCopyMessages}
						size="sm"
						variant="outline"
					>
						<Copy className="mr-2 size-4" />
						Copy
					</Button>

					{canDeleteMessages && (
						<Button
							aria-label="Delete selected messages"
							className="text-destructive hover:text-destructive"
							disabled={isDeleting || !messageContents}
							onClick={handleDeleteMessages}
							size="sm"
							variant="outline"
						>
							<Trash2 className="mr-2 size-4" />
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					)}

					<Button
						aria-label="Summarize selected messages"
						className="bg-secondary text-white hover:bg-secondary/70"
						disabled={isSummarizing || !messageContents}
						onClick={handleSummarize}
					>
						<Sparkles className="mr-2 size-4" />
						{isSummarizing ? "Summarizing..." : "Summarize"}
					</Button>
				</div>
			</div>
		</>
	);
};
