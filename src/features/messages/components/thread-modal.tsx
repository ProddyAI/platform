"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { format } from "date-fns";
import {
	Download,
	File,
	FileText,
	Hash,
	Loader,
	MessageSquare,
	Paintbrush,
	User,
} from "lucide-react";
import type Quill from "quill";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import Editor from "@/components/messaging/editor";
import { Thumbnail } from "@/components/messaging/thumbnail";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCreateMessage } from "@/features/messages/api/use-create-message";
import { useGenerateUploadUrl } from "@/hooks/use-generate-upload-url";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface ThreadMessage {
	message: {
		_id: Id<"messages">;
		_creationTime: number;
		body: string;
		memberId: Id<"members">;
		image?: Id<"_storage">;
		channelId?: Id<"channels">;
		conversationId?: Id<"conversations">;
		parentMessageId?: Id<"messages">;
		workspaceId: Id<"workspaces">;
	};
	parentMessage: {
		_id: Id<"messages">;
		_creationTime: number;
		body: string;
		memberId: Id<"members">;
	};
	parentUser: {
		name: string;
		image?: string;
	};
	currentUser: {
		name: string;
		image?: string;
	};
	context: {
		name: string;
		type: "channel" | "conversation";
		id: Id<"channels"> | Id<"conversations">;
		memberId?: Id<"members">;
	};
}

interface ThreadModalProps {
	isOpen: boolean;
	onClose: () => void;
	thread: ThreadMessage;
}

type ThreadReply = FunctionReturnType<
	typeof api.messaging.messages.get
>["page"][number];

interface ParsedMessageBody {
	type: "text" | "canvas" | "note" | "file";
	content: string;
	caption?: string;
	fileUrl?: string;
	isSpecial: boolean;
}

const SpecialContentChip = ({ parsed }: { parsed: ParsedMessageBody }) => (
	<div className="space-y-2">
		<div className="flex items-center gap-2 rounded-md bg-muted p-2 border border-primary/20">
			{parsed.type === "canvas" ? (
				<span className="text-sm font-medium flex items-center gap-1.5">
					<Paintbrush className="h-4 w-4 text-primary" />
					{parsed.content}
				</span>
			) : parsed.type === "file" ? (
				<div className="flex min-w-0 flex-1 items-center justify-between gap-2">
					<span className="text-sm font-medium flex min-w-0 items-center gap-1.5 truncate">
						<File className="h-4 w-4 text-primary" />
						<span className="truncate">{parsed.content}</span>
					</span>
					{parsed.fileUrl && (
						<Button
							onClick={() =>
								window.open(parsed.fileUrl, "_blank", "noopener,noreferrer")
							}
							size="iconSm"
							variant="ghost"
						>
							<Download className="h-4 w-4" />
						</Button>
					)}
				</div>
			) : (
				<span className="text-sm font-medium flex items-center gap-1.5">
					<FileText className="h-4 w-4 text-primary" />
					{parsed.content}
				</span>
			)}
		</div>
		{parsed.type === "file" && parsed.caption && (
			<p className="text-xs text-muted-foreground break-words">
				{parsed.caption}
			</p>
		)}
	</div>
);

export const ThreadModal = ({ isOpen, onClose, thread }: ThreadModalProps) => {
	const workspaceId = useWorkspaceId();
	const [editorKey, setEditorKey] = useState(0);
	const editorRef = useRef<Quill | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [paginationCursor, setPaginationCursor] = useState<string | null>(null);
	const [allReplies, setAllReplies] = useState<ThreadReply[]>([]);
	const [hasMoreReplies, setHasMoreReplies] = useState(false);

	const { mutate: createMessage, isPending } = useCreateMessage();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();

	const threadReplies = useQuery(
		api.messaging.messages.get,
		thread.message.parentMessageId
			? {
					channelId: thread.message.channelId,
					conversationId: thread.message.conversationId,
					parentMessageId: thread.message.parentMessageId,
					paginationOpts: {
						numItems: 50,
						cursor: paginationCursor,
					},
				}
			: "skip"
	);

	const extractPlainText = (rawBody: string) => {
		try {
			const parsed = JSON.parse(rawBody) as {
				ops?: Array<{ insert?: string | Record<string, unknown> }>;
			};

			if (!parsed.ops) return "";

			return parsed.ops
				.map((op) => (typeof op.insert === "string" ? op.insert : ""))
				.join("")
				.replace(/\n/g, " ")
				.trim();
		} catch {
			return "";
		}
	};

	const buildFileBodyPayload = (rawBody: string, file: File) => {
		const caption = extractPlainText(rawBody);

		return JSON.stringify({
			type: "file",
			fileName: file.name,
			fileType: file.type || "application/octet-stream",
			fileSize: file.size,
			caption,
		});
	};

	useEffect(() => {
		if (threadReplies?.page) {
			if (paginationCursor === null) {
				setAllReplies(threadReplies.page);
			} else {
				setAllReplies((prev) => [...prev, ...threadReplies.page]);
			}
			setHasMoreReplies(Boolean(threadReplies.continueCursor));
		}
	}, [threadReplies?.page, threadReplies?.continueCursor, paginationCursor]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: parentMessageId is a manual trigger to reset pagination when the modal is reused for a different thread, not read directly.
	useEffect(() => {
		setPaginationCursor(null);
		setAllReplies([]);
		setHasMoreReplies(false);
	}, [thread.message.parentMessageId]);

	useEffect(() => {
		if (allReplies.length > 0 && paginationCursor === null) {
			messagesEndRef.current?.scrollIntoView({ block: "end" });
		}
	}, [allReplies.length, paginationCursor]);

	const handleLoadMore = () => {
		if (threadReplies?.continueCursor) {
			setPaginationCursor(threadReplies.continueCursor);
		}
	};

	const isLoadingMoreReplies = paginationCursor !== null && !threadReplies;

	const parseMessageBody = (
		body: string,
		image?: string
	): ParsedMessageBody => {
		try {
			const parsed = JSON.parse(body);

			if (parsed.type?.includes("canvas")) {
				return {
					type: "canvas",
					content: parsed.canvasName || "Untitled Canvas",
					isSpecial: true,
				};
			}

			if (parsed.type?.includes("note")) {
				return {
					type: "note",
					content: parsed.noteTitle || "Untitled Note",
					isSpecial: true,
				};
			}

			if (parsed.type === "file") {
				return {
					type: "file",
					content: parsed.fileName || "File attachment",
					caption:
						typeof parsed.caption === "string" &&
						parsed.caption.trim().length > 0
							? parsed.caption
							: undefined,
					fileUrl: image,
					isSpecial: true,
				};
			}

			if (Array.isArray(parsed.ops)) {
				const text = parsed.ops
					.map((op: { insert?: unknown }) =>
						typeof op.insert === "string" ? op.insert : ""
					)
					.join("")
					.trim();

				return {
					type: "text",
					content: text,
					isSpecial: false,
				};
			}

			return {
				type: "text",
				content: body,
				isSpecial: false,
			};
		} catch (_e) {
			return {
				type: "text",
				content: body,
				isSpecial: false,
			};
		}
	};

	const handleSubmit = async ({
		body,
		image,
	}: {
		body: string;
		image: File | null;
	}) => {
		if (!workspaceId) {
			toast.error("Workspace not found");
			return;
		}

		try {
			let storageId: Id<"_storage"> | undefined;

			if (image) {
				const url = await generateUploadUrl(
					{},
					{
						throwError: true,
					}
				);

				if (!url) throw new Error("URL not found.");

				const result = await fetch(url, {
					method: "POST",
					headers: { "Content-type": image.type },
					body: image,
				});

				if (!result.ok) throw new Error("Failed to upload image.");

				const { storageId: uploadedStorageId } = await result.json();
				storageId = uploadedStorageId;
			}

			await createMessage(
				{
					workspaceId,
					channelId: thread.message.channelId,
					conversationId: thread.message.conversationId,
					parentMessageId: thread.message.parentMessageId,
					body:
						image && !image.type.startsWith("image/")
							? buildFileBodyPayload(body, image)
							: body,
					...(storageId && { image: storageId }),
				},
				{
					onSuccess: () => {
						setEditorKey((prev) => prev + 1);
					},
					throwError: true,
				}
			);
		} catch (error) {
			console.error("Failed to send message:", error);
			toast.error("Failed to send message", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		}
	};

	const parsedParentBody = parseMessageBody(thread.parentMessage.body);

	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<DialogContent className="max-w-2xl h-[80vh] p-0 flex flex-col gap-0">
				{/* Header */}
				<div className="flex items-center gap-3 p-4 border-b flex-shrink-0">
					<MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
					<div className="min-w-0 flex-1">
						<h2 className="text-lg font-semibold">Thread</h2>
						<div className="flex min-w-0 items-center gap-2 mt-1">
							<Badge
								className={`min-w-0 max-w-full rounded-full text-xs ${
									thread.context.type === "channel"
										? "bg-primary/10 text-primary border-primary/30"
										: "bg-muted text-foreground border-border"
								}`}
								variant="outline"
							>
								{thread.context.type === "channel" ? (
									<span className="flex min-w-0 items-center gap-1">
										<Hash className="h-3 w-3 flex-shrink-0" />
										<span className="truncate">{thread.context.name}</span>
									</span>
								) : (
									<span className="flex min-w-0 items-center gap-1">
										<User className="h-3 w-3 flex-shrink-0" />
										<span className="truncate">{thread.context.name}</span>
									</span>
								)}
							</Badge>
						</div>
					</div>
				</div>

				<ScrollArea className="flex-1 p-4">
					<div className="space-y-4">
						<div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
							<div className="flex items-start gap-3">
								<Avatar className="h-10 w-10 flex-shrink-0">
									<AvatarImage src={thread.parentUser.image} />
									<AvatarFallback>
										{thread.parentUser.name.charAt(0)}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="font-semibold text-sm">
											{thread.parentUser.name}
										</span>
										<span className="text-xs text-muted-foreground">
											{format(
												new Date(thread.parentMessage._creationTime),
												"MMM d, h:mm a"
											)}
										</span>
									</div>
									{parsedParentBody.isSpecial ? (
										<SpecialContentChip parsed={parsedParentBody} />
									) : (
										<p className="text-sm break-words whitespace-pre-wrap">
											{parsedParentBody.content}
										</p>
									)}
								</div>
							</div>
						</div>

						<Separator />

						{allReplies.length === 0 && !threadReplies ? (
							<div className="flex items-center justify-center py-8">
								<Loader className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : (
							<>
								{hasMoreReplies && (
									<div className="flex justify-center pb-4">
										<Button
											className="text-xs"
											disabled={isLoadingMoreReplies}
											onClick={handleLoadMore}
											size="sm"
											variant="outline"
										>
											{isLoadingMoreReplies ? (
												<>
													<Loader className="mr-1.5 h-3 w-3 animate-spin" />
													Loading…
												</>
											) : (
												"Load older replies"
											)}
										</Button>
									</div>
								)}

								{allReplies.length > 0 ? (
									<div className="space-y-3">
										{allReplies
											.slice()
											.sort((a, b) => a._creationTime - b._creationTime)
											.map((reply) => {
												const parsedReplyBody = parseMessageBody(
													reply.body,
													reply.image
												);
												return (
													<div
														className="flex items-start gap-3 pl-4"
														key={reply._id}
													>
														<Avatar className="h-8 w-8 flex-shrink-0">
															<AvatarImage src={reply.user?.image} />
															<AvatarFallback>
																{reply.user?.name?.charAt(0) || "?"}
															</AvatarFallback>
														</Avatar>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 mb-1">
																<span className="font-medium text-sm">
																	{reply.user?.name || "Unknown"}
																</span>
																<span className="text-xs text-muted-foreground">
																	{format(
																		new Date(reply._creationTime),
																		"MMM d, h:mm a"
																	)}
																</span>
															</div>
															{parsedReplyBody.isSpecial ? (
																<SpecialContentChip parsed={parsedReplyBody} />
															) : (
																<>
																	<p className="text-sm break-words whitespace-pre-wrap">
																		{parsedReplyBody.content}
																	</p>
																	{reply.image && (
																		<Thumbnail url={reply.image} />
																	)}
																</>
															)}
														</div>
													</div>
												);
											})}
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
										<MessageSquare className="h-8 w-8 mb-2" />
										<p className="text-sm">No replies yet</p>
									</div>
								)}
							</>
						)}
						<div ref={messagesEndRef} />
					</div>
				</ScrollArea>

				<div className="border-t p-4 flex-shrink-0 bg-card">
					<Editor
						channelId={thread.message.channelId}
						conversationId={thread.message.conversationId}
						disabled={isPending}
						innerRef={editorRef}
						key={editorKey}
						onSubmit={handleSubmit}
						placeholder="Reply to thread..."
						variant="create"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
};
