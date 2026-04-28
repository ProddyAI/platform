"use client";

import {
	CallControls,
	SpeakerLayout,
	StreamCall,
	StreamTheme,
	StreamVideo,
	type Call,
	type StreamVideoClient,
} from "@stream-io/video-react-sdk";
import { useAction, useQuery } from "convex/react";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { createStreamClient } from "@/lib/stream";

type MeetPageProps = {
	params: {
		channelId: string;
	};
};

const disconnectMeeting = async (
	streamCall: Call | null,
	streamClient: StreamVideoClient | null
) => {
	await streamCall?.leave().catch(() => undefined);

	const disconnect = (
		streamCall as (Call & { disconnect?: () => Promise<void> }) | null
	)?.disconnect;
	await disconnect?.call(streamCall).catch(() => undefined);

	await streamClient?.disconnectUser().catch(() => undefined);
};

const MeetPage = ({ params }: MeetPageProps) => {
	const router = useRouter();
	const channelId = params.channelId as Id<"channels">;
	const createStreamToken = useAction(api.stream.createStreamToken);
	const channel = useQuery(api.channels.getById, { id: channelId });
	const [client, setClient] = useState<StreamVideoClient | null>(null);
	const [call, setCall] = useState<Call | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleLeave = useCallback(
		(err?: Error) => {
			if (err) {
				console.error("Error leaving meeting:", err);
			}

			if (!channel?.workspaceId) {
				router.push("/workspace");
				return;
			}

			router.push(`/workspace/${channel.workspaceId}/channel/${channelId}`);
		},
		[channel?.workspaceId, channelId, router]
	);

	useEffect(() => {
		let isMounted = true;
		let streamClient: StreamVideoClient | null = null;
		let streamCall: Call | null = null;

		const joinCall = async () => {
			try {
				setError(null);

				const { apiKey, token, userId } = await createStreamToken({});
				if (!isMounted) return;

				streamClient = createStreamClient(apiKey, { id: userId }, token);
				streamCall = streamClient.call("default", channelId);

				await streamCall.join({ create: true });
				if (!isMounted) {
					await streamCall.leave();
					await streamClient.disconnectUser();
					return;
				}

				setClient(streamClient);
				setCall(streamCall);
			} catch (err) {
				if (!isMounted) return;
				setError(err instanceof Error ? err.message : "Unable to join meeting");
			}
		};

		void joinCall();

		return () => {
			isMounted = false;
			setClient(null);
			setCall(null);
			void disconnectMeeting(streamCall, streamClient);
		};
	}, [channelId, createStreamToken]);

	if (error) {
		return (
			<div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
				<p className="text-sm text-muted-foreground">{error}</p>
			</div>
		);
	}

	if (!client || !call || channel === undefined) {
		return (
			<div className="flex h-screen flex-col items-center justify-center bg-background">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!channel) {
		return (
			<div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
				<p className="text-sm text-muted-foreground">Channel not found.</p>
			</div>
		);
	}

	return (
		<div className="relative h-screen overflow-hidden bg-background text-foreground">
			<StreamVideo client={client}>
				<StreamTheme className="h-full bg-background text-foreground">
					<StreamCall call={call}>
						<div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4">
							<header className="flex h-16 shrink-0 items-center justify-between border-b border-border">
								<div className="min-w-0">
									<h1 className="truncate font-semibold text-lg">
										# {channel.name}
									</h1>
									<p className="text-muted-foreground text-sm">Live meeting</p>
								</div>
							</header>

							<main className="relative flex min-h-0 flex-1 items-center justify-center py-4">
								<div className="h-full w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm [&_.str-video__participant-view]:rounded-lg [&_.str-video__speaker-layout]:h-full">
									<SpeakerLayout />
								</div>

								<div className="-translate-x-1/2 absolute bottom-8 left-1/2 z-30 rounded-full border border-border bg-background/80 px-3 py-2 shadow-lg backdrop-blur">
									<CallControls onLeave={handleLeave} />
								</div>
							</main>
						</div>
					</StreamCall>
				</StreamTheme>
			</StreamVideo>
		</div>
	);
};

export default MeetPage;
