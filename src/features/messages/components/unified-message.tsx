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
import type { Doc } from "@/../convex/_generated/dataModel";
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
		const note = meetingNotes.find((n: any) => n.roomId === data.meetingId);
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
				// Go to meeting notes
				router.push(`/workspace/${workspaceId}/meeting-notes`);
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
		<Card
			className={`w-full max-w-sm border transition-all duration-500 overflow-hidden ${
				meetingEnded
					? "bg-white dark:bg-[#0a0a0f] border-indigo-100 dark:border-indigo-500/20 shadow-2xl shadow-indigo-500/5"
					: "bg-white dark:bg-[#12121a] border-slate-200 dark:border-white/5 hover:border-indigo-500/40 shadow-2xl hover:shadow-indigo-500/10"
			}`}
			data-message-component="true"
		>
			<div className="flex items-center justify-between p-4 min-h-[68px] gap-4">
				<div className="flex items-center space-x-4 flex-1 min-w-0">
					<div
						className={`p-2.5 rounded-2xl flex-shrink-0 transition-colors duration-500 ${
							meetingEnded
								? "bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20"
								: "bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/10"
						}`}
					>
						{meetingEnded ? (
							<PhoneOff className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
						) : (
							<div className="relative">
								<Icon className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-300" />
								{!meetingEnded && (
									<span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-[#12121a] animate-pulse" />
								)}
							</div>
						)}
					</div>
					<div className="flex-1 min-w-0">
						<CardTitle
							className={`text-[14px] font-extrabold tracking-tight truncate ${meetingEnded ? "!text-indigo-950 dark:!text-white" : "!text-slate-900 dark:!text-white"}`}
						>
							{getTitle()}
						</CardTitle>

						{isFile && (
							<div className="text-[11px] !text-slate-500 dark:!text-slate-400 mt-0.5 truncate font-semibold">
								{data.fileType || "Unknown type"}
								{data.fileSize ? ` • ${data.fileSize}` : ""}
							</div>
						)}

						{/* Meeting ended - show duration and time */}
						{isMeeting && meetingEnded && (
							<div className="mt-1.5 flex flex-col gap-0.5">
								<div className="text-[11px] !text-indigo-700 dark:!text-indigo-300 flex items-center gap-2 font-bold">
									<Clock className="w-3.5 h-3.5 text-indigo-500/60 dark:text-indigo-400/60" />
									{formatDuration(meetingStatus?.duration ?? null)}
								</div>
								<div className="text-[10px] !text-indigo-400 dark:!text-slate-500 uppercase tracking-widest font-black pt-0.5">
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
							<div className="text-[12px] !text-slate-700 dark:!text-slate-300 mt-1 truncate font-bold flex items-center gap-2">
								<Clock className="w-3.5 h-3.5 text-indigo-500" />
								{data.meetingDate} at {data.meetingTime}
							</div>
						)}
						{isMeeting && !meetingEnded && data.meetingType === "instant" && (
							<div className="text-[12px] !text-emerald-600 dark:!text-emerald-400 mt-1 truncate font-black flex items-center gap-2 tracking-tight uppercase">
								<div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
								Meeting Active
							</div>
						)}

						{/* Show participants for live sessions */}
						{(isLive || (isMeeting && !meetingEnded)) && (
							<div className="flex items-center text-[11px] !text-slate-600 dark:!text-slate-400 mt-1 font-bold">
								<Users className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-indigo-500/50 dark:text-indigo-400/50" />
								<span className="truncate">{getParticipantText()}</span>
							</div>
						)}
					</div>
				</div>

				<Button
					className={`flex-shrink-0 font-black rounded-2xl transition-all text-[11px] px-4 h-9 shadow-md uppercase tracking-tighter ${
						meetingEnded
							? "!bg-indigo-50 dark:!bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 !text-indigo-700 dark:!text-indigo-400 hover:!bg-indigo-600 hover:!text-white"
							: "!bg-indigo-600 !text-white hover:!bg-indigo-700 shadow-indigo-500/20 border-none"
					}`}
					onClick={handleClick}
					size="sm"
					variant="outline"
				>
					{isFile && <Download className="mr-2 h-3.5 w-3.5" />}
					{getButtonText()}
				</Button>
			</div>
		</Card>
	);
};
