"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MeetRoom } from "@/components/meet/MeetRoom";

type MeetPageProps = {
	params: {
		channelId?: string;
	};
};

export default function MeetPage({ params }: MeetPageProps) {
	const [isReady, setIsReady] = useState(false);
	const searchParams = useSearchParams();
	const channelId = params.channelId;
	const workspaceId = searchParams.get("workspaceId") ?? "";
	const channelName = formatChannelName(channelId);
	const initialMicMuted = searchParams.get("mic") === "off";
	const initialCameraMuted = searchParams.get("camera") === "off";

	useEffect(() => {
		setIsReady(true);
	}, []);

	if (!isReady) {
		return (
			<main className="min-h-screen bg-background text-foreground">
				<div className="mx-auto max-w-7xl px-4 py-4">
					<div className="flex min-h-[70vh] items-center justify-center">
					<p className="text-muted-foreground text-sm">
						Connecting to meeting...
					</p>
					</div>
				</div>
			</main>
		);
	}

	if (!channelId || !workspaceId) {
		return (
			<main className="min-h-screen bg-background text-foreground">
				<div className="mx-auto max-w-7xl px-4 py-4">
					<div className="flex min-h-[70vh] items-center justify-center">
						<div className="rounded-xl border border-border bg-card px-6 py-5 text-center">
							<h1 className="font-semibold text-lg">Live meeting</h1>
							<p className="mt-2 text-muted-foreground text-sm">
								Meeting details are missing.
							</p>
						</div>
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen overflow-x-hidden bg-background text-foreground">
			<div className="mx-auto max-w-7xl px-4 py-4">
				<div className="flex flex-col gap-4">
					<header className="flex min-w-0 items-center justify-between gap-4 border-b border-border bg-background px-1 py-2">
						<div className="min-w-0">
							<p className="truncate font-semibold text-lg">#{channelName}</p>
							<p className="text-muted-foreground text-sm">Live meeting</p>
						</div>
						<div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground">
							<span className="h-2 w-2 rounded-full bg-emerald-500" />
							<span className="font-medium">Live</span>
						</div>
					</header>

					<MeetRoom
						channelId={channelId}
						workspaceId={workspaceId}
						initialCameraMuted={initialCameraMuted}
						initialMicMuted={initialMicMuted}
					/>
				</div>
			</div>
		</main>
	);
}

function formatChannelName(channelId?: string) {
	if (!channelId) return "meeting";

	try {
		return decodeURIComponent(channelId).replace(/^#/, "");
	} catch {
		return channelId.replace(/^#/, "");
	}
}
