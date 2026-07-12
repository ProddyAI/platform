"use client";

import { CalendarIcon, Loader } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import { Reactions } from "@/components/messaging/reactions";
import { ThreadBar } from "@/components/messaging/thread-bar";
import { Thumbnail } from "@/components/messaging/thumbnail";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

const Renderer = dynamic(() => import("@/components/messaging/renderer"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center">
			<Loader className="size-6 animate-spin text-muted-foreground" />
		</div>
	),
});

const Editor = dynamic(() => import("@/components/messaging/editor"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center">
			<Loader className="size-6 animate-spin text-muted-foreground" />
		</div>
	),
});

interface MessageContentProps {
	id: Id<"messages">;
	body: Doc<"messages">["body"];
	image: string | null | undefined;
	isEditing: boolean;
	isAuthor: boolean;
	updatedAt: Doc<"messages">["updatedAt"];
	calendarEvent?: {
		date: number;
		time?: string;
	};
	reactions: Array<
		Omit<Doc<"reactions">, "memberId"> & {
			count: number;
			memberIds: Id<"members">[];
		}
	>;
	threadCount?: number;
	threadImage?: string;
	threadName?: string;
	threadTimestamp?: number;
	isPending: boolean;
	onUpdate: ({ body }: { body: string }) => void;
	onCancel: () => void;
	onReaction: (value: string) => void;
	onOpenMessage: (id: Id<"messages">) => void;
	onContextMenu: (e: React.MouseEvent) => void;
}

const MessageContentComponent = ({
	id,
	body,
	image,
	isEditing,
	isAuthor,
	updatedAt,
	calendarEvent,
	reactions,
	threadCount,
	threadImage,
	threadName,
	threadTimestamp,
	isPending,
	onUpdate,
	onCancel,
	onReaction,
	onOpenMessage,
	onContextMenu,
}: MessageContentProps) => {
	// Custom message components (canvas/note/file) are JSON payloads with a
	// `type` field; parse it instead of matching substrings against the raw body.
	const parsedBodyType = useMemo(() => {
		try {
			const parsed = JSON.parse(body);
			return typeof parsed?.type === "string" ? parsed.type : null;
		} catch {
			return null;
		}
	}, [body]);

	const hasCustomMessageComponent =
		parsedBodyType !== null &&
		(parsedBodyType.includes("canvas") ||
			parsedBodyType.includes("note") ||
			parsedBodyType === "file" ||
			parsedBodyType === "meeting");

	const isFileMessage = parsedBodyType === "file";

	const editorDefaultValue = useMemo(() => {
		try {
			return JSON.parse(body);
		} catch {
			return "";
		}
	}, [body]);

	return (
		<div
			className={cn("flex flex-col bg-transparent", isAuthor && "items-end")}
		>
			<div
				className={cn(
					"relative group/message bg-transparent",
					isAuthor && "flex justify-end"
				)}
			>
				<div className={cn("flex flex-col gap-0.5", isAuthor && "items-end")}>
					<div
						className={cn(
							"chat-bubble rounded-lg text-sm cursor-pointer",
							// Apply different styling based on whether it's a custom message component
							hasCustomMessageComponent
								? "p-0 bg-transparent" // No padding, no background for custom components
								: cn(
										"max-w-md px-3 pt-2 pb-1.5", // Normal styling for regular messages
										isAuthor ? "bg-primary text-primary-foreground" : "bg-muted"
									)
						)}
						onContextMenu={onContextMenu}
						role="group"
					>
						{isEditing ? (
							<Editor
								defaultValue={editorDefaultValue}
								disabled={isPending}
								onCancel={onCancel}
								onSubmit={onUpdate}
								variant="update"
							/>
						) : (
							<div
								className={cn(
									isAuthor &&
										!hasCustomMessageComponent &&
										"text-primary-foreground [&_.ql-editor]:text-primary-foreground [&_.ql-editor_*]:text-primary-foreground [&_p]:text-primary-foreground [&_span]:text-primary-foreground [&_div]:text-primary-foreground [&_strong]:text-primary-foreground [&_em]:text-primary-foreground [&_u]:text-primary-foreground [&_s]:text-primary-foreground [&_a]:text-primary-foreground [&_li]:text-primary-foreground [&_ol]:text-primary-foreground [&_ul]:text-primary-foreground [&_blockquote]:text-primary-foreground [&_h1]:text-primary-foreground [&_h2]:text-primary-foreground [&_h3]:text-primary-foreground [&_h4]:text-primary-foreground [&_h5]:text-primary-foreground [&_h6]:text-primary-foreground"
								)}
							>
								<Renderer
									calendarEvent={calendarEvent}
									image={image}
									value={body}
								/>
								{!isFileMessage && <Thumbnail url={image} />}

								{calendarEvent && (
									<div
										className={cn(
											"flex items-center gap-1 text-xs mt-1",
											isAuthor ? "text-primary-foreground/80" : "text-primary"
										)}
									>
										<CalendarIcon className="size-3" />
										<span>
											Calendar event:{" "}
											{new Date(calendarEvent.date).toLocaleDateString()}
											{calendarEvent.time ? ` at ${calendarEvent.time}` : ""}
										</span>
									</div>
								)}
							</div>
						)}
					</div>

					{!isEditing && updatedAt ? (
						<span className="text-xs italic animate-fade-in bg-transparent px-1 text-muted-foreground">
							(edited)
						</span>
					) : null}
				</div>

				<Reactions data={reactions} onChange={onReaction} />
			</div>
			<ThreadBar
				count={threadCount}
				image={threadImage}
				name={threadName}
				onClick={() => onOpenMessage(id)}
				timestamp={threadTimestamp}
			/>
		</div>
	);
};

export const MessageContent = memo(MessageContentComponent);
