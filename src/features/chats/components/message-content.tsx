"use client";

import { CalendarIcon, Loader } from "lucide-react";
import dynamic from "next/dynamic";
import { Reactions } from "@/components/reactions";
import { ThreadBar } from "@/components/thread-bar";
import { Thumbnail } from "@/components/thumbnail";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

const Renderer = dynamic(() => import("@/components/renderer"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center">
			<Loader className="size-6 animate-spin text-muted-foreground" />
		</div>
	),
});

const Editor = dynamic(() => import("@/components/editor"), {
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

export const MessageContent = ({
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
	// Check if this contains a custom message component
	const hasCustomMessageComponent =
		body &&
		typeof body === "string" &&
		(body.includes('"type":"canvas"') ||
			body.includes('"type":"note"') ||
			body.includes('"type":"canvas-live"') ||
			body.includes('"type":"note-live"') ||
			body.includes('"type":"canvas-export"') ||
			body.includes('"type":"note-export"'));

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
							"rounded-lg text-sm cursor-pointer",
							// Apply different styling based on whether it's a custom message component
							hasCustomMessageComponent
								? "p-0 bg-transparent" // No padding, no background for custom components
								: cn(
										"max-w-md px-3 pt-2 pb-1.5", // Normal styling for regular messages
										isAuthor
											? "bg-primary text-primary-foreground"
											: "bg-muted dark:bg-gray-800"
									)
						)}
						onContextMenu={onContextMenu}
					>
						{isEditing ? (
							<Editor
								defaultValue={(() => {
									try {
										return JSON.parse(body);
									} catch {
										return "";
									}
								})()}
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
										"text-white [&_.ql-editor]:text-white [&_.ql-editor_*]:text-white [&_p]:text-white [&_span]:text-white [&_div]:text-white [&_strong]:text-white [&_em]:text-white [&_u]:text-white [&_s]:text-white [&_a]:text-white [&_li]:text-white [&_ol]:text-white [&_ul]:text-white [&_blockquote]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_h5]:text-white [&_h6]:text-white"
								)}
							>
								<Renderer calendarEvent={calendarEvent} value={body} />
								<Thumbnail url={image} />

								{calendarEvent && (
									<div
										className={cn(
											"flex items-center gap-1 text-xs mt-1",
											isAuthor ? "text-white/80" : "text-secondary"
										)}
									>
										<CalendarIcon className="h-3 w-3" />
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
						<span
							className={cn(
								"text-xs italic animate-fade-in bg-transparent px-1",
								isAuthor
									? "text-gray-500 dark:text-gray-400"
									: "text-gray-500 dark:text-gray-400"
							)}
						>
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
