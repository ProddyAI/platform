import {
	OwnCapability,
	useCall,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { AlertCircle, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { AudioControlButton } from "./audio-control-button";

// Inner component that uses Stream hooks - only rendered when call is available
const AudioControlsInner = () => {
	const call = useCall();
	const [micPermissionError, setMicPermissionError] = useState(false);
	const [isCheckingMicPermission, setIsCheckingMicPermission] = useState(false);
	const [speakerMuted, setSpeakerMuted] = useState(false);

	// These hooks are safe to call here because we know call exists
	const { useMicrophoneState, useHasPermissions } = useCallStateHooks();
	const microphoneState = useMicrophoneState();
	const hasAudioPermission = useHasPermissions(OwnCapability.SEND_AUDIO);

	const checkMicPermission = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			stream.getTracks().forEach((track) => track.stop());
			setMicPermissionError(false);
			return true;
		} catch (error) {
			console.error("Microphone permission denied:", error);
			setMicPermissionError(true);
			return false;
		}
	}, []);

	// Check for microphone permission on mount
	useEffect(() => {
		void checkMicPermission();
	}, [checkMicPermission]);

	// Apply speaker mute state to all audio elements, including ones added later
	useEffect(() => {
		const applyMuteState = () => {
			document.querySelectorAll("audio").forEach((audio) => {
				audio.muted = speakerMuted;
			});
		};

		applyMuteState();

		// Watch for audio elements added after the initial mute state was set,
		// so new participants/tracks respect the current speaker mute state.
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node.nodeName === "AUDIO") {
						(node as HTMLAudioElement).muted = speakerMuted;
					} else if (node instanceof Element) {
						node.querySelectorAll("audio").forEach((audio) => {
							audio.muted = speakerMuted;
						});
					}
				}
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		return () => observer.disconnect();
	}, [speakerMuted]);

	// Don't render if microphone state is not available yet
	if (!microphoneState?.microphone) {
		return null;
	}

	const { microphone, isMute } = microphoneState;

	const toggleSpeaker = () => {
		setSpeakerMuted((muted) => !muted);
	};

	const recheckMicPermission = async () => {
		setIsCheckingMicPermission(true);
		try {
			const granted = await checkMicPermission();
			if (!granted) {
				toast.error("Microphone permission is still blocked");
			}
		} finally {
			setIsCheckingMicPermission(false);
		}
	};

	const toggleMicrophone = async () => {
		try {
			// First check if we have browser permission
			if (micPermissionError) {
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
			} else {
				await microphone.disable();
			}
		} catch (error) {
			console.error("Failed to toggle microphone:", error);
			setMicPermissionError(true);
			toast.error("Failed to toggle microphone");
		}
	};

	return (
		<div className="flex items-center gap-3">
			{/* Speaker (audio output) control */}
			<AudioControlButton
				icon={speakerMuted ? VolumeX : Volume2}
				isMuted={speakerMuted}
				label={speakerMuted ? "Unmute speaker" : "Mute speaker"}
				onClick={toggleSpeaker}
				variant="speaker"
			/>

			{/* Microphone control */}
			{micPermissionError ? (
				<Popover>
					<PopoverTrigger
						aria-label="Microphone permission denied"
						className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground shadow-sm transition-all duration-200 hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						title="Microphone permission denied"
					>
						<AlertCircle className="h-5 w-5" />
					</PopoverTrigger>
					<PopoverContent className="text-sm">
						<p className="font-medium text-foreground">
							Microphone access is blocked
						</p>
						<p className="mt-1 text-muted-foreground">
							Allow microphone access for this site in your browser&apos;s
							settings, then recheck.
						</p>
						<Button
							className="mt-3 w-full"
							loading={isCheckingMicPermission}
							onClick={() => void recheckMicPermission()}
							size="sm"
							variant="secondary"
						>
							Recheck permission
						</Button>
					</PopoverContent>
				</Popover>
			) : (
				<AudioControlButton
					icon={isMute ? MicOff : Mic}
					isMuted={isMute}
					label={isMute ? "Unmute to speak" : "Mute microphone"}
					onClick={() => void toggleMicrophone()}
					variant="mic"
				/>
			)}
		</div>
	);
};

// Outer component that checks for call availability
export const NotesAudioControls = () => {
	const call = useCall();

	// Don't render if no call is available
	if (!call) {
		return null;
	}

	// Render the inner component that uses Stream hooks
	return <AudioControlsInner />;
};
