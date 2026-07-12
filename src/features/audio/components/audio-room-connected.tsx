import {
	type Call,
	ParticipantsAudio,
	SfuModels,
	StreamCall,
	StreamVideo,
	type StreamVideoClient,
	type StreamVideoParticipant,
	useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { FileText, PhoneOff } from "lucide-react";
import { useState } from "react";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { AudioControlButton } from "./audio-control-button";
import { AudioToolbarButton } from "./audio-toolbar-button";
import { MeetingNotesPanel } from "./meeting-notes-panel";

interface AudioRoomConnectedProps {
	client: StreamVideoClient;
	call: Call;
	roomId: string;
	workspaceId: string;
	channelId: string;
	isFullScreen?: boolean;
	onLeaveAudio?: () => void;
	initialShowNotes?: boolean;
}

export const AudioRoomConnected = ({
	client,
	call,
	roomId,
	workspaceId,
	channelId,
	isFullScreen,
	onLeaveAudio,
	initialShowNotes,
}: AudioRoomConnectedProps) => {
	return (
		<StreamVideo client={client}>
			<StreamCall call={call}>
				<AudioRoomUI
					channelId={channelId}
					initialShowNotes={initialShowNotes}
					isFullScreen={isFullScreen}
					onLeaveAudio={onLeaveAudio}
					roomId={roomId}
					workspaceId={workspaceId}
				/>
			</StreamCall>
		</StreamVideo>
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
