import {
	type Call,
	StreamVideoClient,
	type User,
} from "@stream-io/video-react-sdk";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/../convex/_generated/api";

// Stream API credentials from environment variables
const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY ?? "";
const callType = process.env.NEXT_PUBLIC_STREAM_CALL_TYPE ?? "default";

interface UseAudioRoomProps {
	roomId: string;
	workspaceId: string;
	channelId: string;
	canvasName?: string;
	shouldConnect?: boolean;
}

const STREAM_DEVICE_ID_STORAGE_KEY = "proddy:streamDeviceId";

const getOrCreateStreamDeviceId = () => {
	if (typeof window === "undefined") return "server";

	try {
		const existing = window.localStorage.getItem(STREAM_DEVICE_ID_STORAGE_KEY);
		if (existing) return existing;

		const next =
			typeof window.crypto?.randomUUID === "function"
				? window.crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(16).slice(2)}`;

		window.localStorage.setItem(STREAM_DEVICE_ID_STORAGE_KEY, next);
		return next;
	} catch {
		// If storage is unavailable (privacy mode), fall back to an ephemeral id.
		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
};

export const useAudioRoom = ({
	roomId,
	workspaceId,
	channelId,
	canvasName,
	shouldConnect = false,
}: UseAudioRoomProps) => {
	const [client, setClient] = useState<StreamVideoClient | null>(null);
	const [call, setCall] = useState<Call | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Refs to make connect/disconnect robust in React dev (StrictMode, HMR).
	const mountedRef = useRef(true);
	const connectRunIdRef = useRef(0);
	const connectInFlightRef = useRef<Promise<void> | null>(null);
	const callRef = useRef<Call | null>(null);
	const clientRef = useRef<StreamVideoClient | null>(null);

	// Get current user from Convex
	const currentUser = useQuery(api.users.current);

	const connectToAudioRoom = useCallback(async () => {
		if (!apiKey) {
			setError(
				"Stream API is not configured (NEXT_PUBLIC_STREAM_API_KEY missing)"
			);
			return;
		}

		if (!currentUser) {
			setError("You must be signed in to join the audio room");
			return;
		}

		if (!roomId || !workspaceId || !channelId) {
			setError("Missing room information for audio");
			return;
		}

		// Prevent concurrent connect attempts (common with StrictMode + fast refresh).
		if (connectInFlightRef.current) {
			return;
		}

		const runId = ++connectRunIdRef.current;

		const connectPromise = (async () => {
			try {
				setIsConnecting(true);
				setError(null);

				const baseUserId = String(currentUser._id);
				// Stream Video de-dupes participants by user.id. For local testing (two browsers/tabs),
				// we suffix a stable per-browser device id so both connections show up as participants.
				const deviceId = getOrCreateStreamDeviceId();
				const userId = `${baseUserId}-${deviceId}`.slice(0, 128);

				// Create user object for Stream
				const user: User = {
					id: userId,
					name: currentUser.name || "Anonymous",
					image:
						currentUser.image ||
						`https://getstream.io/random_svg/?id=${userId}&name=${currentUser.name}`,
				};

				// Fetch token from our API
				const response = await fetch("/api/stream", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						userId,
						baseUserId,
						userName: currentUser.name,
						userImage: currentUser.image,
					}),
				});

				if (!response.ok) {
					const errorData: unknown = await response.json().catch(() => null);
					console.error(
						"Stream token request failed:",
						response.status,
						errorData
					);
					const message =
						typeof (errorData as { error?: unknown } | null)?.error === "string"
							? (errorData as { error: string }).error
							: `Failed to get Stream token (${response.status})`;
					throw new Error(message);
				}

				const tokenResponse = await response.json();
				const { token } = tokenResponse;

				// Initialize Stream client
				const videoClient = new StreamVideoClient({
					apiKey,
					user,
					token,
				});

				if (!mountedRef.current || connectRunIdRef.current !== runId) {
					try {
						await videoClient.disconnectUser();
					} catch {
						// ignore
					}
					return;
				}

				setClient(videoClient);
				clientRef.current = videoClient;

				// Create unique room ID (keeping it under 64 characters)
				const uniqueRoomId =
					`audio-${workspaceId.slice(-8)}-${channelId.slice(-8)}-${roomId.slice(-8)}`.substring(
						0,
						63
					);

				const callTypesToTry = Array.from(
					new Set([callType, "default", "audio_room"].filter(Boolean))
				);

				let lastJoinError: unknown = null;
				let joinedCall: Call | null = null;
				let joinedCallType: string | null = null;

				if (process.env.NODE_ENV === "development") {
					(
						globalThis as unknown as { __proddyStreamAudioDebug?: unknown }
					).__proddyStreamAudioDebug = {
						userId: user.id,
						baseUserId,
						deviceId,
						roomId,
						workspaceId,
						channelId,
						callId: uniqueRoomId,
						typeCandidates: callTypesToTry,
					};
					console.log("Stream audio debug (before join)", {
						userId: user.id,
						baseUserId,
						deviceId,
						roomId,
						callId: uniqueRoomId,
						typeCandidates: callTypesToTry,
					});
				}

				for (const candidateCallType of callTypesToTry) {
					const candidateCall = videoClient.call(
						candidateCallType,
						uniqueRoomId
					);

					// For an audio room experience, don't publish camera.
					try {
						await candidateCall.camera.disable();
					} catch (err) {
						console.warn("Failed to disable camera:", err);
					}

					// Ensure microphone is enabled/published.
					try {
						await candidateCall.microphone.enable();
					} catch (err) {
						console.warn("Failed to enable microphone:", err);
					}

					try {
						await candidateCall.join({
							create: true,
							data: {
								custom: {
									title: canvasName || "Audio Room",
									description: "Collaborate with audio",
									workspaceId,
									channelId,
									roomId: roomId,
								},
							},
						});

						joinedCall = candidateCall;
						joinedCallType = candidateCallType;
						break;
					} catch (joinError: unknown) {
						lastJoinError = joinError;

						const maybeAxios = joinError as {
							message?: unknown;
							code?: unknown;
							response?: { status?: unknown; data?: unknown };
						};

						const status =
							typeof maybeAxios?.response?.status === "number"
								? maybeAxios.response.status
								: undefined;
						const code =
							typeof maybeAxios?.code === "string"
								? maybeAxios.code
								: undefined;

						console.error("Stream call join failed", {
							callType: candidateCallType,
							callId: uniqueRoomId,
							roomId,
							status,
							code,
							responseData: maybeAxios?.response?.data,
							error: joinError,
						});

						// If the call type doesn't exist (commonly 404), try the next candidate.
						if (status === 404) {
							continue;
						}

						// For other errors (auth/permissions/network), stop and surface the error.
						break;
					}
				}

				if (!mountedRef.current || connectRunIdRef.current !== runId) {
					// A newer connect/disconnect happened while we were joining.
					try {
						await joinedCall?.leave();
					} catch {
						// ignore
					}
					try {
						await videoClient.disconnectUser();
					} catch {
						// ignore
					}
					return;
				}

				if (!joinedCall || !joinedCallType) {
					const maybeAxios = lastJoinError as {
						message?: unknown;
						code?: unknown;
						response?: { status?: unknown; data?: unknown };
					};
					const status =
						typeof maybeAxios?.response?.status === "number"
							? maybeAxios.response.status
							: undefined;
					const code =
						typeof maybeAxios?.code === "string" ? maybeAxios.code : undefined;

					let details =
						typeof maybeAxios?.message === "string"
							? maybeAxios.message
							: lastJoinError instanceof Error
								? lastJoinError.message
								: typeof lastJoinError === "string"
									? lastJoinError
									: "Unknown error";

					if (status) details = `${details} (HTTP ${status})`;
					if (code) details = `${details} [${code}]`;

					throw new Error(
						`Failed to join Stream call (id=${uniqueRoomId}). Tried call types: ${callTypesToTry.join(
							", "
						)}. ${details}`
					);
				}

				console.log("Stream call joined", {
					userId: user.id,
					callType: joinedCallType,
					callId: uniqueRoomId,
					roomId,
				});

				// Some browsers/devices need mic enable after join as well.
				try {
					await joinedCall.microphone.enable();
				} catch (err) {
					console.warn("Failed to enable microphone after join:", err);
				}

				setCall(joinedCall);
				callRef.current = joinedCall;
				setIsConnected(true);
				setIsConnecting(false);
			} catch (error: unknown) {
				console.error("Failed to setup audio room:", error);
				const message =
					error instanceof Error
						? error.message
						: typeof error === "string"
							? error
							: "Failed to connect to audio room";
				setError(message);
				setIsConnecting(false);
			}
		})();

		connectInFlightRef.current = connectPromise;
		try {
			await connectPromise;
		} finally {
			if (connectInFlightRef.current === connectPromise) {
				connectInFlightRef.current = null;
			}
		}
	}, [channelId, canvasName, currentUser, roomId, workspaceId]);

	const disconnectFromAudioRoom = useCallback(async () => {
		// Invalidate any in-flight connect.
		connectRunIdRef.current += 1;
		connectInFlightRef.current = null;

		try {
			// Set disconnecting state to prevent UI issues
			setIsConnecting(false);
			setError(null);

			// First, leave the call if it exists
			const callToLeave = callRef.current ?? call;
			if (callToLeave) {
				try {
					await callToLeave.leave();
				} catch (callError) {
					console.warn("Error leaving call:", callError);
					// Continue with cleanup even if call.leave() fails
				}
				setCall(null);
				callRef.current = null;
			}

			// Then disconnect the client if it exists
			const clientToDisconnect = clientRef.current ?? client;
			if (clientToDisconnect) {
				try {
					await clientToDisconnect.disconnectUser();
				} catch (clientError) {
					console.warn("Error disconnecting client:", clientError);
					// Continue with cleanup even if disconnectUser() fails
				}
				setClient(null);
				clientRef.current = null;
			}

			// Reset connection state
			setIsConnected(false);
			return true;
		} catch (error) {
			console.error("Failed to disconnect from audio room:", error);

			// Force cleanup even if there's an error
			setCall(null);
			setClient(null);
			callRef.current = null;
			clientRef.current = null;
			setIsConnected(false);
			setIsConnecting(false);
			return false;
		}
	}, [call, client]);

	useEffect(() => {
		if (shouldConnect && !isConnected && !isConnecting) {
			void connectToAudioRoom();
		}
	}, [shouldConnect, isConnected, isConnecting, connectToAudioRoom]);

	// Effect to handle disconnection when shouldConnect becomes false
	useEffect(() => {
		if (!shouldConnect && (isConnected || isConnecting)) {
			void disconnectFromAudioRoom();
		}
	}, [shouldConnect, isConnected, isConnecting, disconnectFromAudioRoom]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			// Best-effort cleanup. Use refs to avoid stale closures.
			const c = callRef.current;
			const cl = clientRef.current;
			callRef.current = null;
			clientRef.current = null;
			void c?.leave().catch(() => undefined);
			void cl?.disconnectUser().catch(() => undefined);
		};
	}, []);

	return {
		client,
		call,
		currentUser,
		isConnecting,
		isConnected,
		error,
		connectToAudioRoom,
		disconnectFromAudioRoom,
	};
};
