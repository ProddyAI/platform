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
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
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
			<DialogContent className="max-w-[460px] rounded-xl border bg-background p-0 shadow-sm [&>button:last-child]:hidden">
				<div className="space-y-4 p-5 text-foreground">
					<div className="mb-3 flex items-center justify-between">
						<div>
							<DialogTitle className="text-lg font-semibold">
								Join meeting
							</DialogTitle>
							<DialogDescription>
								Check your camera and microphone
							</DialogDescription>
						</div>
						<DialogClose
							className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
							type="button"
						>
							<span aria-hidden="true">x</span>
							<span className="sr-only">Close</span>
						</DialogClose>
					</div>

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
		<div className="space-y-4">
			<div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-muted">
				<div className="h-full w-full [&_.str-video__video-preview-container]:h-full [&_.str-video__video-preview-container]:w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
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
				<div className="absolute bottom-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur">
					{displayName}
				</div>
			</div>

			<div className="flex justify-center gap-3">
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
					label={isCameraMuted ? "Turn camera on" : "Turn camera off"}
					onClick={() => runControl(() => camera.toggle())}
				/>
			</div>

			<div className="flex justify-end gap-2">
				<button
					className="rounded-md bg-muted px-4 py-2 text-sm text-foreground transition hover:bg-accent"
					onClick={onCancel}
					type="button"
				>
					Cancel
				</button>
				<button
					className="rounded-md bg-primary px-4 py-2 text-sm text-white transition hover:opacity-90"
					onClick={handleStart}
					type="button"
				>
					Join meeting
				</button>
			</div>
		</div>
	);
}

function ControlButton({
	disabled,
	icon,
	isActive,
	label,
	onClick,
}: {
	disabled?: boolean;
	icon: React.ReactNode;
	isActive: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			aria-label={label}
			className={cn(
				"flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
				isActive ? "bg-primary text-white hover:bg-primary/90" : "text-muted-foreground"
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
		<div className="space-y-4">
			<div className="flex aspect-video items-center justify-center rounded-xl border bg-muted">
				{isLoading ? (
					<p className="text-muted-foreground text-sm">Preparing your preview...</p>
				) : (
					<PreviewAvatar
						label={displayName}
						subtitle={error || "Preview unavailable"}
					/>
				)}
			</div>
			<div className="flex justify-end gap-2">
				<button
					className="rounded-md bg-muted px-4 py-2 text-sm text-foreground transition hover:bg-accent"
					onClick={onCancel}
					type="button"
				>
					Cancel
				</button>
				<button
					className="rounded-md bg-primary px-4 py-2 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					disabled
					type="button"
				>
					Join meeting
				</button>
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
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 font-semibold text-lg text-foreground">
				{getInitials(label)}
			</div>
			<div className="space-y-1">
				<p className="text-sm text-foreground">{label}</p>
				<p className="text-muted-foreground text-xs">{subtitle}</p>
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
