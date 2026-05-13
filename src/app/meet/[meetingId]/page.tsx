"use client";

import {
	CancelCallButton,
	PaginatedGridLayout,
	ScreenShareButton,
	SpeakerLayout,
	SpeakingWhileMutedNotification,
	StreamCall,
	StreamTheme,
	StreamVideo,
	StreamVideoClient,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useConvexAuth, useQuery } from "convex/react";
import {
	Check,
	Copy,
	Hand,
	LayoutGrid,
	Loader2,
	MessageSquare,
	Mic,
	MicOff,
	MonitorUp,
	PhoneOff,
	Presentation,
	Sparkles,
	Users,
	Video,
	VideoOff,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { LiveblocksRoom } from "@/features/live/components/liveblocks-room";
import {
	CaptionsOverlay,
	CustomParticipantList,
	MeetingChat,
	MeetingReactions,
	MeetingRecordButton,
	NotesSidebar,
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

	const [showNotes, setShowNotes] = useState(false);
	const [showParticipants, setShowParticipants] = useState(false);
	const [showChat, setShowChat] = useState(false);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	const [handRaised, setHandRaised] = useState(false);
	const [viewMode, setViewMode] = useState<"speaker" | "grid">("speaker");

	const [isRecording, setIsRecording] = useState(false);
	const [liveTranscript, setLiveTranscript] = useState("");
	const liveTranscriptRef = useRef("");

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
		liveTranscriptRef.current = transcript;
	}, []);

	const handleExternalTranscript = useCallback((chunk: string) => {
		liveTranscriptRef.current +=
			(liveTranscriptRef.current ? "\n" : "") + chunk;
		setLiveTranscript(liveTranscriptRef.current);
	}, []);

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

	useEffect(() => {
		const interval = setInterval(() => {
			const diff = Date.now() - joinTime;
			const hrs = String(Math.floor(diff / 3600000)).padStart(2, "0");
			const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(
				2,
				"0"
			);
			const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
			setElapsed(`${hrs}:${mins}:${secs}`);
		}, 1000);
		return () => clearInterval(interval);
	}, [joinTime]);

	useEffect(() => {
		if (workspaceId && typeof window !== "undefined") {
			const returnUrl = channelId
				? `/workspace/${workspaceId}/channel/${channelId}/chats`
				: `/workspace/${workspaceId}`;
			sessionStorage.setItem(`meet-return-${params.meetingId}`, returnUrl);
		}
	}, [workspaceId, channelId, params.meetingId]);

	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated) {
			router.replace("/auto-login");
			return;
		}
		if (!user?._id) return;

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
			if (callRef.current) {
				callRef.current.leave().catch(() => {});
			}
			if (clientRef.current) {
				clientRef.current.disconnectUser().catch(() => {});
			}
		};
	}, [isAuthenticated, isLoading, user?._id, params.meetingId, router]);

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

		// Attempt to close if it's a popup/new tab
		if (window.opener || window.history.length === 1) {
			window.close();
		}

		// If still open, redirect
		if (returnUrl) {
			router.replace(returnUrl);
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

	const toggleHandRaise = () => {
		setHandRaised(!handRaised);
		if (!handRaised) {
			toast("✋ Hand raised", { duration: 2000 });
		}
	};

	if (showLeaveModal) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-[#050505] text-white">
				<div className="bg-[#12121a] border border-white/10 rounded-[32px] p-10 max-w-md w-full text-center space-y-8 shadow-2xl animate-in fade-in zoom-in duration-500">
					<div className="mx-auto w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20">
						<PhoneOff className="w-8 h-8 text-indigo-400" />
					</div>
					<div className="space-y-2">
						<h2 className="text-3xl font-bold tracking-tight">Meeting Ended</h2>
						{liveTranscript && (
							<p className="text-gray-400 text-sm">
								Your transcript and AI intelligence have been safely saved to
								your workspace.
							</p>
						)}
						<p className="text-xs font-mono text-indigo-500/60 uppercase tracking-widest pt-2">
							Duration: {elapsed}
						</p>
					</div>

					<div className="flex flex-col gap-3 pt-4">
						<Button
							className="rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white h-12 font-bold shadow-lg shadow-indigo-500/20"
							onClick={goToWorkspace}
						>
							Return to Workspace
						</Button>
						<Button
							className="rounded-2xl border-white/5 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 h-12 font-semibold"
							onClick={() => {
								setShowLeaveModal(false);
								call?.join({ create: true });
							}}
							variant="outline"
						>
							Rejoin Meeting
						</Button>
					</div>
				</div>
			</div>
		);
	}

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
		<LiveblocksRoom roomId={`meeting-${params.meetingId}`} roomType="note">
			<div className="relative flex h-screen w-full bg-[#0a0a12] overflow-hidden text-white font-sans flex-col">
				{handRaised && (
					<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 animate-bounce shadow-lg shadow-amber-500/25">
						<Hand className="w-4 h-4" /> Your hand is raised
					</div>
				)}

				<div
					className="absolute top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-6"
					style={{
						background:
							"linear-gradient(to bottom, rgba(10,10,18,0.8), transparent)",
					}}
				>
					<div className="flex items-center gap-3">
						<div className="flex -space-x-2">
							{[user].map((u, i) => (
								<div
									className="w-8 h-8 rounded-full border-2 border-[#0a0a12] bg-indigo-500 flex items-center justify-center text-[10px] font-bold shadow-lg"
									key={i}
								>
									{u.name?.[0]?.toUpperCase() || "A"}
								</div>
							))}
						</div>
						<div className="h-4 w-px bg-white/20 mx-1" />
						<div className="flex flex-col">
							<span className="text-[13px] font-semibold tracking-tight">
								{params.meetingId.slice(0, 8)}...
							</span>
							<span className="text-[10px] text-indigo-400 font-medium tracking-wider uppercase">
								{elapsed}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
						<div className="flex items-center gap-1.5 px-2">
							<div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
							<span className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">
								Live
							</span>
						</div>
						<div className="h-3 w-px bg-white/10" />
						<Button
							className="h-7 text-[10px] gap-1.5 bg-white/10 hover:bg-white/20 text-white border-none rounded-full px-3"
							onClick={handleCopyLink}
							size="sm"
							variant="outline"
						>
							{linkCopied ? (
								<Check className="w-3 h-3" />
							) : (
								<Copy className="w-3 h-3" />
							)}
							Copy Link
						</Button>
					</div>
				</div>

				<div className="flex-1 flex min-h-0 pt-14">
					<div className="flex-1 relative bg-[#050505]">
						<StreamVideo client={client}>
							<StreamCall call={call}>
								<StreamTheme>
									<div className="h-full w-full p-4 flex flex-col">
										<div className="flex-1 min-h-0 relative rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
											{viewMode === "speaker" ? (
												<SpeakerLayout />
											) : (
												<PaginatedGridLayout />
											)}
											<CaptionsOverlay
												isRecording={isRecording}
												liveTranscript={liveTranscript}
												onExternalTranscript={handleExternalTranscript}
											/>
											<MeetingReactions />
											<SpeakingWhileMutedNotification />
										</div>
									</div>
								</StreamTheme>
							</StreamCall>
						</StreamVideo>
					</div>

					{sidebarOpen && (
						<div className="w-[380px] bg-[#0a0a12] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
							{showNotes && (
								<NotesSidebar
									isRecording={isRecording}
									liveTranscript={liveTranscript}
									onClose={() => setShowNotes(false)}
									roomId={params.meetingId}
									workspaceId={workspaceId}
								/>
							)}
							{showParticipants && (
								<>
									<div className="p-5 border-b border-white/10 flex items-center justify-between">
										<h2 className="text-base font-semibold">Participants</h2>
										<Button
											onClick={() => setShowParticipants(false)}
											size="icon"
											variant="ghost"
										>
											<X className="w-4 h-4" />
										</Button>
									</div>
									<CustomParticipantList />
								</>
							)}
							{showChat && (
								<>
									<div className="p-5 border-b border-white/10 flex items-center justify-between">
										<h2 className="text-base font-semibold">Chat</h2>
										<Button
											onClick={() => setShowChat(false)}
											size="icon"
											variant="ghost"
										>
											<X className="w-4 h-4" />
										</Button>
									</div>
									<MeetingChat onClose={() => setShowChat(false)} />
								</>
							)}
						</div>
					)}
				</div>

				<div className="h-20 bg-[#0a0a12] border-t border-white/10 flex items-center justify-between px-8 z-40">
					<div className="flex items-center gap-4 w-1/3">
						<div className="bg-white/5 rounded-2xl px-4 py-2 border border-white/5 flex items-center gap-3">
							<Presentation className="w-4 h-4 text-indigo-400" />
							<div className="flex flex-col">
								<span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
									Project Space
								</span>
								<span className="text-xs font-semibold text-white">
									{params.meetingId.slice(0, 12)}
								</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<StreamVideo client={client}>
							<StreamCall call={call}>
								<BottomBarControls
									handleLeave={handleLeave}
									handleRecordingChange={handleRecordingChange}
									handleTranscriptUpdate={handleTranscriptUpdate}
									handRaised={handRaised}
									isRecording={isRecording}
									params={params}
									toggleHandRaise={toggleHandRaise}
									user={user}
									workspaceId={workspaceId}
								/>
							</StreamCall>
						</StreamVideo>
					</div>

					<div className="flex items-center justify-end gap-2 w-1/3">
						<Button
							className={`w-11 h-11 rounded-2xl border-none transition-all ${showChat ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-white/5 hover:bg-white/10 text-gray-400"}`}
							onClick={() => {
								setShowChat(!showChat);
								setShowNotes(false);
								setShowParticipants(false);
							}}
							size="icon"
							variant="outline"
						>
							<MessageSquare className="w-5 h-5" />
						</Button>
						<Button
							className={`w-11 h-11 rounded-2xl border-none transition-all ${showParticipants ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-white/5 hover:bg-white/10 text-gray-400"}`}
							onClick={() => {
								setShowParticipants(!showParticipants);
								setShowNotes(false);
								setShowChat(false);
							}}
							size="icon"
							variant="outline"
						>
							<Users className="w-5 h-5" />
						</Button>
						<div className="w-px h-6 bg-white/10 mx-1" />
						<Button
							className={`px-5 h-11 rounded-2xl border-none transition-all gap-2 font-semibold ${showNotes ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400"}`}
							onClick={() => {
								setShowNotes(!showNotes);
								setShowChat(false);
								setShowParticipants(false);
							}}
							variant="outline"
						>
							<Sparkles className="w-4 h-4" />
							AI Notes
						</Button>
					</div>
				</div>
			</div>
		</LiveblocksRoom>
	);
}

function BottomBarControls({
	handRaised,
	toggleHandRaise,
	isRecording,
	handleRecordingChange,
	handleTranscriptUpdate,
	params,
	user,
	workspaceId,
	handleLeave,
}: any) {
	const { useMicrophoneState, useCameraState, useScreenShareState } =
		useCallStateHooks();
	const { isMute: micMuted, microphone } = useMicrophoneState();
	const { isMute: camMuted, camera } = useCameraState();
	const { isEnabled: isScreenSharing, screenShare } = useScreenShareState();

	return (
		<div className="flex items-center gap-3 bg-white/5 p-1.5 rounded-full border border-white/10 shadow-inner">
			<Button
				className={`w-11 h-11 rounded-full border-none transition-all ${micMuted ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20" : "bg-[#3c4043] hover:bg-[#4d5154]"} text-white`}
				onClick={() => microphone.toggle()}
				size="icon"
				variant="outline"
			>
				{micMuted ? (
					<MicOff className="w-5 h-5" />
				) : (
					<Mic className="w-5 h-5" />
				)}
			</Button>

			<Button
				className={`w-11 h-11 rounded-full border-none transition-all ${camMuted ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20" : "bg-[#3c4043] hover:bg-[#4d5154]"} text-white`}
				onClick={() => camera.toggle()}
				size="icon"
				variant="outline"
			>
				{camMuted ? (
					<VideoOff className="w-5 h-5" />
				) : (
					<Video className="w-5 h-5" />
				)}
			</Button>

			<Button
				className={`w-11 h-11 rounded-full border-none transition-all ${isScreenSharing ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20" : "bg-[#3c4043] hover:bg-[#4d5154]"} text-white`}
				onClick={() => screenShare.toggle()}
				size="icon"
				variant="outline"
			>
				<MonitorUp className="w-5 h-5" />
			</Button>

			<Button
				className={`w-11 h-11 rounded-full border-none transition-all ${handRaised ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-[#3c4043] hover:bg-[#4d5154] text-white"}`}
				onClick={toggleHandRaise}
				size="icon"
				variant="outline"
			>
				<Hand className="w-5 h-5" />
			</Button>

			<MeetingRecordButton
				onRecordingChange={handleRecordingChange}
				onTranscriptUpdate={handleTranscriptUpdate}
				roomId={params.meetingId}
				userName={user.name || "Anonymous"}
				workspaceId={workspaceId}
			/>

			<Button
				className="bg-red-500 hover:bg-red-600 text-white w-14 h-11 rounded-full shadow-lg shadow-red-500/20 border-none flex items-center justify-center"
				onClick={handleLeave}
				size="icon"
			>
				<PhoneOff className="w-5 h-5" />
			</Button>

			<style global jsx>{`
				/* Speaker Aura Highlight */
				.str-video__participant-tile--speaking {
					box-shadow: 0 0 0 4px #6366f1 !important;
					border-radius: 24px !important;
					position: relative;
				}
				.str-video__participant-tile--speaking::after {
					content: "";
					position: absolute;
					inset: -10px;
					border-radius: 32px;
					background: radial-gradient(
						circle at center,
						rgba(99, 102, 241, 0.3) 0%,
						transparent 70%
					);
					z-index: -1;
					animation: speakerPulse 2s infinite ease-in-out;
				}
				@keyframes speakerPulse {
					0%,
					100% {
						opacity: 0.4;
						transform: scale(1);
					}
					50% {
						opacity: 0.8;
						transform: scale(1.05);
					}
				}
				/* Video Tile Customization */
				.str-video__participant-tile {
					border-radius: 24px !important;
					overflow: hidden !important;
					background: #12121a !important;
					border: 1px solid rgba(255, 255, 255, 0.05) !important;
				}
			`}</style>
		</div>
	);
}
