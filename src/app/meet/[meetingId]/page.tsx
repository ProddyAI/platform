"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
	StreamCall,
	StreamVideo,
	StreamVideoClient,
	SpeakerLayout,
	PaginatedGridLayout,
	StreamTheme,
	SpeakingWhileMutedNotification,
	ToggleAudioPublishingButton,
	ToggleVideoPublishingButton,
	ScreenShareButton,
	CancelCallButton,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Loader2, Users, Sparkles, MessageSquare, Copy, Check, Hand, LayoutGrid, Presentation } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
	MeetingRecordButton,
	MeetingReactions,
	CaptionsOverlay,
	CustomParticipantList,
	NotesSidebar,
	MeetingChat,
} from "./meeting-components";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;

export default function MeetingPage({
	params,
}: {
	params: { meetingId: string };
}) {
	const [client, setClient] = useState<StreamVideoClient | null>(null);
	const [call, setCall] = useState<any>(null);
	const clientRef = useRef<StreamVideoClient | null>(null);
	const callRef = useRef<any>(null);
	const { isAuthenticated, isLoading } = useConvexAuth();
	const user = useQuery(api.users.current);
	const router = useRouter();
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspaceId") || "";
	const channelId = searchParams.get("channelId") || "";

	// UI State
	const [showNotes, setShowNotes] = useState(false);
	const [showParticipants, setShowParticipants] = useState(false);
	const [showChat, setShowChat] = useState(false);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	const [handRaised, setHandRaised] = useState(false);
	const [viewMode, setViewMode] = useState<"speaker" | "grid">("speaker");

	// Recording State
	const [isRecording, setIsRecording] = useState(false);
	const [liveTranscript, setLiveTranscript] = useState("");
	const liveTranscriptRef = useRef("");

	// Meeting Timer — persists across page refresh via sessionStorage
	const [joinTime] = useState(() => {
		if (typeof window !== "undefined") {
			const stored = sessionStorage.getItem(`meet-join-${params.meetingId}`);
			if (stored) return parseInt(stored, 10);
			const now = Date.now();
			sessionStorage.setItem(`meet-join-${params.meetingId}`, String(now));
			return now;
		}
		return Date.now();
	});
	const [elapsed, setElapsed] = useState("00:00:00");

	const handleTranscriptUpdate = useCallback((transcript: string) => {
		// Store in ref immediately (no re-render)
		liveTranscriptRef.current = transcript;
	}, []);

	// Sync ref → state every 3 seconds to update captions without excessive re-renders
	useEffect(() => {
		if (!isRecording) return;
		const interval = setInterval(() => {
			setLiveTranscript(liveTranscriptRef.current);
		}, 3000);
		return () => clearInterval(interval);
	}, [isRecording]);

	const handleRecordingChange = useCallback((recording: boolean) => {
		setIsRecording(recording);
	}, []);

	// Elapsed time ticker
	useEffect(() => {
		const interval = setInterval(() => {
			const diff = Date.now() - joinTime;
			const hrs = String(Math.floor(diff / 3600000)).padStart(2, "0");
			const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
			const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
			setElapsed(`${hrs}:${mins}:${secs}`);
		}, 1000);
		return () => clearInterval(interval);
	}, [joinTime]);

	// Store return URL on mount
	useEffect(() => {
		if (workspaceId && typeof window !== "undefined") {
			const returnUrl = channelId
				? `/workspace/${workspaceId}/channel/${channelId}/chats`
				: `/workspace/${workspaceId}`;
			sessionStorage.setItem(`meet-return-${params.meetingId}`, returnUrl);
		}
	}, [workspaceId, channelId, params.meetingId]);

	// Stream Video init
	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated) {
			router.push("/auth/signin");
			return;
		}
		if (!user) return;

		let mounted = true;
		const initStream = async () => {
			try {
				const response = await fetch("/api/stream", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId: user._id }),
				});
				const data = await response.json();
				if (!mounted) return;

				const streamUser = {
					id: user._id,
					name: user.name || "Anonymous",
					image: user.image || undefined,
				};

				const streamClient = new StreamVideoClient({
					apiKey,
					user: streamUser,
					token: data.token,
				});

				const streamCall = streamClient.call("default", params.meetingId);
				await streamCall.join({ create: true });
				if (!mounted) return;
				clientRef.current = streamClient;
				callRef.current = streamCall;
				setClient(streamClient);
				setCall(streamCall);
			} catch (err) {
				console.error("Failed to initialize Stream:", err);
				toast.error("Failed to connect to meeting room");
			}
		};

		initStream();
		return () => {
			mounted = false;
			// Cleanup: disconnect Stream client on unmount
			if (callRef.current) {
				callRef.current.leave().catch(() => {});
			}
			if (clientRef.current) {
				clientRef.current.disconnectUser().catch(() => {});
			}
		};
	}, [isAuthenticated, isLoading, user, params.meetingId, router]);

	// Leave flow
	const handleLeave = async () => {
		try {
			if (call) await call.leave();
			if (client) await client.disconnectUser();
		} catch (e) {
			console.error("Error leaving call:", e);
		}
		
		const returnUrl = sessionStorage.getItem(`meet-return-${params.meetingId}`);
		sessionStorage.removeItem(`meet-join-${params.meetingId}`);
		sessionStorage.removeItem(`meet-return-${params.meetingId}`);

		if (window.opener) {
			window.close();
		}
		// Always redirect — window.close() may fail in some browsers
		if (returnUrl) {
			router.push(returnUrl);
		} else {
			setShowLeaveModal(true);
		}
	};

	const handleCopyLink = () => {
		const url = `${window.location.origin}/meet/${params.meetingId}?workspaceId=${workspaceId}`;
		navigator.clipboard.writeText(url);
		setLinkCopied(true);
		toast.success("Meeting link copied!");
		setTimeout(() => setLinkCopied(false), 2000);
	};

	const goToWorkspace = () => {
		if (workspaceId && channelId) {
			router.push(`/workspace/${workspaceId}/channel/${channelId}/chats`);
		} else if (workspaceId) {
			router.push(`/workspace/${workspaceId}`);
		} else {
			router.push("/");
		}
	};

	// Hand raise
	const toggleHandRaise = () => {
		setHandRaised(!handRaised);
		if (!handRaised) {
			toast("✋ Hand raised", { duration: 2000 });
		}
	};

	// Leave modal
	if (showLeaveModal) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-[#0a0a12] text-white">
				<div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
					<h2 className="text-2xl font-normal text-[#202124]">You left the meeting</h2>
					{liveTranscript && (
						<p className="text-sm text-gray-500">Your transcript and notes have been saved.</p>
					)}
					<p className="text-sm text-gray-400">Duration: {elapsed}</p>
					<div className="flex justify-center gap-4 mt-6 pb-4">
						<Button
							variant="outline"
							onClick={() => {
								setShowLeaveModal(false);
								call?.join({ create: true });
							}}
							className="rounded-full text-[#6366f1] border-gray-300 hover:bg-indigo-50 px-6 font-medium"
						>
							Rejoin
						</Button>
						<Button
							onClick={goToWorkspace}
							className="rounded-full bg-[#6366f1] text-white hover:bg-[#5558e6] px-6 font-medium shadow-none"
						>
							Return to channel
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Loading
	if (isLoading || !user || !client || !call) {
		return (
			<div className="flex h-screen items-center justify-center bg-[#0a0a12] text-white">
				<div className="flex flex-col items-center gap-4">
					<div className="relative">
						<div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
						<Loader2 className="h-8 w-8 animate-spin text-indigo-400 relative" />
					</div>
					<p className="text-gray-400 font-medium">Joining meeting room...</p>
				</div>
			</div>
		);
	}

	const sidebarOpen = showNotes || showParticipants || showChat;

	return (
		<div className="relative flex h-screen w-full bg-[#0a0a12] overflow-hidden text-white font-sans flex-col">

			{/* Hand raised indicator */}
			{handRaised && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 animate-bounce shadow-lg shadow-amber-500/25">
					<Hand className="w-4 h-4" /> Your hand is raised
				</div>
			)}

			{/* Top bar — participants ring + meeting info */}
			<div className="absolute top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-6" style={{ background: "linear-gradient(to bottom, rgba(10,10,18,0.8), transparent)" }}>
				<div className="flex items-center gap-3">
					{/* Participant avatars ring */}
					<div className="flex -space-x-2">
						{[user].map((u, i) => (
							<div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#0a0a12] shadow-lg">
								{u?.name?.[0]?.toUpperCase() || "?"}
							</div>
						))}
					</div>
					<div className="text-sm text-gray-300 font-medium">
						<span className="text-white">{user?.name || "You"}</span>
						<span className="text-gray-500 mx-2">•</span>
						<span className="text-gray-500 text-xs">{params.meetingId.slice(0, 8)}</span>
					</div>
				</div>

				{/* Timer + View Toggle + Recording */}
				<div className="flex items-center gap-2">
					{/* View Mode Toggle */}
					<div className="flex items-center bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-0.5">
						<button
							onClick={() => setViewMode("speaker")}
							className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${viewMode === "speaker" ? "bg-indigo-500/30 text-indigo-300" : "text-gray-500 hover:text-gray-300"}`}
							title="Speaker view"
						>
							<Presentation className="w-3.5 h-3.5" />
						</button>
						<button
							onClick={() => setViewMode("grid")}
							className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${viewMode === "grid" ? "bg-indigo-500/30 text-indigo-300" : "text-gray-500 hover:text-gray-300"}`}
							title="Grid view"
						>
							<LayoutGrid className="w-3.5 h-3.5" />
						</button>
					</div>
					{isRecording && (
						<div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1 rounded-full text-xs font-semibold">
							<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
							REC
						</div>
					)}
					<div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs font-mono text-gray-300 tracking-wider">
						⏱ {elapsed}
					</div>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex-1 flex w-full p-3 gap-3 pt-16 pb-24">
				{/* Video Area */}
				<div className={`transition-all duration-500 ease-out flex flex-col h-full ${sidebarOpen ? "w-[70%]" : "w-full"}`}>
					<StreamVideo client={client}>
						<StreamCall call={call}>
							<StreamTheme className="h-full w-full flex-1 flex flex-col items-center justify-center rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #141428 50%, #0d1b2a 100%)" }}>
								{viewMode === "speaker" ? (
									<SpeakerLayout participantsBarPosition="bottom" />
								) : (
									<PaginatedGridLayout />
								)}
								{/* Captions overlay */}
								<CaptionsOverlay isRecording={isRecording} liveTranscript={liveTranscript} />
							</StreamTheme>
						</StreamCall>
					</StreamVideo>
				</div>

				{/* Right Sidebar */}
				{sidebarOpen && (
					<div className="w-[30%] bg-[#12121f] backdrop-blur-xl rounded-2xl overflow-hidden flex flex-col relative animate-in slide-in-from-right-4 duration-300 text-white shadow-2xl border border-white/5">
						{showParticipants && (
							<>
								<div className="flex items-center justify-between p-5 pb-2 border-b border-white/5">
									<h2 className="text-base font-semibold text-white flex items-center gap-2">
										<Users className="w-4 h-4 text-indigo-400" /> People
									</h2>
									<button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 flex items-center justify-center transition-colors">
										✕
									</button>
								</div>
								<div className="flex-1 overflow-y-auto pb-4">
									<StreamVideo client={client}>
										<StreamCall call={call}>
											<CustomParticipantList />
										</StreamCall>
									</StreamVideo>
								</div>
							</>
						)}
						{showNotes && (
							<NotesSidebar
								roomId={params.meetingId}
								workspaceId={workspaceId}
								liveTranscript={liveTranscript}
								isRecording={isRecording}
								onClose={() => setShowNotes(false)}
							/>
						)}
						{showChat && (
							<StreamVideo client={client}>
								<StreamCall call={call}>
									<MeetingChat onClose={() => setShowChat(false)} />
								</StreamCall>
							</StreamVideo>
						)}
					</div>
				)}
			</div>

			{/* Bottom Bar — Glassmorphic */}
			<div className="absolute bottom-0 left-0 right-0 z-50">
				{/* AI Summary Strip */}
				{isRecording && liveTranscript && (
					<div className="mx-auto max-w-2xl mb-2 px-4">
						<div className="bg-indigo-500/10 backdrop-blur-xl border border-indigo-500/20 rounded-2xl px-4 py-2 flex items-center gap-2 text-xs">
							<Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
							<span className="text-indigo-200 truncate">
								{liveTranscript.split("\n").slice(-1)[0] || "Listening..."}
							</span>
						</div>
					</div>
				)}

				<div className="h-[88px] flex items-center justify-between px-6" style={{ background: "rgba(10, 10, 18, 0.75)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
					{/* Left: Time | Meeting ID */}
					<div className="w-1/4 flex items-center text-gray-400 font-medium text-sm truncate">
						<TimeDisplay /> <span className="mx-3 text-gray-600">|</span>
						<span className="text-gray-500 text-xs">{params.meetingId.slice(0, 12)}</span>
					</div>

					{/* Center: Controls in pill */}
					<div className="flex-1 flex items-center justify-center">
						<StreamVideo client={client}>
							<StreamCall call={call}>
								<StreamTheme>
									<div className="flex items-center gap-1 bg-white/[0.07] backdrop-blur-xl rounded-full px-2 py-1.5 border border-white/[0.06] shadow-2xl">
										<SpeakingWhileMutedNotification />
										<ToggleAudioPublishingButton />
										<ToggleVideoPublishingButton />
										<ScreenShareButton />
										<div className="w-px h-6 bg-white/10 mx-1" />
										<MeetingReactions />
										{/* Hand Raise */}
										<button
											onClick={toggleHandRaise}
											className={`flex items-center justify-center w-11 h-11 rounded-full transition-all text-sm font-medium ${handRaised ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-transparent hover:bg-white/10 text-white"}`}
											title={handRaised ? "Lower hand" : "Raise hand"}
										>
											<Hand className="h-5 w-5" />
										</button>
										<div className="w-px h-6 bg-white/10 mx-1" />
										<MeetingRecordButton
											roomId={params.meetingId}
											workspaceId={workspaceId}
											userName={user?.name || "You"}
											onTranscriptUpdate={handleTranscriptUpdate}
											onRecordingChange={handleRecordingChange}
										/>
										<div className="w-px h-6 bg-white/10 mx-1" />
										<CancelCallButton onLeave={handleLeave} />
									</div>
								</StreamTheme>
							</StreamCall>
						</StreamVideo>
					</div>

					{/* Right: People, Chat, Notes, Copy Link */}
					<div className="w-1/4 flex items-center justify-end gap-1">
						<SidebarButton active={showParticipants} onClick={() => { setShowParticipants(!showParticipants); setShowNotes(false); setShowChat(false); }} title="People" icon={<Users className="h-5 w-5" />} />
						<SidebarButton active={showChat} onClick={() => { setShowChat(!showChat); setShowNotes(false); setShowParticipants(false); }} title="Chat" icon={<MessageSquare className="h-5 w-5" />} />
						<SidebarButton active={showNotes} onClick={() => { setShowNotes(!showNotes); setShowParticipants(false); setShowChat(false); }} title="AI Notes" icon={<Sparkles className="h-5 w-5" />} badge />
						<button
							className="rounded-full h-10 w-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
							onClick={handleCopyLink}
							title="Copy meeting link"
						>
							{linkCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
						</button>
					</div>
				</div>
			</div>

			{/* Global styles for meeting */}
			<style jsx global>{`
				.str-video__speaker-layout__wrapper {
					background: transparent !important;
				}
				.str-video__participant-view {
					border-radius: 16px !important;
					overflow: hidden !important;
					border: 2px solid rgba(255,255,255,0.05) !important;
					transition: border-color 0.3s ease, box-shadow 0.3s ease !important;
				}
				.str-video__participant-view--speaking {
					border-color: rgba(99, 102, 241, 0.5) !important;
					box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3), 0 0 30px rgba(99, 102, 241, 0.1) !important;
				}
				.str-video__call-controls__button {
					border-radius: 9999px !important;
					width: 44px !important;
					height: 44px !important;
					background: transparent !important;
					transition: all 0.2s ease !important;
				}
				.str-video__call-controls__button:hover {
					background: rgba(255,255,255,0.1) !important;
				}
				.str-video__call-controls__button--active {
					background: rgba(255,255,255,0.15) !important;
				}
				.str-video__call-controls__button--variant-cancel {
					background: #ef4444 !important;
				}
				.str-video__call-controls__button--variant-cancel:hover {
					background: #dc2626 !important;
				}
				.str-video__participant-view__name-container {
					background: rgba(10,10,18,0.7) !important;
					backdrop-filter: blur(8px) !important;
					border-radius: 8px !important;
					padding: 4px 10px !important;
				}
			`}</style>
		</div>
	);
}

// ─── SIDEBAR BUTTON ─────────────────────────────────────────────────────────

const SidebarButton = ({ active, onClick, title, icon, badge }: { active: boolean, onClick: () => void, title: string, icon: React.ReactNode, badge?: boolean }) => (
	<button
		onClick={onClick}
		className={`relative rounded-full h-10 w-10 flex items-center justify-center transition-all ${active ? "bg-indigo-500/20 text-indigo-400" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
		title={title}
	>
		{icon}
		{badge && (
			<span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-[#0a0a12]" />
		)}
	</button>
);

// ─── TIME DISPLAY ───────────────────────────────────────────────────────────

const TimeDisplay = () => {
	const [time, setTime] = useState("");
	useEffect(() => {
		const update = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
		update();
		const interval = setInterval(update, 30000);
		return () => clearInterval(interval);
	}, []);
	return <span className="text-gray-300">{time}</span>;
};
