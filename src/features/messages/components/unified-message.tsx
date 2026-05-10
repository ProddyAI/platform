"use client";

import { useQuery } from "convex/react";
import {
	Clock,
	Download,
	File,
	FileText,
	PaintBucket,
	PhoneOff,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
			| "note-export"
			| "file"
			| "meeting";
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
		// File specific
		fileName?: string;
		fileType?: string;
		fileUrl?: string;
		caption?: string;
		// Meeting specific
		meetingId?: string;
		meetingType?: "instant" | "schedule";
		meetingTime?: string;
		meetingDate?: string;
		startedAt?: number;
	};
}

export const UnifiedMessage = ({ data }: UnifiedMessageProps) => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const [participantNames, setParticipantNames] = useState<string[]>([]);

	// Determine if this is a canvas or note type
	const isCanvas = data.type.includes("canvas");
	const isFile = data.type === "file";
	const isLive = data.type.includes("live");
	const isExport = data.type.includes("export");
	const isMeeting = data.type === "meeting";

	// Get members from the database to display real names for live sessions
	const members = useQuery(api.members.get, { workspaceId });

	// Check meeting status by looking for completed meetingNotes
	const meetingNotes = useQuery(
		api.meetingNotes.getByWorkspace,
		isMeeting && workspaceId ? { workspaceId } : "skip"
	);

	// Determine if the meeting is over
	const meetingStatus = useMemo(() => {
		if (!isMeeting || !data.meetingId || !meetingNotes) return null;
		const note = meetingNotes.find((n: any) =>
			n.roomId?.includes(data.meetingId!)
		);
		if (note && note.status === "completed") {
			const duration = data.startedAt
				? Math.round((note.createdAt - data.startedAt) / 60000)
				: null;
			return { ended: true, duration, createdAt: note.createdAt };
		}
		return null;
	}, [isMeeting, data.meetingId, data.startedAt, meetingNotes]);

	// Update participant names when members data is available
	useEffect(() => {
		if (!isLive || !members || !data.participants) {
			// Reset participant names if members are not available or participants are absent
			setParticipantNames([]);
			return;
		}

		const memberMap = new Map();
		members.forEach((member) => {
			memberMap.set(member.user._id, member.user.name);
		});

		const names = data.participants.map(
			(id) => memberMap.get(id) || "Unknown user"
		);

		setParticipantNames(names);
	}, [members, data.participants, isLive]);

	// Get the appropriate icon
	const Icon = isFile ? File : isCanvas ? PaintBucket : FileText;

	const getParticipantText = () => {
		if (participantNames.length === 0) return "Session in progress";
		const verb = participantNames.length === 1 ? "is" : "are";
		return `${participantNames.join(", ")} ${verb} in session`;
	};

	// Get the title
	const getTitle = () => {
		if (isMeeting) {
			if (meetingStatus?.ended) return "Meeting Ended";
			return data.meetingType === "schedule"
				? "Scheduled Meeting"
				: "Instant Meeting";
		}
		if (isFile) {
			return data.fileName || "File attachment";
		}

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
		if (isMeeting) {
			if (meetingStatus?.ended) return "View Notes";
			return "Join Meeting";
		}
		if (isFile) {
			return "Open File";
		}

		if (isLive) {
			return isCanvas ? "Join Canvas" : "Join Note";
		}
		if (isExport) {
			return isCanvas ? "View Export" : "View Export";
		}
		return isCanvas ? "Open Canvas" : "Open Note";
	};

	// Format duration
	const formatDuration = (minutes: number | null) => {
		if (!minutes || minutes < 1) return "< 1 min";
		if (minutes < 60) return `${minutes} min`;
		const hrs = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hrs}h ${mins}m`;
	};

	// Handle click action
	const handleClick = () => {
		console.log("UnifiedMessage: Button clicked", {
			type: data.type,
			noteId: data.noteId,
			roomId: data.roomId,
		});

		if (isFile) {
			if (data.fileUrl) {
				window.open(data.fileUrl, "_blank", "noopener,noreferrer");
			}
			return;
		}

		if (!workspaceId || !channelId) {
			console.error("UnifiedMessage: Missing workspaceId or channelId", {
				workspaceId,
				channelId,
			});
			return;
		}

		if (isMeeting) {
			if (meetingStatus?.ended) {
				// Go to meeting notes
				router.push(`/workspace/${workspaceId}/meeting-notes`);
				return;
			}
			const meetUrl = `/meet/${data.meetingId}?workspaceId=${workspaceId}${channelId ? `&channelId=${channelId}` : ""}`;
			console.log("UnifiedMessage: Opening meeting in new tab", meetUrl);
			window.open(meetUrl, "_blank");
			return;
		}

		let url = "";

		if (isCanvas) {
			const id = data.roomId || data.savedCanvasId;
			if (!id) {
				console.error("UnifiedMessage: Missing roomId for canvas");
				return;
			}
			url = `/workspace/${workspaceId}/channel/${channelId}/canvas?roomId=${id}&t=${Date.now()}`;
		} else {
			const id = data.noteId || data.roomId;
			if (!id) {
				console.error("UnifiedMessage: Missing noteId for note");
				return;
			}
			// Use the correct noteId parameter
			url = `/workspace/${workspaceId}/channel/${channelId}/notes?noteId=${id}&t=${Date.now()}`;
		}

		console.log("UnifiedMessage: Forcing navigation to", url);
		window.location.href = url;
	};

	const meetingEnded = meetingStatus?.ended;

	return (
		<Card
			className={`w-full max-w-sm shadow-lg border transition-shadow ${
				meetingEnded
					? "!bg-gradient-to-r !from-gray-50 !to-gray-100 dark:!from-zinc-700 dark:!to-zinc-600 border-gray-200 dark:border-zinc-500"
					: "!bg-gradient-to-r !from-slate-50 !to-slate-100 dark:!from-slate-600 dark:!to-slate-500 border-primary/20 dark:border-purple-400/40 hover:shadow-xl"
			}`}
			data-message-component="true"
		>
			<div className="flex items-center justify-between p-3 min-h-[60px] gap-2">
				<div className="flex items-center space-x-2 flex-1 min-w-0">
					<div
						className={`p-1.5 rounded-lg flex-shrink-0 ${meetingEnded ? "bg-gray-200 dark:bg-zinc-600" : "bg-primary/15 dark:bg-purple-400/30"}`}
					>
						{meetingEnded ? (
							<PhoneOff className="h-4 w-4 text-gray-500 dark:text-gray-300" />
						) : (
							<Icon className="h-4 w-4 text-primary dark:!text-purple-100" />
						)}
					</div>
					<div className="flex-1 min-w-0">
						<CardTitle
							className={`text-sm font-semibold truncate ${meetingEnded ? "!text-gray-600 dark:!text-gray-300" : "!text-gray-900 dark:!text-white"}`}
						>
							{getTitle()}
						</CardTitle>

						{isFile && (
							<div className="text-xs !text-gray-600 dark:!text-gray-100 mt-0.5 truncate">
								{data.fileType || "Unknown type"}
								{data.fileSize ? ` - ${data.fileSize}` : ""}
							</div>
						)}

						{/* Meeting ended - show duration and time */}
						{isMeeting && meetingEnded && (
							<div className="mt-1 space-y-0.5">
								<div className="text-[12px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
									<Clock className="w-3 h-3" />
									Duration: {formatDuration(meetingStatus?.duration ?? null)}
								</div>
								<div className="text-[11px] text-gray-400 dark:text-gray-500">
									Ended{" "}
									{meetingStatus?.createdAt
										? new Date(meetingStatus.createdAt).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})
										: ""}
								</div>
							</div>
						)}

						{/* Active meeting status */}
						{isMeeting && !meetingEnded && data.meetingType === "schedule" && (
							<div className="text-[13px] !text-gray-600 dark:!text-gray-300 mt-0.5 truncate font-medium">
								{data.meetingDate} at {data.meetingTime}
							</div>
						)}
						{isMeeting && !meetingEnded && data.meetingType === "instant" && (
							<div className="text-[13px] !text-emerald-700 dark:!text-emerald-400 mt-0.5 truncate font-medium flex items-center gap-1.5">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
								Meeting started
							</div>
						)}

						{/* Show participants for live sessions */}
						{(isLive || (isMeeting && !meetingEnded)) && (
							<div className="flex items-center text-xs !text-gray-600 dark:!text-gray-100 mt-0.5">
								<Users className="h-3 w-3 mr-1 flex-shrink-0 dark:!text-gray-100" />
								<span className="truncate dark:!text-gray-100">
									{getParticipantText()}
								</span>
							</div>
						)}
					</div>
				</div>

				<Button
					className={`flex-shrink-0 font-medium rounded-md transition-all text-xs px-2 py-1 h-auto ${
						meetingEnded
							? "bg-gray-200 dark:!bg-zinc-600 text-gray-600 dark:!text-gray-200 hover:bg-gray-300 dark:hover:!bg-zinc-500"
							: "bg-primary dark:!bg-purple-400 text-white dark:!text-white hover:bg-primary/90 dark:hover:!bg-purple-500"
					}`}
					onClick={handleClick}
					size="sm"
					variant="default"
				>
					{isFile && <Download className="mr-1 h-3 w-3" />}
					{getButtonText()}
				</Button>
			</div>
		</Card>
	);
};
