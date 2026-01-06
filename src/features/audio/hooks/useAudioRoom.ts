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

	const connectToAudioRoom = async () => {
		if (!currentUser || !roomId || !workspaceId || !channelId || !apiKey)
			return;

		try {
			setIsConnecting(true);
			setError(null);

			const userId = currentUser._id;

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
				const _errorData = await response.json().catch(() => ({}));
				console.error("Stream token request failed:", response.status);
				throw new Error(`Failed to get Stream token: ${response.status}`);
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

			// Create and join the call
			const audioCall = videoClient.call("audio_room", uniqueRoomId);

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

			setCall(audioCall);
			setIsConnected(true);
			setIsConnecting(false);
		} catch (error: any) {
			console.error("Failed to setup audio room:", error);
			setError(error.message || "Failed to connect to audio room");
			setIsConnecting(false);
		}
	};

	const disconnectFromAudioRoom = async () => {
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
	};

	useEffect(() => {
		if (shouldConnect && !isConnected && !isConnecting) {
			connectToAudioRoom();
		}
	}, [shouldConnect, isConnected, isConnecting, connectToAudioRoom]);

	// Effect to handle disconnection when shouldConnect becomes false
	useEffect(() => {
		if (!shouldConnect && (isConnected || isConnecting)) {
			disconnectFromAudioRoom();
		}
	}, [shouldConnect, isConnected, isConnecting, disconnectFromAudioRoom]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (call) {
				call.leave().catch(console.error);
			}
			if (client) {
				client.disconnectUser().catch(console.error);
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
