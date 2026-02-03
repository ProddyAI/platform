"use client";

import {
	OwnCapability,
	useCall,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { AlertCircle, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AudioControlButton } from "./AudioControlButton";

export const AudioToolbarButton = () => {
	const call = useCall();
	const { useMicrophoneState, useHasPermissions } = useCallStateHooks();
	const { microphone, isMute } = useMicrophoneState();
	const [micPermissionError, setMicPermissionError] = useState(false);
	const hasAudioPermission = useHasPermissions(OwnCapability.SEND_AUDIO);

	// Speaker state (audio output)
	// Default to unmuted so audio works immediately after a user joins.
	// If autoplay is blocked, we'll attempt play() and log a warning.
	const [speakerMuted, setSpeakerMuted] = useState(false);

	// Check browser microphone permissions on mount
	useEffect(() => {
		const checkMicrophonePermission = async () => {
			try {
				const devices = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				setMicPermissionError(false);
				devices.getTracks().forEach((track) => track.stop());
			} catch (error) {
				console.error("Microphone permission error:", error);
				setMicPermissionError(true);
			}
		};

		void checkMicrophonePermission();
	}, []);

	// Request Stream audio permission if we don't have it
	useEffect(() => {
		if (call && !hasAudioPermission) {
			const requestAudioPermission = async () => {
				try {
					if (!call.permissionsContext.canRequest(OwnCapability.SEND_AUDIO))
						return;
					await call.requestPermissions({
						permissions: [OwnCapability.SEND_AUDIO],
					});
				} catch (error) {
					console.error("Failed to request audio permission:", error);
				}
			};

			void requestAudioPermission();
		}
	}, [call, hasAudioPermission]);

	// Apply speaker mute state to any audio elements that get added to the DOM
	useEffect(() => {
		// Function to apply mute state to all audio elements
		const applyMuteState = () => {
			const audioElements = document.querySelectorAll("audio");
			audioElements.forEach((audio) => {
				audio.muted = speakerMuted;

				// When unmuted, explicitly call play() to satisfy autoplay restrictions.
				if (!speakerMuted) {
					void (audio as HTMLAudioElement).play().catch((err) => {
						console.warn("Audio playback blocked:", err);
					});
				}
			});
		};

		// Apply immediately
		applyMuteState();

		// Set up a MutationObserver to watch for new audio elements
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.addedNodes.length) {
					// Check if any of the added nodes are audio elements or contain audio elements
					mutation.addedNodes.forEach((node) => {
						if (node.nodeName === "AUDIO") {
							(node as HTMLAudioElement).muted = speakerMuted;
						} else if (node instanceof Element) {
							const audioNodes = node.querySelectorAll("audio");
							audioNodes.forEach((audio: HTMLAudioElement) => {
								audio.muted = speakerMuted;
							});
						}
					});
				}
			});
		});

		// Start observing the document
		observer.observe(document.body, { childList: true, subtree: true });

		// Clean up observer on unmount
		return () => {
			observer.disconnect();
		};
	}, [speakerMuted]);

	const toggleMicrophone = async () => {
		try {
			if (!microphone) {
				console.warn("Microphone state not ready yet");
				return;
			}

			// First check if we have browser permission
			if (micPermissionError) {
				console.error("Microphone access denied");
				return;
			}

			// Then check if we have Stream permission
			if (!hasAudioPermission) {
				if (call?.permissionsContext.canRequest(OwnCapability.SEND_AUDIO)) {
					await call.requestPermissions({
						permissions: [OwnCapability.SEND_AUDIO],
					});
				} else {
					toast.error("You do not have permission to speak in this room");
					return;
				}
			}

			if (isMute) {
				await microphone.enable();
			} else {
				await microphone.disable();
			}
		} catch (error) {
			console.error("Failed to toggle microphone:", error);
			setMicPermissionError(true);
		}
	};

	// Function to toggle speaker (audio output)
	const toggleSpeaker = () => {
		try {
			const audioElements = document.querySelectorAll("audio");
			const nextMuted = !speakerMuted;

			audioElements.forEach((audio) => {
				audio.muted = nextMuted;

				// When unmuting, explicitly call play() to satisfy autoplay restrictions.
				if (!nextMuted) {
					void (audio as HTMLAudioElement).play().catch((err) => {
						console.warn("Audio playback blocked:", err);
					});
				}
			});

			setSpeakerMuted(nextMuted);
		} catch (error) {
			console.error("Failed to toggle speaker:", error);
		}
	};

	return (
		<div className="flex items-center gap-3">
			{/* Speaker (audio output) control */}
			<AudioControlButton
				icon={speakerMuted ? VolumeX : Volume2}
				label={speakerMuted ? "Unmute speaker" : "Mute speaker"}
				onClick={toggleSpeaker}
				variant="speaker"
				isMuted={speakerMuted}
			/>

			{/* Microphone control */}
			{micPermissionError ? (
				<AudioControlButton
					icon={AlertCircle}
					label="Mic Permission Denied"
					onClick={() => toast.error("Microphone permission denied")}
					variant="mic"
					disabled={true}
				/>
			) : (
				<AudioControlButton
					icon={isMute ? MicOff : Mic}
					label={isMute ? "Unmute to speak" : "Mute microphone"}
					onClick={() => void toggleMicrophone()}
					variant="mic"
					isMuted={isMute}
				/>
			)}
		</div>
	);
};
