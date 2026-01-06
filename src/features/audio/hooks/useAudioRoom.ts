<<<<<<< HEAD
import { useState, useEffect, useCallback } from 'react';
import { StreamVideoClient } from '@stream-io/video-react-sdk';
import type { User, Call } from '@stream-io/video-react-sdk';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';

// Stream API credentials from environment variables
const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY ?? '';
=======
import {
	type Call,
	StreamVideoClient,
	type User,
} from "@stream-io/video-react-sdk";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";

// Stream API credentials from environment variables
const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY || "";
>>>>>>> origin/main

interface UseAudioRoomProps {
	roomId: string;
	workspaceId: string;
	channelId: string;
	canvasName?: string;
	shouldConnect?: boolean;
}

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

	// Get current user from Convex
	const currentUser = useQuery(api.users.current);

	const connectToAudioRoom = useCallback(async () => {
		if (!apiKey) {
			setError('Stream API is not configured (NEXT_PUBLIC_STREAM_API_KEY missing)');
			return;
		}

		if (!currentUser) {
			setError('You must be signed in to join the audio room');
			return;
		}

		if (!roomId || !workspaceId || !channelId) {
			setError('Missing room information for audio');
			return;
		}

		try {
			setIsConnecting(true);
			setError(null);

			const userId = String(currentUser._id);

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
					userName: currentUser.name,
					userImage: currentUser.image,
				}),
			});

			if (!response.ok) {
<<<<<<< HEAD
				const errorData: unknown = await response.json().catch(() => null);
				console.error('Stream token request failed:', response.status, errorData);
				const message =
					typeof (errorData as { error?: unknown } | null)?.error === 'string'
						? (errorData as { error: string }).error
						: `Failed to get Stream token (${response.status})`;
				throw new Error(message);
=======
				const _errorData = await response.json().catch(() => ({}));
				console.error("Stream token request failed:", response.status);
				throw new Error(`Failed to get Stream token: ${response.status}`);
>>>>>>> origin/main
			}

			const tokenResponse = await response.json();
			const { token } = tokenResponse;

			// Initialize Stream client
			const videoClient = new StreamVideoClient({
				apiKey,
				user,
				token,
			});

			setClient(videoClient);

			// Create unique room ID (keeping it under 64 characters)
			const uniqueRoomId =
				`audio-${workspaceId.slice(-8)}-${channelId.slice(-8)}-${roomId.slice(-8)}`.substring(
					0,
					63
				);

<<<<<<< HEAD
			// Create and join the call.
			// Use a permissive call type so users can publish mic audio by default.
			const audioCall = videoClient.call('default', uniqueRoomId);

			// For an audio room experience, don't publish camera.
			try {
				await audioCall.camera.disable();
			} catch (err) {
				console.warn('Failed to disable camera:', err);
			}

			// Ensure microphone is enabled/published.
			try {
				await audioCall.microphone.enable();
			} catch (err) {
				console.warn('Failed to enable microphone:', err);
			}
=======
			// Create and join the call
			const audioCall = videoClient.call("audio_room", uniqueRoomId);
>>>>>>> origin/main

			await audioCall.join({
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

			// Some browsers/devices need mic enable after join as well.
			try {
				await audioCall.microphone.enable();
			} catch (err) {
				console.warn('Failed to enable microphone after join:', err);
			}

			setCall(audioCall);
			setIsConnected(true);
			setIsConnecting(false);
<<<<<<< HEAD
		} catch (error: unknown) {
			console.error('Failed to setup audio room:', error);
			const message =
				error instanceof Error
					? error.message
					: typeof error === 'string'
						? error
						: 'Failed to connect to audio room';
			setError(message);
=======
		} catch (error: any) {
			console.error("Failed to setup audio room:", error);
			setError(error.message || "Failed to connect to audio room");
>>>>>>> origin/main
			setIsConnecting(false);
		}
	}, [channelId, canvasName, currentUser, roomId, workspaceId]);

	const disconnectFromAudioRoom = useCallback(async () => {
		try {
			// Set disconnecting state to prevent UI issues
			setIsConnecting(false);
			setError(null);

			// First, leave the call if it exists
			if (call) {
				try {
					await call.leave();
				} catch (callError) {
					console.warn("Error leaving call:", callError);
					// Continue with cleanup even if call.leave() fails
				}
				setCall(null);
			}

			// Then disconnect the client if it exists
			if (client) {
				try {
					await client.disconnectUser();
				} catch (clientError) {
					console.warn("Error disconnecting client:", clientError);
					// Continue with cleanup even if disconnectUser() fails
				}
				setClient(null);
			}

			// Reset connection state
			setIsConnected(false);
			return true;
		} catch (error) {
			console.error("Failed to disconnect from audio room:", error);

			// Force cleanup even if there's an error
			setCall(null);
			setClient(null);
			setIsConnected(false);
			setIsConnecting(false);
			return false;
		}
	}, [call, client]);

	useEffect(() => {
		if (shouldConnect && !isConnected && !isConnecting) {
			void connectToAudioRoom();
		}
<<<<<<< HEAD
	}, [
		shouldConnect,
		roomId,
		workspaceId,
		channelId,
		isConnected,
		isConnecting,
		connectToAudioRoom,
	]);
=======
	}, [shouldConnect, isConnected, isConnecting, connectToAudioRoom]);
>>>>>>> origin/main

	// Effect to handle disconnection when shouldConnect becomes false
	useEffect(() => {
		if (!shouldConnect && (isConnected || isConnecting)) {
			void disconnectFromAudioRoom();
		}
	}, [shouldConnect, isConnected, isConnecting, disconnectFromAudioRoom]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (call) {
				void call.leave().catch(console.error);
			}
			if (client) {
				void client.disconnectUser().catch(console.error);
			}
		};
	}, [call, client]);

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
