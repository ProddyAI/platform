"use client";

import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Send } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface BoardCardCommentsProps {
	cardId: Id<"cards">;
}

export const BoardCardComments: React.FC<BoardCardCommentsProps> = ({
	cardId,
}) => {
	const [commentContent, setCommentContent] = useState("");

	const comments = useQuery(
		api.board.getComments,
		cardId ? { cardId } : "skip"
	);
	const addComment = useMutation(api.board.addComment);

	const handleAddComment = async () => {
		if (!commentContent.trim()) return;

		try {
			await addComment({
				cardId,
				content: commentContent.trim(),
			});
			setCommentContent("");
		} catch (error) {
			console.error("Failed to add comment:", error);
		}
	};

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center gap-2">
				<MessageCircle className="w-4 h-4" />
				<h3 className="text-sm font-semibold">Comments</h3>
				{comments && comments.length > 0 && (
					<span className="text-xs text-muted-foreground">
						({comments.length})
					</span>
				)}
			</div>

			{/* Comments list */}
			<ScrollArea className="h-[200px] rounded-md border p-3">
				{comments && comments.length > 0 ? (
					<div className="space-y-3">
						{comments.map((comment) => (
							<div className="flex gap-2" key={comment._id}>
								<Avatar className="h-7 w-7 shrink-0">
									<AvatarImage
										alt={comment.member.user.name || "User"}
										src={comment.member.user.image}
									/>
									<AvatarFallback className="text-xs">
										{comment.member.user.name?.charAt(0).toUpperCase() || "?"}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 space-y-1">
									<div className="flex items-baseline gap-2">
										<span className="text-xs font-medium">
											{comment.member.user.name || "Unknown"}
										</span>
										<span className="text-[10px] text-muted-foreground">
											{formatDistanceToNow(new Date(comment.createdAt), {
												addSuffix: true,
											})}
										</span>
									</div>
									<p className="text-sm text-muted-foreground whitespace-pre-wrap">
										{comment.content}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						No comments yet. Be the first to comment!
					</div>
				)}
			</ScrollArea>

			{/* Add comment */}
			<div className="space-y-2">
				<Textarea
					className="min-h-[60px] text-sm"
					onChange={(e) => setCommentContent(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							handleAddComment();
						}
					}}
					placeholder="Write a comment..."
					value={commentContent}
				/>
				<div className="flex items-center justify-between">
					<span className="text-xs text-muted-foreground">
						Cmd/Ctrl + Enter to send
					</span>
					<Button
						disabled={!commentContent.trim()}
						onClick={handleAddComment}
						size="sm"
					>
						<Send className="w-3.5 h-3.5 mr-1" />
						Comment
					</Button>
				</div>
			</div>
		</div>
	);
};
