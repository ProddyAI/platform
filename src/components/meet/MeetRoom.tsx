"use client";

import {
	type Call,
	ParticipantsAudio,
	ParticipantView,
	ScreenShareButton,
	SfuModels,
	StreamCall,
	StreamVideo,
	type StreamVideoClient,
	type StreamVideoParticipant,
	useCall,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import {
	Hand,
	Mic,
	MicOff,
	PhoneOff,
	Users,
	Video,
	VideoOff,
} from "lucide-react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ParticipantSidebar } from "@/components/meet/ParticipantSidebar";
import { activeMeetingAtom } from "@/lib/meet-call-store";
import { createStreamClient } from "@/lib/stream";
import { cn } from "@/lib/utils";

type MeetRoomProps = {
	channelId: string;
	workspaceId: string;
	initialCameraMuted?: boolean;
	initialMicMuted?: boolean;
};

type TokenResponse = {
	token?: string;
	userId?: string;
	name?: string;
	image?: string;
	error?: string;
};

type MeetingState = {
	client: StreamVideoClient | null;
	call: Call | null;
	status: "loading" | "connected" | "error" | "left";
	error: string | null;
};

type ReactionBubble = {
	emoji: string;
	id: string;
};

type ChatMessage = {
	id: string;
	text: string;
	user: string;
};

async function leaveMeeting(
	call: Call | null,
	client: StreamVideoClient | null
) {
	try {
		await call?.leave();
	} catch {}

	try {
		await client?.disconnectUser();
	} catch {}
}

export function MeetRoom({
	channelId,
	workspaceId,
	initialCameraMuted = false,
	initialMicMuted = false,
}: MeetRoomProps) {
	const router = useRouter();
	const [activeMeeting, setActiveMeeting] = useAtom(activeMeetingAtom);
	const [meeting, setMeeting] = useState<MeetingState>({
		client: null,
		call: null,
		status: "loading",
		error: null,
	});
	const [showSidebar, setShowSidebar] = useState(false);
	const [tab, setTab] = useState<"chat" | "people">("chat");
	const [raisedHands, setRaisedHands] = useState<string[]>([]);
	const [reactions, setReactions] = useState<ReactionBubble[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");

	const addReaction = (emoji: string, userId = "local") => {
		const id = `${userId}-${Date.now()}-${Math.random()}`;
		setReactions((current) => [...current, { emoji, id }]);
		window.setTimeout(() => {
			setReactions((current) =>
				current.filter((reaction) => reaction.id !== id)
			);
		}, 1800);
	};

	const appendMessage = (message: ChatMessage) => {
		setMessages((current) => {
			if (current.some((entry) => entry.id === message.id)) {
				return current;
			}

			return [...current, message];
		});
	};

	const sendMessage = () => {
		const call = meeting.call;
		const text = input.trim();
		if (!call || !text) return;

		const message = {
			id: `${call.currentUserId ?? "local"}-${Date.now()}`,
			text,
			type: "chat" as const,
			user: call.currentUserId ?? "You",
		};

		appendMessage(message);
		void call.sendCustomEvent(message);
		setInput("");
	};

	const sendReaction = (emoji: string) => {
		const call = meeting.call;
		if (!call) return Promise.resolve();

		addReaction(emoji, call.currentUserId ?? "local");
		return call.sendCustomEvent({
			type: "reaction",
			emoji,
		});
	};

	useEffect(() => {
		let isMounted = true;
		let streamClient: StreamVideoClient | null = null;
		let streamCall: Call | null = null;
		let shouldDisconnectOnCleanup = true;

		const connect = async () => {
			try {
				if (
					activeMeeting?.channelId === channelId &&
					activeMeeting.workspaceId === workspaceId
				) {
					shouldDisconnectOnCleanup = false;
					setMeeting({
						client: activeMeeting.client,
						call: activeMeeting.call,
						status: "connected",
						error: null,
					});
					return;
				}

				if (activeMeeting) {
					await leaveMeeting(activeMeeting.call, activeMeeting.client);
					setActiveMeeting(null);
				}

				const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
				if (!apiKey) {
					throw new Error("Stream public API key is missing");
				}

				const response = await fetch("/api/stream/token", {
					method: "GET",
					cache: "no-store",
				});

				let data: TokenResponse = {};
				try {
					data = (await response.json()) as TokenResponse;
				} catch {
					data = {};
				}

				if (!response.ok) {
					throw new Error(data.error || "Unable to get meeting token");
				}

				streamClient = createStreamClient({
					apiKey,
					userId: data.userId,
					token: data.token,
					name: data.name,
					image: data.image,
				});

				streamCall = streamClient.call("default", channelId);
				await streamCall.join({
					create: true,
					video: !initialCameraMuted,
				});
				await Promise.allSettled([
					initialCameraMuted
						? streamCall.camera.disable(true)
						: streamCall.camera.enable(),
					initialMicMuted
						? streamCall.microphone.disable(true)
						: streamCall.microphone.enable(),
				]);

				if (!isMounted) {
					await leaveMeeting(streamCall, streamClient);
					return;
				}

				setMeeting({
					client: streamClient,
					call: streamCall,
					status: "connected",
					error: null,
				});
				setActiveMeeting({
					call: streamCall,
					channelId,
					client: streamClient,
					workspaceId,
				});
				shouldDisconnectOnCleanup = false;
			} catch (error) {
				if (!isMounted) return;

				setMeeting({
					client: null,
					call: null,
					status: "error",
					error:
						error instanceof Error
							? error.message
							: "Failed to connect to meeting",
				});
			}
		};

		void connect();

		return () => {
			isMounted = false;
			setMeeting((current) => ({
				...current,
				client: null,
				call: null,
			}));
			if (shouldDisconnectOnCleanup) {
				void leaveMeeting(streamCall, streamClient);
			}
		};
	}, [
		activeMeeting,
		channelId,
		initialCameraMuted,
		initialMicMuted,
		setActiveMeeting,
		workspaceId,
	]);

	useEffect(() => {
		const call = meeting.call;
		if (!call) return;

		setRaisedHands([]);
		setReactions([]);
		setMessages([]);

		const unsubscribe = call.on("custom", (event) => {
			const custom = event.custom ?? {};

			if (custom.type === "reaction" && typeof custom.emoji === "string") {
				if (event.user.id !== call.currentUserId) {
					addReaction(custom.emoji, event.user.id);
				}
			}

			if (custom.type === "raise_hand" && typeof custom.userId === "string") {
				setRaisedHands((current) => {
					if (custom.raised === false) {
						return current.filter((userId) => userId !== custom.userId);
					}

					return current.includes(custom.userId)
						? current
						: [...current, custom.userId];
				});
			}

			if (custom.type === "chat" && typeof custom.text === "string") {
				appendMessage({
					id:
						typeof custom.id === "string"
							? custom.id
							: `${event.user.id}-${event.created_at ?? Date.now()}`,
					text: custom.text,
					user:
						typeof custom.user === "string"
							? custom.user
							: event.user.id || "User",
				});
			}
		});

		return () => {
			unsubscribe();
		};
	}, [meeting.call]);

	if (meeting.status === "loading") {
		return (
			<section className="mx-auto flex aspect-video w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border bg-muted">
				<p className="text-muted-foreground text-sm">
					Connecting to meeting...
				</p>
			</section>
		);
	}

	if (meeting.status === "error") {
		return (
			<section className="mx-auto flex aspect-video w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border bg-muted px-6 text-center">
				<div>
					<p className="font-medium text-sm">Failed to connect to meeting</p>
					<p className="mt-2 text-muted-foreground text-sm">
						{meeting.error || "Please try again later."}
					</p>
				</div>
			</section>
		);
	}

	if (meeting.status === "left" || !meeting.client || !meeting.call) {
		return (
			<section className="mx-auto flex aspect-video w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border bg-muted px-6 text-center">
				<p className="text-muted-foreground text-sm">You left the meeting.</p>
			</section>
		);
	}

	return (
		<StreamVideo client={meeting.client}>
			<StreamCall call={meeting.call}>
				<section className="mx-auto flex h-full min-h-[75vh] w-full flex-col overflow-hidden rounded-xl border bg-background">
					<div className="flex items-center justify-between border-b px-4 py-2">
						<span className="text-sm font-medium">Meeting</span>
						<button
							className="text-muted-foreground text-sm transition hover:text-foreground"
							onClick={async () => {
								const call = meeting.call;
								const client = meeting.client;
								setMeeting({
									client: null,
									call: null,
									status: "left",
									error: null,
								});
								setActiveMeeting(null);
								await leaveMeeting(call, client);
								router.push(
									`/workspace/${workspaceId}/channel/${channelId}/chats`
								);
							}}
							type="button"
						>
							Leave
						</button>
					</div>
					<div className="relative flex h-full min-h-0 w-full flex-1">
						<div className="flex flex-1 items-center justify-center p-4 pb-28">
							<div className="h-[75vh] w-full max-w-6xl">
								<MeetVideoGrid
									raisedHands={raisedHands}
									reactions={reactions}
								/>
							</div>
						</div>
						{showSidebar && (
							<div className="w-80 border-l bg-background">
								<MeetSidebar
									input={input}
									messages={messages}
									onInputChange={setInput}
									onSend={sendMessage}
									onTabChange={setTab}
									raisedHands={raisedHands}
									tab={tab}
								/>
							</div>
						)}
						<MeetControls
							onLeave={async () => {
								const call = meeting.call;
								const client = meeting.client;
								setMeeting({
									client: null,
									call: null,
									status: "left",
									error: null,
								});
								setActiveMeeting(null);
								await leaveMeeting(call, client);
								router.push(
									`/workspace/${workspaceId}/channel/${channelId}/chats`
								);
							}}
							onRaiseHand={(raised) => {
								const userId = meeting.call?.currentUserId;
								if (!meeting.call || !userId) return Promise.resolve();

								setRaisedHands((current) =>
									raised
										? current.filter((id) => id !== userId)
										: [...current, userId]
								);

								return meeting.call.sendCustomEvent({
									raised: !raised,
									type: "raise_hand",
									userId,
								});
							}}
							onReaction={sendReaction}
							onShowChat={() => {
								setShowSidebar(tab === "chat" ? !showSidebar : true);
								setTab("chat");
							}}
							onShowPeople={() => {
								setShowSidebar(tab === "people" ? !showSidebar : true);
								setTab("people");
							}}
							raisedHand={raisedHands.includes(meeting.call.currentUserId ?? "")}
							showChat={showSidebar && tab === "chat"}
							showPeople={showSidebar && tab === "people"}
						/>
					</div>
				</section>
			</StreamCall>
		</StreamVideo>
	);
}

function MeetSidebar({
	input,
	messages,
	onInputChange,
	onSend,
	onTabChange,
	raisedHands,
	tab,
}: {
	input: string;
	messages: ChatMessage[];
	onInputChange: (value: string) => void;
	onSend: () => void;
	onTabChange: (tab: "chat" | "people") => void;
	raisedHands: string[];
	tab: "chat" | "people";
}) {
	const { useParticipants } = useCallStateHooks();
	const participants = useParticipants();

	return (
		<ParticipantSidebar
			input={input}
			messages={messages}
			onInputChange={onInputChange}
			onSend={onSend}
			onTabChange={onTabChange}
			participants={participants}
			raisedHands={raisedHands}
			tab={tab}
		/>
	);
}

function MeetVideoGrid({
	raisedHands,
	reactions,
}: {
	raisedHands: string[];
	reactions: ReactionBubble[];
}) {
	const { useParticipants, useRemoteParticipants } = useCallStateHooks();
	const participants = useParticipants();
	const remoteParticipants = useRemoteParticipants();
	const screenSharer = participants.find(
		(participant) => participant.screenShareStream
	);
	const gridCols =
		participants.length <= 1
			? "grid-cols-1"
			: participants.length <= 4
				? "grid-cols-2"
				: "grid-cols-3";

	return (
		<>
			<ParticipantsAudio participants={remoteParticipants} />
			{screenSharer ? (
				<div className="flex h-full w-full flex-col items-center justify-center">
					<div className="flex h-full w-full flex-col gap-4">
						<div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted shadow-sm">
							<ParticipantView
								className="h-full w-full object-cover [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
								muteAudio
								ParticipantViewUI={null}
								participant={screenSharer}
								trackType="screenShareTrack"
								VideoPlaceholder={() => (
									<AvatarPlaceholder participant={screenSharer} />
								)}
							/>
							<div className="absolute inset-0 pointer-events-none flex items-center justify-center">
								{reactions.map((reaction) => (
									<span
										className="absolute text-3xl animate-float"
										key={reaction.id}
									>
										{reaction.emoji}
									</span>
								))}
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
							{participants
								.filter(
									(participant) =>
										participant.sessionId !== screenSharer.sessionId
								)
								.map((participant) => (
									<div
										className="h-28 min-w-0"
										key={participant.sessionId}
									>
										<ParticipantTile
											compact
											hasRaisedHand={raisedHands.includes(participant.userId)}
											participant={participant}
										/>
									</div>
								))}
						</div>
					</div>
				</div>
			) : (
				<>
					<div
						className={cn(
							`grid ${gridCols} h-full w-full gap-4`,
							participants.length > 9 && "overflow-y-auto"
						)}
					>
						{participants.map((participant) => (
							<ParticipantTile
								hasRaisedHand={raisedHands.includes(participant.userId)}
								key={participant.sessionId}
								participant={participant}
							/>
						))}
					</div>
					<div className="absolute inset-0 pointer-events-none flex items-center justify-center">
						{reactions.map((reaction) => (
							<span
								className="absolute text-3xl animate-float"
								key={reaction.id}
							>
								{reaction.emoji}
							</span>
						))}
					</div>
				</>
			)}
			<style jsx global>{`
				@keyframes float {
					0% {
						transform: translateY(0);
						opacity: 1;
					}
					100% {
						transform: translateY(-80px);
						opacity: 0;
					}
				}

				.animate-float {
					animation: float 1.5s ease-out forwards;
				}
			`}</style>
		</>
	);
}

function ParticipantTile({
	compact = false,
	hasRaisedHand = false,
	participant,
}: {
	compact?: boolean;
	hasRaisedHand?: boolean;
	participant: StreamVideoParticipant;
}) {
	const isMicMuted =
		!participant.audioStream &&
		!participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
	const isSpeaking =
		participant.isSpeaking || (participant.audioLevel ?? 0) > 0.1;
	const displayName = participant.name || participant.userId || "Guest";

	return (
		<div
			className={cn(
				"relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm transition",
				compact ? "min-h-24" : "min-h-[220px]",
				isSpeaking ? "ring-2 ring-primary scale-[1.02]" : "ring-1 ring-border/50"
			)}
		>
			<ParticipantView
				className="h-full w-full object-cover [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
				muteAudio
				ParticipantViewUI={null}
				participant={participant}
				VideoPlaceholder={() => <AvatarPlaceholder participant={participant} />}
			/>
			<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/80 p-2 backdrop-blur">
				<span className="truncate text-sm text-foreground">
					{displayName}
					{participant.isLocalParticipant ? " (You)" : ""}
				</span>
			</div>
			{isMicMuted && (
				<div className="absolute bottom-2 right-2 rounded-full bg-background/80 p-1.5 text-foreground backdrop-blur">
					<span className="sr-only">Microphone muted</span>
					<MicOff className="h-3.5 w-3.5" />
				</div>
			)}
			{hasRaisedHand && (
				<div className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-1 text-sm shadow-sm backdrop-blur">
					{"\u270B"}
				</div>
			)}
		</div>
	);
}

function AvatarPlaceholder({
	participant,
}: {
	participant: StreamVideoParticipant;
}) {
	const displayName = participant.name || participant.userId || "Guest";
	const initials = getInitials(displayName);

	return (
		<div className="flex h-full w-full items-center justify-center bg-background">
			<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 font-semibold text-2xl text-foreground sm:h-24 sm:w-24">
				{initials}
			</div>
		</div>
	);
}

function MeetControls({
	onLeave,
	onRaiseHand,
	onReaction,
	onShowChat,
	onShowPeople,
	raisedHand,
	showChat,
	showPeople,
}: {
	onLeave: () => void;
	onRaiseHand: (raised: boolean) => Promise<unknown>;
	onReaction: (emoji: string) => Promise<unknown>;
	onShowChat: () => void;
	onShowPeople: () => void;
	raisedHand: boolean;
	showChat: boolean;
	showPeople: boolean;
}) {
	const call = useCall();
	const { useCameraState, useMicrophoneState } = useCallStateHooks();
	const { microphone, isMute: isMicMuted } = useMicrophoneState();
	const { camera, isMute: isCameraMuted } = useCameraState();
	const [isBusy, setIsBusy] = useState(false);
	const [open, setOpen] = useState(false);

	const runControl = async (action: () => Promise<void>) => {
		try {
			setIsBusy(true);
			await action();
		} catch {
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<>
			<div className="absolute bottom-6 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur">
				<button
					aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
					className={cn(
						"flex h-10 w-10 items-center justify-center rounded-full bg-muted transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
						!isMicMuted
							? "bg-primary text-white hover:bg-primary/90"
							: "text-muted-foreground"
					)}
					disabled={isBusy || !call}
					onClick={() => runControl(() => microphone.toggle())}
					title={isMicMuted ? "Unmute" : "Mute"}
					type="button"
				>
					{isMicMuted ? (
						<MicOff className="h-5 w-5" />
					) : (
						<Mic className="h-5 w-5" />
					)}
				</button>
				<button
					aria-label={isCameraMuted ? "Turn camera on" : "Turn camera off"}
					className={cn(
						"flex h-10 w-10 items-center justify-center rounded-full bg-muted transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
						!isCameraMuted
							? "bg-primary text-white hover:bg-primary/90"
							: "text-muted-foreground"
					)}
					disabled={isBusy || !call}
					onClick={() => runControl(() => camera.toggle())}
					title={isCameraMuted ? "Camera on" : "Camera off"}
					type="button"
				>
					{isCameraMuted ? (
						<VideoOff className="h-5 w-5" />
					) : (
						<Video className="h-5 w-5" />
					)}
				</button>
				<div className="[&_button]:flex [&_button]:h-10 [&_button]:w-10 [&_button]:items-center [&_button]:justify-center [&_button]:rounded-full [&_button]:bg-muted [&_button]:text-muted-foreground [&_button]:transition [&_button]:hover:bg-accent">
					<ScreenShareButton />
				</div>
				<div className="relative">
					<button
						aria-label="Open reactions"
						className={cn(
							"flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent",
							open && "bg-primary text-white hover:bg-primary/90"
						)}
						onClick={() => setOpen((current) => !current)}
						type="button"
					>
						{"\u{1F60A}"}
					</button>
					{open && (
						<div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 gap-2 rounded-full border bg-background px-3 py-2 shadow-sm">
							{[
								"\u{1F44D}",
								"\u2764\uFE0F",
								"\u{1F602}",
								"\u{1F62E}",
								"\u{1F389}",
							].map((emoji) => (
								<span
									className="cursor-pointer text-lg transition hover:scale-125"
									key={emoji}
									onClick={() => {
										setOpen(false);
										void runControl(() =>
											onReaction(emoji).then(() => undefined)
										);
									}}
								>
									{emoji}
								</span>
							))}
						</div>
					)}
				</div>
				<button
					aria-label={raisedHand ? "Lower hand" : "Raise hand"}
					className={cn(
						"flex h-10 w-10 items-center justify-center rounded-full bg-muted transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
						raisedHand
							? "bg-primary text-white hover:bg-primary/90"
							: "text-muted-foreground"
					)}
					disabled={isBusy || !call}
					onClick={() =>
						runControl(() => onRaiseHand(raisedHand).then(() => undefined))
					}
					title={raisedHand ? "Lower hand" : "Raise hand"}
					type="button"
				>
					<Hand className="h-4 w-4" />
				</button>
				<button
					aria-label={showChat ? "Hide chat" : "Show chat"}
					className={cn(
						"flex h-10 items-center justify-center rounded-full bg-muted px-4 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
						showChat
							? "bg-primary text-white hover:bg-primary/90"
							: "text-muted-foreground"
					)}
					disabled={isBusy || !call}
					onClick={onShowChat}
					title="Chat"
					type="button"
				>
					<div className="font-medium text-sm">Chat</div>
				</button>
				<button
					aria-label={showPeople ? "Hide participants" : "Show participants"}
					className={cn(
						"flex h-10 w-10 items-center justify-center rounded-full bg-muted transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
						showPeople
							? "bg-primary text-white hover:bg-primary/90"
							: "text-muted-foreground"
					)}
					disabled={isBusy || !call}
					onClick={onShowPeople}
					title="Participants"
					type="button"
				>
					<Users className="h-5 w-5" />
				</button>
				<button
					aria-label="Leave meeting"
					className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isBusy}
					onClick={onLeave}
					title="Leave"
					type="button"
				>
					<PhoneOff className="h-5 w-5" />
				</button>
			</div>
		</>
	);
}

function getInitials(name: string) {
	const initials = name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");

	return initials || "U";
}
