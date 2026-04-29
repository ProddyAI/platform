"use client";

import { useAtom } from "jotai";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
	type Call,
	ParticipantView,
	StreamCall,
	StreamVideo,
	type StreamVideoClient,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { activeMeetingAtom } from "@/lib/meet-call-store";
import { cn } from "@/lib/utils";

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

function MiniPlayerContent() {
	const router = useRouter();
	const [activeMeeting, setActiveMeeting] = useAtom(activeMeetingAtom);
	const { useDominantSpeaker, useLocalParticipant, useMicrophoneState } =
		useCallStateHooks();
	const dominantSpeaker = useDominantSpeaker();
	const localParticipant = useLocalParticipant();
	const participant = dominantSpeaker || localParticipant;
	const { microphone, isMute: isMicMuted } = useMicrophoneState();

	if (!activeMeeting || !participant) return null;

	return (
		<div
			className="fixed bottom-4 right-4 z-50 h-36 w-64 cursor-pointer overflow-hidden rounded-xl border bg-background/80 shadow-sm backdrop-blur"
			onClick={() =>
				router.push(
					`/meet/${activeMeeting.channelId}?workspaceId=${activeMeeting.workspaceId}`
				)
			}
		>
			<ParticipantView
				className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
				muteAudio
				ParticipantViewUI={null}
				participant={participant}
			/>
			<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/80 p-2 backdrop-blur">
				<span className="truncate text-xs text-foreground">
					{participant.name || participant.userId || "Meeting"}
				</span>
				<div className="flex items-center gap-1">
					<button
						aria-label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
						className={cn(
							"flex h-8 w-8 items-center justify-center rounded-full bg-muted transition hover:bg-accent",
							!isMicMuted
								? "bg-primary text-white hover:bg-primary/90"
								: "text-muted-foreground"
						)}
						onClick={(event) => {
							event.stopPropagation();
							void microphone.toggle();
						}}
						type="button"
					>
						{isMicMuted ? (
							<MicOff className="h-4 w-4" />
						) : (
							<Mic className="h-4 w-4" />
						)}
					</button>
					<button
						aria-label="Leave meeting"
						className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
						onClick={async (event) => {
							event.stopPropagation();
							await leaveMeeting(activeMeeting.call, activeMeeting.client);
							setActiveMeeting(null);
						}}
						type="button"
					>
						<PhoneOff className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);
}

export function MiniPlayer() {
	const pathname = usePathname();
	const [activeMeeting] = useAtom(activeMeetingAtom);

	if (!activeMeeting || pathname.startsWith("/meet/")) {
		return null;
	}

	return (
		<StreamVideo client={activeMeeting.client}>
			<StreamCall call={activeMeeting.call}>
				<MiniPlayerContent />
			</StreamCall>
		</StreamVideo>
	);
}
