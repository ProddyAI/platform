"use client";

import {
	type Call,
	StreamCall,
	StreamVideo,
	type StreamVideoClient,
	VideoPreview,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { createStreamClient } from "@/lib/stream";
import { cn } from "@/lib/utils";

type HuddleModalProps = {
	channelId: string;
	workspaceId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

type TokenResponse = {
	token?: string;
	userId?: string;
	name?: string;
	image?: string;
	error?: string;
};

type PreviewState = {
	call: Call | null;
	client: StreamVideoClient | null;
	error: string | null;
	status: "idle" | "loading" | "ready" | "error";
};

async function disposePreview(
	call: Call | null,
	client: StreamVideoClient | null
) {
	try {
		await call?.camera.disable(true);
	} catch {}

	try {
		await call?.microphone.disable(true);
	} catch {}

	try {
		await client?.disconnectUser();
	} catch {}
}

export function HuddleModal({
	channelId,
	workspaceId,
	onOpenChange,
	open,
}: HuddleModalProps) {
	const router = useRouter();
	const { data: currentUser } = useCurrentUser();
	const [preview, setPreview] = useState<PreviewState>({
		call: null,
		client: null,
		error: null,
		status: "idle",
	});

	const displayName =
		currentUser?.name?.trim() || currentUser?.email || "You";

	useEffect(() => {
		if (!open) {
			setPreview({
				call: null,
				client: null,
				error: null,
				status: "idle",
			});
			return;
		}

		let isMounted = true;
		let streamClient: StreamVideoClient | null = null;
		let streamCall: Call | null = null;

		const preparePreview = async () => {
			setPreview({
				call: null,
				client: null,
				error: null,
				status: "loading",
			});

			try {
				const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
				if (!apiKey) {
					throw new Error("Stream public API key is missing");
				}

				const response = await fetch("/api/stream/token", {
					cache: "no-store",
					method: "GET",
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
					image: data.image,
					name: data.name,
					token: data.token,
					userId: data.userId,
				});
				streamCall = streamClient.call("default", channelId);

				await Promise.allSettled([
					streamCall.camera.enable(),
					streamCall.microphone.enable(),
				]);

				if (!isMounted) {
					await disposePreview(streamCall, streamClient);
					return;
				}

				setPreview({
					call: streamCall,
					client: streamClient,
					error: null,
					status: "ready",
				});
			} catch (error) {
				if (!isMounted) return;

				setPreview({
					call: null,
					client: null,
					error:
						error instanceof Error
							? error.message
							: "Failed to prepare meeting preview",
					status: "error",
				});
			}
		};

		void preparePreview();

		return () => {
			isMounted = false;
			void disposePreview(streamCall, streamClient);
		};
	}, [channelId, open]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-2xl overflow-hidden rounded-xl border-border bg-card p-0 text-foreground shadow-xl">
				<DialogHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
					<DialogTitle>Start meeting</DialogTitle>
					<DialogDescription>
						Check your camera and mic before you join.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 p-6">
					{preview.status === "ready" && preview.client && preview.call ? (
						<StreamVideo client={preview.client}>
							<StreamCall call={preview.call}>
								<HuddlePreview
									channelId={channelId}
									displayName={displayName}
									onCancel={() => onOpenChange(false)}
									onStartNavigation={(href) => {
										onOpenChange(false);
										router.push(href);
									}}
									workspaceId={workspaceId}
								/>
							</StreamCall>
						</StreamVideo>
					) : (
						<PreviewFallback
							displayName={displayName}
							error={preview.status === "error" ? preview.error : null}
							isLoading={preview.status === "loading"}
							onCancel={() => onOpenChange(false)}
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function HuddlePreview({
	channelId,
	displayName,
	onCancel,
	onStartNavigation,
	workspaceId,
}: {
	channelId: string;
	displayName: string;
	onCancel: () => void;
	onStartNavigation: (href: string) => void;
	workspaceId: string;
}) {
	const { useCameraState, useMicrophoneState } = useCallStateHooks();
	const { camera, isMute: isCameraMuted } = useCameraState();
	const { microphone, isMute: isMicMuted } = useMicrophoneState();
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

	const handleStart = () => {
		const params = new URLSearchParams();
		params.set("workspaceId", workspaceId);
		if (isMicMuted) {
			params.set("mic", "off");
		}
		if (isCameraMuted) {
			params.set("camera", "off");
		}

		const query = params.toString();
		onStartNavigation(
			`/meet/${encodeURIComponent(channelId)}${query ? `?${query}` : ""}`
		);
	};

	return (
		<div className="space-y-5">
			<div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
				<div className="aspect-video w-full bg-muted/30 [&_.str-video__video-preview-container]:h-full [&_.str-video__video-preview-container]:w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
					<VideoPreview
						DisabledVideoPreview={() => (
							<PreviewAvatar
								label={displayName}
								subtitle="Camera is off"
							/>
						)}
						NoCameraPreview={() => (
							<PreviewAvatar
								label={displayName}
								subtitle="No camera available"
							/>
						)}
						className="h-full w-full"
					/>
				</div>
				<div className="flex items-center justify-between border-t border-border px-4 py-3">
					<div className="min-w-0">
						<p className="truncate font-medium text-foreground text-sm">
							{displayName}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<ControlButton
							disabled={isBusy}
							icon={
								isMicMuted ? (
									<MicOff className="h-5 w-5" />
								) : (
									<Mic className="h-5 w-5" />
								)
							}
							isActive={!isMicMuted}
							isDestructive={isMicMuted}
							label={isMicMuted ? "Unmute microphone" : "Mute microphone"}
							onClick={() => runControl(() => microphone.toggle())}
						/>
						<ControlButton
							disabled={isBusy}
							icon={
								isCameraMuted ? (
									<VideoOff className="h-5 w-5" />
								) : (
									<Video className="h-5 w-5" />
								)
							}
							isActive={!isCameraMuted}
							isDestructive={isCameraMuted}
							label={isCameraMuted ? "Turn camera on" : "Turn camera off"}
							onClick={() => runControl(() => camera.toggle())}
						/>
					</div>
				</div>
			</div>

			<div className="flex items-center justify-end gap-3">
				<Button onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
				<Button onClick={handleStart} type="button">
					Start meeting
				</Button>
			</div>
		</div>
	);
}

function ControlButton({
	disabled,
	icon,
	isActive,
	isDestructive,
	label,
	onClick,
}: {
	disabled?: boolean;
	icon: React.ReactNode;
	isActive: boolean;
	isDestructive?: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-label={label}
			className={cn(
				"flex h-11 w-11 items-center justify-center rounded-full border text-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
				isDestructive
					? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
					: isActive
						? "border-border bg-background text-foreground hover:bg-background/80"
						: "border-border bg-background text-muted-foreground hover:bg-background/80"
			)}
			disabled={disabled}
			onClick={onClick}
			title={label}
			type="button"
		>
			{icon}
		</button>
	);
}

function PreviewFallback({
	displayName,
	error,
	isLoading,
	onCancel,
}: {
	displayName: string;
	error: string | null;
	isLoading: boolean;
	onCancel: () => void;
}) {
	return (
		<div className="space-y-5">
			<div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-background shadow-sm">
				{isLoading ? (
					<p className="text-muted-foreground text-sm">Preparing your preview...</p>
				) : (
					<PreviewAvatar
						label={displayName}
						subtitle={error || "Preview unavailable"}
					/>
				)}
			</div>
			<div className="flex items-center justify-end gap-3">
				<Button onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
				<Button disabled type="button">
					Start meeting
				</Button>
			</div>
		</div>
	);
}

function PreviewAvatar({
	label,
	subtitle,
}: {
	label: string;
	subtitle: string;
}) {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
			<div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card font-semibold text-2xl text-foreground shadow-sm">
				{getInitials(label)}
			</div>
			<div className="space-y-1">
				<p className="font-medium text-foreground text-sm">{label}</p>
				<p className="text-muted-foreground text-sm">{subtitle}</p>
			</div>
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
