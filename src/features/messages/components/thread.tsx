"use client";

import { differenceInMinutes, format, isToday, isYesterday } from "date-fns";
import { AlertTriangle, Check, Edit2, Loader, X, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import type Quill from "quill";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Id } from "@/../convex/_generated/dataModel";
import { Message } from "@/components/message";
import { Button } from "@/components/ui/button";
import { ContextMenuProvider } from "@/features/chats/contexts/context-menu-context";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useCreateMessage } from "@/features/messages/api/use-create-message";
import { useGetMessage } from "@/features/messages/api/use-get-message";
import { useGetMessages } from "@/features/messages/api/use-get-messages";
import { useGetThreadTitle } from "@/features/messages/api/use-get-thread-title";
import { useUpdateThreadTitle } from "@/features/messages/api/use-update-thread-title";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const Editor = dynamic(() => import("@/components/editor"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center">
			<Loader className="size-6 animate-spin text-muted-foreground" />
		</div>
	),
});

const TIME_THRESHOLD = 15;

const formatDateLabel = (dateStr: string) => {
	const date = new Date(dateStr);

	if (isToday(date)) return "Today";
	if (isYesterday(date)) return "Yesterday";

	return format(date, "EEEE, MMMM d");
};

type CreateMessageValues = {
	channelId: Id<"channels">;
	workspaceId: Id<"workspaces">;
	parentMessageId: Id<"messages">;
	body: string;
	image?: Id<"_storage">;
};

interface ThreadProps {
	messageId: Id<"messages">;
	onClose: () => void;
}

export const Thread = ({ messageId, onClose }: ThreadProps) => {
	const channelId = useChannelId();
	const workspaceId = useWorkspaceId();

	const [editingId, setEditingId] = useState<Id<"messages"> | null>(null);
	const [editorKey, setEditorKey] = useState(0);
	const [isPending, setIsPending] = useState(false);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleInput, setTitleInput] = useState<string>("");

	const innerRef = useRef<Quill | null>(null);

	const { data: currentMember } = useCurrentMember({ workspaceId });
	const { data: message, isLoading: isMessageLoading } = useGetMessage({
		id: messageId,
	});
	const { title: savedTitle } = useGetThreadTitle(messageId);
	const { updateTitle } = useUpdateThreadTitle();

	// Initialize title input with saved title
	useEffect(() => {
		if (savedTitle) {
			setTitleInput(savedTitle);
		}
	}, [savedTitle]);

	const { mutate: createMessage } = useCreateMessage();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();
	const { results, status, loadMore } = useGetMessages({
		channelId,
		parentMessageId: messageId,
	});

	const canLoadMore = status === "CanLoadMore";
	const isLoadingMore = status === "LoadingMore";

	const handleSubmit = async ({
		body,
		image,
	}: {
		body: string;
		image: File | null;
	}) => {
		try {
			setIsPending(true);
			innerRef.current?.enable(false);

			const values: CreateMessageValues = {
				channelId,
				workspaceId,
				parentMessageId: messageId,
				body,
				image: undefined,
			};

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

				const { storageId } = await result.json();

				values.image = storageId;
			}

			await createMessage(values, { throwError: true });

			setEditorKey((prevKey) => prevKey + 1);
		} catch (_error) {
			toast.error("Failed to send message.");
		} finally {
			setIsPending(false);
			innerRef?.current?.enable(true);
		}
	};

	const groupedMessages = results?.reduce(
		(groups, message) => {
			const date = new Date(message._creationTime);
			const dateKey = format(date, "yyyy-MM-dd");

			if (!groups[dateKey]) {
				groups[dateKey] = [];
			}

			groups[dateKey].unshift(message);

			return groups;
		},
		{} as Record<string, typeof results>
	);

	const handleSaveTitle = async () => {
		if (titleInput.trim()) {
			try {
				await updateTitle(messageId, titleInput.trim(), workspaceId);
				setIsEditingTitle(false);
				toast.success("Thread title saved");
			} catch (_error) {
				toast.error("Failed to save thread title");
			}
		}
	};

	const handleEditTitle = () => {
		setIsEditingTitle(true);
	};

	if (isMessageLoading || status === "LoadingFirstPage") {
		return (
			<div className="flex h-full flex-col border-l border-border">
				<div className="flex h-[49px] items-center justify-between border-b px-4">
					<p className="text-lg font-bold">Thread</p>

					<Button onClick={onClose} size="iconSm" variant="ghost">
						<XIcon className="size-5 stroke-[1.5]" />
					</Button>
				</div>

				<div className="flex h-full items-center justify-center">
					<Loader className="size-5 animate-spin text-muted-foreground" />
				</div>
			</div>
		);
	}

	if (!message) {
		return (
			<div className="flex h-full flex-col border-l border-border">
				<div className="flex h-[49px] items-center justify-between border-b px-4">
					<p className="text-lg font-bold">Thread</p>

					<Button onClick={onClose} size="iconSm" variant="ghost">
						<XIcon className="size-5 stroke-[1.5]" />
					</Button>
				</div>

				<div className="flex h-full flex-col items-center justify-center gap-y-2">
					<AlertTriangle className="size-5 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Message not found.</p>
				</div>
			</div>
		);
	}

	return (
		<ContextMenuProvider>
			<div className="flex h-full flex-col border-l border-border">
				<div className="flex h-auto flex-col border-b px-4 py-3">
					<div className="flex items-center justify-between mb-2">
						{isEditingTitle ? (
							<div className="flex items-center gap-2 flex-1">
								<input
									className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
									onChange={(e) => setTitleInput(e.target.value)}
									placeholder="Enter thread title..."
									type="text"
									value={titleInput}
								/>
								<Button
									className="h-6 w-6"
									onClick={handleSaveTitle}
									size="iconSm"
									variant="ghost"
								>
									<Check className="size-4" />
								</Button>
								<Button
									className="h-6 w-6"
									onClick={() => setIsEditingTitle(false)}
									size="iconSm"
									variant="ghost"
								>
									<X className="size-4" />
								</Button>
							</div>
						) : (
							<div className="flex items-center gap-2 flex-1">
								<p className="text-lg font-bold">{savedTitle || "Thread"}</p>
								<Button
									className="h-6 w-6"
									onClick={handleEditTitle}
									size="iconSm"
									variant="ghost"
								>
									<Edit2 className="size-4" />
								</Button>
							</div>
						)}

						<Button onClick={onClose} size="iconSm" variant="ghost">
							<XIcon className="size-5 stroke-[1.5]" />
						</Button>
					</div>
				</div>

				<div className="messages-scrollbar flex flex-1 flex-col-reverse overflow-y-auto pb-4">
					{Object.entries(groupedMessages || {}).map(([dateKey, messages]) => (
						<div key={dateKey}>
							<div className="relative my-2 text-center">
								<hr className="absolute left-0 right-0 top-1/2 border-t border-gray-300" />

								<span className="relative inline-block rounded-full border border-gray-300 bg-white px-4 py-1 text-xs shadow-sm">
									{formatDateLabel(dateKey)}
								</span>
							</div>

							{messages.map((message, i) => {
								const prevMessage = messages[i - 1];
								const isCompact =
									prevMessage &&
									prevMessage.user._id === message.user._id &&
									differenceInMinutes(
										new Date(message._creationTime),
										new Date(prevMessage._creationTime)
									) < TIME_THRESHOLD;

								return (
									<Message
										authorImage={message.user.image}
										authorName={message.user.name}
										body={message.body}
										createdAt={message._creationTime}
										hideThreadButton
										id={message._id}
										image={message.image}
										isAuthor={message.memberId === currentMember?._id}
										isCompact={isCompact}
										isEditing={editingId === message._id}
										key={message._id}
										memberId={message.memberId}
										reactions={message.reactions}
										setEditingId={setEditingId}
										threadCount={message.threadCount}
										threadImage={message.threadImage}
										threadName={message.threadName}
										threadTimestamp={message.threadTimestamp}
										updatedAt={message.updatedAt}
									/>
								);
							})}
						</div>
					))}

					<div
						className="h-1"
						ref={(el) => {
							if (el) {
								const observer = new IntersectionObserver(
									([entry]) => {
										if (entry.isIntersecting && canLoadMore) loadMore();
									},
									{ threshold: 1.0 }
								);

								observer.observe(el);

								return () => observer.disconnect();
							}
						}}
					/>

					{isLoadingMore && (
						<div className="relative my-2 text-center">
							<hr className="absolute left-0 right-0 top-1/2 border-t border-gray-300" />

							<span className="relative inline-block rounded-full border border-gray-300 bg-white px-4 py-1 text-xs shadow-sm">
								<Loader className="size-4 animate-spin" />
							</span>
						</div>
					)}

					<Message
						authorImage={message.user.image}
						authorName={message.user.name}
						body={message.body}
						createdAt={message._creationTime}
						hideThreadButton
						id={message._id}
						image={message.image}
						isAuthor={message.memberId === currentMember?._id}
						isEditing={editingId === message._id}
						memberId={message.memberId}
						reactions={message.reactions}
						setEditingId={setEditingId}
						updatedAt={message.updatedAt}
					/>
				</div>

				<div className="px-4">
					<Editor
						disabled={isPending}
						innerRef={innerRef}
						key={editorKey}
						onSubmit={handleSubmit}
						placeholder="Reply..."
					/>
				</div>
			</div>
		</ContextMenuProvider>
	);
};
