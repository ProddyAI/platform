"use client";

import {
	type Call,
	ParticipantsAudio,
	ParticipantView,
	SfuModels,
	StreamCall,
	StreamVideo,
	type StreamVideoClient,
	type StreamVideoParticipant,
	useCall,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
	const [meeting, setMeeting] = useState<MeetingState>({
		client: null,
		call: null,
		status: "loading",
		error: null,
	});

	useEffect(() => {
		let isMounted = true;
		let streamClient: StreamVideoClient | null = null;
		let streamCall: Call | null = null;

		const connect = async () => {
			try {
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
			void leaveMeeting(streamCall, streamClient);
		};
	}, [channelId, initialCameraMuted, initialMicMuted]);

	if (meeting.status === "loading") {
		return (
			<section className="mx-auto flex w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border border-border bg-card aspect-video">
				<p className="text-muted-foreground text-sm">
					Connecting to meeting...
				</p>
			</section>
		);
	}

	if (meeting.status === "error") {
		return (
			<section className="mx-auto flex w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border border-border bg-card px-6 text-center aspect-video">
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
			<section className="mx-auto flex w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border border-border bg-card px-6 text-center aspect-video">
				<p className="text-muted-foreground text-sm">You left the meeting.</p>
			</section>
		);
	}

	return (
		<StreamVideo client={meeting.client}>
			<StreamCall call={meeting.call}>
				<section className="relative mx-auto flex w-full max-w-5xl items-center justify-center overflow-hidden rounded-xl border border-border bg-card aspect-video">
					<div className="flex h-full w-full items-center justify-center p-3 pb-24 sm:p-5 sm:pb-28">
						<MeetVideoGrid />
					</div>
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
							await leaveMeeting(call, client);
							router.push(
								`/workspace/${workspaceId}/channel/${channelId}/chats`
							);
						}}
					/>
				</section>
			</StreamCall>
		</StreamVideo>
	);
}

function MeetVideoGrid() {
	const { useParticipants, useRemoteParticipants } = useCallStateHooks();
	const participants = useParticipants();
	const remoteParticipants = useRemoteParticipants();
	const count = participants.length;

	return (
		<>
			<ParticipantsAudio participants={remoteParticipants} />
			<div
				className={cn(
					"h-full min-h-[420px] w-full gap-3 sm:gap-4",
					count <= 1
						? "flex items-center justify-center"
						: "grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] content-center items-center"
				)}
			>
				{participants.map((participant) => (
					<ParticipantTile
						isSingle={count <= 1}
						key={participant.sessionId}
						participant={participant}
					/>
				))}
			</div>
		</>
	);
}

function ParticipantTile({
	isSingle,
	participant,
}: {
	isSingle: boolean;
	participant: StreamVideoParticipant;
}) {
	const isMicMuted =
		!participant.audioStream &&
		!participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
	const displayName = participant.name || participant.userId || "Guest";

	return (
		<div
			className={cn(
				"group relative isolate min-h-[220px] overflow-hidden rounded-xl border border-border bg-card transition duration-200 ease-out",
				isSingle
					? "aspect-video max-h-[68vh] w-full max-w-5xl"
					: "aspect-video h-full w-full"
			)}
		>
			<ParticipantView
				className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
				muteAudio
				ParticipantViewUI={null}
				participant={participant}
				VideoPlaceholder={() => <AvatarPlaceholder participant={participant} />}
			/>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background/85 via-background/35 to-transparent p-3">
				<div className="flex min-w-0 items-center justify-between gap-3">
					<span className="truncate font-medium text-sm text-foreground">
						{displayName}
						{participant.isLocalParticipant ? " (You)" : ""}
					</span>
					{isMicMuted && (
						<span
							className="rounded-full border border-border bg-background/80 p-1.5 text-muted-foreground backdrop-blur-sm"
							title="Muted"
						>
							<span className="sr-only">Microphone muted</span>
							<MicOff className="h-3.5 w-3.5" />
						</span>
					)}
				</div>
			</div>
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
			<div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card font-semibold text-2xl shadow-sm sm:h-24 sm:w-24">
				{initials}
			</div>
		</div>
	);
}

function MeetControls({ onLeave }: { onLeave: () => void }) {
	const call = useCall();
	const { useCameraState, useMicrophoneState } = useCallStateHooks();
	const { microphone, isMute: isMicMuted } = useMicrophoneState();
	const { camera, isMute: isCameraMuted } = useCameraState();
	const [isBusy, setIsBusy] = useState(false);

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
		<div className="-translate-x-1/2 absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border border-border bg-background/70 p-2 backdrop-blur">
			<button
				aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
				className={cn(
					"flex h-11 w-11 items-center justify-center rounded-full border text-sm transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60",
					isMicMuted
						? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
						: "border-border bg-background text-foreground hover:bg-background/80"
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
					"flex h-11 w-11 items-center justify-center rounded-full border text-sm transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60",
					isCameraMuted
						? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
						: "border-border bg-background text-foreground hover:bg-background/80"
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
			<button
				aria-label="Leave meeting"
				className="flex h-11 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-sm transition duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
				disabled={isBusy}
				onClick={onLeave}
				title="Leave"
				type="button"
			>
				<PhoneOff className="h-5 w-5" />
			</button>
		</div>
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
