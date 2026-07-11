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
		jsonData?: unknown;
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
	const members = useQuery(api.workspace.members.get, { workspaceId });

	// Check meeting status by looking for completed meetingNotes
	const meetingNotes = useQuery(
		api.content.meetingNotes.getByWorkspace,
		isMeeting && workspaceId ? { workspaceId } : "skip"
	);

	// Determine if the meeting is over
	const meetingStatus = useMemo(() => {
		if (!isMeeting || !data.meetingId || !meetingNotes) return null;
		const note = meetingNotes.find((n) => n.roomId === data.meetingId);
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
		if (isFile) {
			if (data.fileUrl) {
				window.open(data.fileUrl, "_blank", "noopener,noreferrer");
			}
			return;
		}

		if (!workspaceId || !channelId) {
			return;
		}

		if (isMeeting) {
			if (meetingStatus?.ended) {
				// Go to the meetings page (notes for ended meetings live there)
				router.push(`/workspace/${workspaceId}/meeting`);
				return;
			}
			const meetUrl = `/meet/${data.meetingId}?workspaceId=${workspaceId}${channelId ? `&channelId=${channelId}` : ""}`;
			window.open(meetUrl, "_blank", "noopener,noreferrer");
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

		window.location.href = url;
	};

	const meetingEnded = meetingStatus?.ended;

	return (
		<Card className="w-full max-w-sm overflow-hidden">
			<div className="flex min-h-[68px] items-center justify-between gap-4 p-4">
				<div className="flex min-w-0 flex-1 items-center space-x-4">
					<div
						className={`flex-shrink-0 rounded-lg border p-2.5 transition-colors duration-fast ${
							meetingEnded
								? "border-border bg-muted"
								: "border-primary/20 bg-primary/10"
						}`}
					>
						{meetingEnded ? (
							<PhoneOff className="h-4 w-4 text-muted-foreground" />
						) : (
							<div className="relative">
								<Icon className="h-4 w-4 text-primary" />
								<span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-card bg-success motion-safe:animate-pulse" />
							</div>
						)}
					</div>
					<div className="min-w-0 flex-1">
						<CardTitle className="truncate text-sm">{getTitle()}</CardTitle>

						{isFile && (
							<div className="mt-0.5 truncate text-xs text-muted-foreground">
								{data.fileType || "Unknown type"}
								{data.fileSize ? ` • ${data.fileSize}` : ""}
							</div>
						)}

						{/* Meeting ended - show duration and time */}
						{isMeeting && meetingEnded && (
							<div className="mt-1.5 flex flex-col gap-0.5">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Clock className="h-3.5 w-3.5" />
									{formatDuration(meetingStatus?.duration ?? null)}
								</div>
								<div className="text-xs text-muted-foreground">
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
							<div className="mt-1 flex items-center gap-2 truncate text-xs text-muted-foreground">
								<Clock className="h-3.5 w-3.5" />
								{data.meetingDate} at {data.meetingTime}
							</div>
						)}
						{isMeeting && !meetingEnded && data.meetingType === "instant" && (
							<div className="mt-1 flex items-center gap-2 truncate text-xs font-medium text-success">
								<span className="h-2 w-2 rounded-full bg-success motion-safe:animate-pulse" />
								Meeting Active
							</div>
						)}

						{/* Show participants for live sessions */}
						{(isLive || (isMeeting && !meetingEnded)) && (
							<div className="mt-1 flex items-center text-xs text-muted-foreground">
								<Users className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
								<span className="truncate">{getParticipantText()}</span>
							</div>
						)}
					</div>
				</div>

				<Button
					className="flex-shrink-0"
					onClick={handleClick}
					size="sm"
					variant={meetingEnded ? "outline" : "default"}
				>
					{isFile && <Download className="mr-2 h-3.5 w-3.5" />}
					{getButtonText()}
				</Button>
			</div>
		</Card>
	);
};
