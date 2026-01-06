import {
	OwnCapability,
	useCall,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { AlertCircle, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { AudioControlButton } from "./AudioControlButton";

type AudioToolbarButtonProps = {};

export const AudioToolbarButton = ({}: AudioToolbarButtonProps) => {
	const call = useCall();
	const { useMicrophoneState, useHasPermissions } = useCallStateHooks();
	const { microphone, isMute } = useMicrophoneState();
	const [micPermissionError, setMicPermissionError] = useState(false);
	const hasAudioPermission = useHasPermissions(OwnCapability.SEND_AUDIO);

	// Speaker state (audio output)
	const [speakerMuted, setSpeakerMuted] = useState(false);

	// Check browser microphone permissions on mount
	useEffect(() => {
		const checkMicrophonePermission = async () => {
			try {
				// Check if the browser has microphone permission
				const devices = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				// If we get here, permission is granted
				setMicPermissionError(false);
				// Release the media stream
				devices.getTracks().forEach((track) => track.stop());
			} catch (error) {
				console.error("Microphone permission error:", error);
				setMicPermissionError(true);
			}
		};

		checkMicrophonePermission();
	}, []);

	// Request audio permission if we don't have it
	useEffect(() => {
		if (call && !hasAudioPermission) {
			const requestAudioPermission = async () => {
				try {
					await call.requestPermissions({
						permissions: [OwnCapability.SEND_AUDIO],
					});
				} catch (error) {
					console.error("Failed to request audio permission:", error);
				}
			};

			requestAudioPermission();
		}
	}, [call, hasAudioPermission]);

	// Apply speaker mute state to any audio elements that get added to the DOM
	useEffect(() => {
		// Function to apply mute state to all audio elements
		const applyMuteState = () => {
			const audioElements = document.querySelectorAll("audio");
			audioElements.forEach((audio) => {
				audio.muted = speakerMuted;
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
			// First check if we have browser permission
			if (micPermissionError) {
				console.error("Microphone access denied");
				return;
			}

			// Then check if we have Stream permission
			if (!hasAudioPermission) {
				// Request permission first
				await call?.requestPermissions({
					permissions: [OwnCapability.SEND_AUDIO],
				});
			}

			// Toggle microphone
			if (isMute) {
				await microphone.enable();
				console.log("Microphone enabled");
			} else {
				await microphone.disable();
				console.log("Microphone disabled");
			}
		} catch (error) {
			console.error("Failed to toggle microphone:", error);
			setMicPermissionError(true);
		}
	};

	// Function to toggle speaker (audio output)
	const toggleSpeaker = () => {
		try {
			// Get all audio elements in the DOM that might be playing audio from the call
			const audioElements = document.querySelectorAll("audio");

			// Toggle mute state for all audio elements
			audioElements.forEach((audio) => {
				audio.muted = !speakerMuted;
			});

			// Update state
			setSpeakerMuted(!speakerMuted);
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
					onClick={() => {}}
					variant="mic"
					disabled={true}
				/>
			) : (
				<AudioControlButton
					icon={isMute ? MicOff : Mic}
					label={isMute ? "Unmute to speak" : "Mute microphone"}
					onClick={toggleMicrophone}
					variant="mic"
					isMuted={isMute}
				/>
			)}
		</div>
	);
};
