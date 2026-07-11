import {
	ParticipantsAudio,
	SfuModels,
	StreamCall,
	StreamVideo,
	type StreamVideoParticipant,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { useCallback, useEffect, useState } from "react";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { FileText, Loader2, Phone, PhoneOff } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAudioRoom } from ".."; // Import from index to get the new implementation
import { AudioControlButton } from "./audio-control-button";
import { AudioToolbarButton } from "./audio-toolbar-button";
import { MeetingNotesPanel } from "./meeting-notes-panel";

interface StreamAudioRoomProps {
	roomId: string;
	workspaceId: string;
	channelId: string;
	canvasName?: string;
	isFullScreen?: boolean;
	initialShowNotes?: boolean;
}

export const StreamAudioRoom = ({
	roomId,
	workspaceId,
	channelId,
	canvasName,
	isFullScreen,
	initialShowNotes,
}: StreamAudioRoomProps) => {
	const [showFallbackUI, setShowFallbackUI] = useState(false);
	const [shouldConnect, setShouldConnect] = useState(initialShowNotes || false);
	const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
	const [isLeavingConfirmed, setIsLeavingConfirmed] = useState(false);

	// Use our custom hook to manage the audio room
	const {
		client,
		call,
		currentUser,
		isConnecting,
		isConnected,
		error,
		connectToAudioRoom,
	} = useAudioRoom({
		roomId,
		workspaceId,
		channelId,
		canvasName,
		shouldConnect,
	});

	// Allow other parts of the UI (e.g. Excalidraw toolbar) to toggle audio.
	useEffect(() => {
		const handleToggle = () => {
			// If we haven't joined yet, join.
			if (!shouldConnect && !isConnected) {
				setShouldConnect(true);
				return;
			}

			// If we're in the middle of connecting, treat toggle as cancel.
			if (shouldConnect && !isConnected) {
				setShouldConnect(false);
				return;
			}

			// If connected, show the leave confirmation.
			if (isConnected) {
				setShowLeaveConfirmation(true);
			}
		};

		window.addEventListener(
			"proddy:audio-room-toggle",
			handleToggle as EventListener
		);
		return () => {
			window.removeEventListener(
				"proddy:audio-room-toggle",
				handleToggle as EventListener
			);
		};
	}, [shouldConnect, isConnected]);

	// Function to join audio room
	const handleJoinAudio = () => {
		setShouldConnect(true);
	};

	// Function to show leave confirmation
	const handleLeaveAudio = () => {
		setShowLeaveConfirmation(true);
	};

	// Function to actually leave audio room after confirmation
	const confirmLeaveAudio = useCallback(() => {
		if (isLeavingConfirmed) return;

		try {
			setIsLeavingConfirmed(true);

			// Set shouldConnect to false; the hook will handle disconnection.
			setShouldConnect(false);

			// Hide confirmation dialog
			setShowLeaveConfirmation(false);
		} catch (error) {
			console.error("Error leaving audio room:", error);
			// Still set shouldConnect to false even if there's an error
			setShouldConnect(false);
			setShowLeaveConfirmation(false);
		} finally {
			setIsLeavingConfirmed(false);
		}
	}, [isLeavingConfirmed]);

	// Function to cancel leave confirmation
	const cancelLeaveAudio = useCallback(() => {
		if (!isLeavingConfirmed) {
			setShowLeaveConfirmation(false);
		}
	}, [isLeavingConfirmed]);

	// Function to retry connecting to the audio room without reloading the page
	const handleRetry = () => {
		void connectToAudioRoom();
	};

	// Function to show fallback UI instead of retrying
	const handleShowFallback = () => {
		setShowFallbackUI(true);
	};

	if (isConnecting) {
		return (
			<div className="fixed bottom-4 right-4 z-50">
				<Button
					className="flex items-center gap-2"
					disabled
					size="sm"
					variant="outline"
				>
					<div className="animate-spin size-3 border-2 border-primary border-t-transparent rounded-full" />
					{canvasName
						? `Connecting to ${canvasName}...`
						: "Connecting to audio..."}
				</Button>
			</div>
		);
	}

	// If user chose to use fallback UI, show a simple button to enable audio
	if (showFallbackUI) {
		return (
			<div className="fixed bottom-4 right-4 z-50">
				<Button
					className="flex items-center gap-2"
					onClick={() => setShowFallbackUI(false)}
					size="sm"
					variant="outline"
				>
					Enable Audio
				</Button>
			</div>
		);
	}

	if (error) {
		// Check if this is a WebSocket connection issue
		const isWSError =
			typeof error === "string" && error.includes("WS connection");

		return (
			<div className="fixed bottom-4 right-4 z-50 bg-card p-3 rounded-2xl border border-border shadow-md max-w-xs">
				<h4 className="text-sm font-medium text-destructive mb-1">
					{isWSError ? "Network Connection Failed" : "Audio Connection Failed"}
				</h4>
				<p className="text-xs text-muted-foreground mb-2">{error}</p>

				{isWSError && (
					<p className="text-xs text-muted-foreground mb-2">
						This may be due to network issues or firewall settings. Try using a
						different network or check your firewall settings.
					</p>
				)}

				<div className="flex gap-2">
					<Button
						className="flex-1 flex items-center justify-center"
						onClick={handleRetry}
						size="sm"
						variant="outline"
					>
						Retry
					</Button>

					{isWSError && (
						<Button
							className="flex-1 flex items-center justify-center"
							onClick={handleShowFallback}
							size="sm"
							variant="outline"
						>
							Continue Without Audio
						</Button>
					)}
				</div>

				<div className="mt-2 text-xs text-muted-foreground">
					{isWSError
						? "Audio rooms require a stable network connection."
						: "Each canvas has its own audio room for collaboration."}
				</div>
			</div>
		);
	}

	// Show join button if not connected and not connecting
	if (!isConnected && !isConnecting && !shouldConnect) {
		return (
			<div
				className={`fixed ${isFullScreen ? "bottom-8 right-8" : "bottom-4 right-4"} z-50`}
			>
				<AudioControlButton
					className="bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
					icon={Phone}
					label="Join Audio Room"
					onClick={handleJoinAudio}
					variant="action"
				/>
			</div>
		);
	}

	// Show audio room UI when connected
	return (
		<>
			{client && call && currentUser && isConnected ? (
				<StreamVideo client={client}>
					<StreamCall call={call}>
						<AudioRoomUI
							channelId={channelId}
							initialShowNotes={initialShowNotes}
							isFullScreen={isFullScreen}
							onLeaveAudio={handleLeaveAudio}
							roomId={roomId}
							workspaceId={workspaceId}
						/>
					</StreamCall>
				</StreamVideo>
			) : (
				// Render an empty div when not ready
				<div className="hidden" />
			)}

			{/* Leave Confirmation Dialog */}
			<AlertDialog
				onOpenChange={(open) => {
					if (!open) cancelLeaveAudio();
				}}
				open={showLeaveConfirmation}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Leave audio room?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to leave the audio room? You can rejoin at
							any time.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isLeavingConfirmed}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2"
							disabled={isLeavingConfirmed}
							onClick={confirmLeaveAudio}
						>
							{isLeavingConfirmed && (
								<Loader2 className="size-4 animate-spin" />
							)}
							{isLeavingConfirmed ? "Leaving..." : "Leave"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

interface AudioRoomUIProps {
	roomId: string;
	workspaceId: string;
	channelId: string;
	isFullScreen?: boolean;
	onLeaveAudio?: () => void;
	initialShowNotes?: boolean;
}

const AudioRoomUI = ({
	roomId,
	workspaceId,
	channelId,
	isFullScreen,
	onLeaveAudio,
	initialShowNotes,
}: AudioRoomUIProps) => {
	const { useParticipants, useMicrophoneState } = useCallStateHooks();
	const participants = useParticipants();
	const { isMute } = useMicrophoneState();
	const [isLeaving, _setIsLeaving] = useState(false);
	const [showNotesPanel, setShowNotesPanel] = useState(
		initialShowNotes || false
	);

	const _hasAudio = (p: StreamVideoParticipant) =>
		p.publishedTracks.includes(SfuModels.TrackType.AUDIO);

	const handleLeaveWithConfirmation = () => {
		if (!onLeaveAudio || isLeaving) return;
		onLeaveAudio();
	};

	return (
		<div className="audio-room-ui">
			{/* Audio elements for all participants */}
			<ParticipantsAudio participants={participants} />

			{/* Audio controls container */}
			<div
				className={`fixed ${isFullScreen ? "bottom-8 right-8" : "bottom-4 right-4"} z-50 flex items-end gap-4`}
			>
				{showNotesPanel && (
					<div className="h-[500px] mb-4 shadow-xl rounded-xl overflow-hidden">
						<MeetingNotesPanel
							channelId={channelId}
							isAudioMuted={isMute}
							onClose={() => setShowNotesPanel(false)}
							roomId={roomId}
							workspaceId={workspaceId}
						/>
					</div>
				)}

				<div className="bg-card rounded-xl p-4 shadow-lg border border-border">
					{/* Main audio controls */}
					<div className="flex items-center justify-center mb-3 gap-3">
						<AudioToolbarButton />
						<AudioControlButton
							className={
								showNotesPanel
									? "bg-primary/10 text-primary border-primary/20"
									: ""
							}
							icon={FileText}
							label="Meeting Notes"
							onClick={() => setShowNotesPanel(!showNotesPanel)}
							variant="action"
						/>
					</div>

					{/* Leave audio button */}
					{onLeaveAudio && (
						<div className="flex justify-center">
							<AudioControlButton
								className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive text-xs px-3 py-1.5"
								icon={PhoneOff}
								label="Leave Audio"
								onClick={handleLeaveWithConfirmation}
								variant="action"
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
