"use client";

import { useQuery } from "convex/react";
import { FileText, PaintBucket, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface UnifiedMessageProps {
	data: {
		type:
			| "canvas"
			| "note"
			| "canvas-live"
			| "note-live"
			| "canvas-export"
			| "note-export";
		// Canvas specific
		canvasName?: string;
		roomId?: string;
		savedCanvasId?: string;
		// Note specific
		noteId?: string;
		noteTitle?: string;
		previewContent?: string;
		// Live session specific
		participants?: string[];
		// Export specific
		exportedCanvasId?: string;
		exportFormat?: "png" | "svg" | "json" | "pdf" | "markdown" | "html";
		exportTime?: string;
		imageData?: string;
		jsonData?: any;
		exportData?: string;
		fileSize?: string;
	};
}

export const UnifiedMessage = ({ data }: UnifiedMessageProps) => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const [participantNames, setParticipantNames] = useState<string[]>([]);

	// Get members from the database to display real names for live sessions
	const members = useQuery(api.members.get, { workspaceId });

	// Update participant names when members data is available
	useEffect(() => {
		if (members && data.participants) {
			const memberMap = new Map();
			members.forEach((member) => {
				memberMap.set(member.user._id, member.user.name);
			});

			const names = data.participants.map(
				(id) => memberMap.get(id) || "Unknown user"
			);

			setParticipantNames(names);
		}
	}, [members, data.participants]);

	// Determine if this is a canvas or note type
	const isCanvas = data.type.includes("canvas");
	const isLive = data.type.includes("live");
	const isExport = data.type.includes("export");

	// Get the appropriate icon
	const Icon = isCanvas ? PaintBucket : FileText;

	// Get the title
	const getTitle = () => {
		if (isLive) {
			return isCanvas ? "Live Canvas Session" : `Live Note: ${data.noteTitle}`;
		}
		if (isExport) {
			return isCanvas
				? `Canvas Export: ${data.canvasName}`
				: `Note Export: ${data.noteTitle}`;
		}
		return isCanvas ? data.canvasName : data.noteTitle;
	};

	// Get the button text
	const getButtonText = () => {
		if (isLive) {
			return isCanvas ? "Join Canvas" : "Join Note";
		}
		if (isExport) {
			return isCanvas ? "View Export" : "View Export";
		}
		return isCanvas ? "Open Canvas" : "Open Note";
	};

	// Handle click action
	const handleClick = () => {
		if (!workspaceId || !channelId) return;

		let url = "";

		if (isCanvas) {
			if (isLive) {
				// For live canvas, navigate to canvas with room ID
				url = `/workspace/${workspaceId}/channel/${channelId}/canvas?roomId=${data.roomId}&t=${Date.now()}`;
			} else {
				// For regular canvas, navigate with canvas name and room ID
				url = `/workspace/${workspaceId}/channel/${channelId}/canvas?roomId=${data.roomId}&canvasName=${encodeURIComponent(data.canvasName || "")}&t=${Date.now()}`;
			}
		} else {
			// For notes (live or regular)
			if (isLive) {
				url = `/workspace/${workspaceId}/channel/${channelId}/notes?noteId=${data.noteId}&t=${Date.now()}`;
			} else {
				url = `/workspace/${workspaceId}/channel/${channelId}/notes?noteId=${data.noteId}`;
			}
		}

		router.push(url);
	};

	return (
		<Card
			className="w-full max-w-sm !bg-gradient-to-r !from-slate-50 !to-slate-100 dark:!from-slate-600 dark:!to-slate-500 shadow-lg border border-primary/20 dark:border-purple-400/40 hover:shadow-xl transition-shadow"
			data-message-component="true"
		>
			<div className="flex items-center justify-between p-3 min-h-[60px] gap-2">
				<div className="flex items-center space-x-2 flex-1 min-w-0">
					<div className="p-1.5 bg-primary/15 dark:bg-purple-400/30 rounded-lg flex-shrink-0">
						<Icon className="h-4 w-4 text-primary dark:!text-purple-100" />
					</div>
					<div className="flex-1 min-w-0">
						<CardTitle className="text-sm font-semibold text-gray-900 dark:!text-white truncate">
							{getTitle()}
						</CardTitle>

						{/* Show participants for live sessions */}
						{isLive && (
							<div className="flex items-center text-xs text-gray-600 dark:!text-gray-100 mt-0.5">
								<Users className="h-3 w-3 mr-1 flex-shrink-0 dark:!text-gray-100" />
								{participantNames.length > 0 ? (
									<span className="truncate dark:!text-gray-100">
										{participantNames.join(", ")}{" "}
										{participantNames.length === 1 ? "is" : "are"} in session
									</span>
								) : (
									<span className="dark:!text-gray-100">
										Session in progress
									</span>
								)}
							</div>
						)}
					</div>
				</div>

				<Button
					className="flex-shrink-0 bg-primary dark:!bg-purple-400 text-white dark:!text-white hover:bg-primary/90 dark:hover:!bg-purple-500 font-medium rounded-md transition-all text-xs px-2 py-1 h-auto"
					onClick={handleClick}
					size="sm"
					variant="default"
				>
					{getButtonText()}
				</Button>
			</div>
		</Card>
	);
};
