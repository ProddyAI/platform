"use client";

import { MicOff } from "lucide-react";
import { type StreamVideoParticipant, SfuModels } from "@stream-io/video-react-sdk";

type ParticipantSidebarProps = {
	input: string;
	messages: Array<{
		id: string;
		text: string;
		user: string;
	}>;
	onInputChange: (value: string) => void;
	onSend: () => void;
	participants: StreamVideoParticipant[];
	raisedHands: string[];
	tab: "chat" | "people";
	onTabChange: (tab: "chat" | "people") => void;
};

export function ParticipantSidebar({
	input,
	messages,
	onInputChange,
	onSend,
	participants,
	raisedHands,
	tab,
	onTabChange,
}: ParticipantSidebarProps) {
	return (
		<div className="flex h-full flex-col bg-background">
			<div className="flex border-b">
				<button
					className={`flex-1 py-3 text-sm transition ${
						tab === "chat"
							? "border-primary border-b-2 font-medium text-foreground"
							: "text-muted-foreground hover:bg-accent hover:text-foreground"
					}`}
					onClick={() => onTabChange("chat")}
					type="button"
				>
					Chat
				</button>
				<button
					className={`flex-1 py-3 text-sm transition ${
						tab === "people"
							? "border-primary border-b-2 font-medium text-foreground"
							: "text-muted-foreground hover:bg-accent hover:text-foreground"
					}`}
					onClick={() => onTabChange("people")}
					type="button"
				>
					People
				</button>
			</div>

			{tab === "chat" ? (
				<div className="flex h-full flex-col">
					<div className="border-b px-4 py-3 font-medium text-sm">Chat</div>
					<div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
						{messages.length ? (
							messages.map((message) => (
								<div className="flex flex-col" key={message.id}>
									<span className="text-muted-foreground text-xs">
										{message.user}
									</span>
									<div className="max-w-[80%] rounded-xl bg-muted px-3 py-2 text-sm">
										{message.text}
									</div>
								</div>
							))
						) : (
							<div className="px-1 py-3 text-muted-foreground text-sm">
								No messages yet.
							</div>
						)}
					</div>
					<div className="flex gap-2 border-t p-3">
						<input
							className="flex-1 rounded-md bg-muted px-3 py-2 outline-none transition focus:ring-2 focus:ring-primary/20"
							onChange={(event) => onInputChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									onSend();
								}
							}}
							placeholder="Message..."
							value={input}
						/>
						<button
							className="rounded-md bg-primary px-4 py-2 text-sm text-white transition hover:opacity-90"
							onClick={onSend}
							type="button"
						>
							Send
						</button>
					</div>
				</div>
			) : (
				<div className="flex h-full flex-col">
					<div className="border-b px-4 py-4">
						<p className="font-medium text-sm">Participants</p>
						<p className="text-muted-foreground text-xs">
							{participants.length} in call
						</p>
					</div>
					<div className="flex flex-col gap-2 p-3">
					{participants.map((participant) => {
						const isMicMuted =
							!participant.audioStream &&
							!participant.publishedTracks.includes(SfuModels.TrackType.AUDIO);
						const displayName =
							participant.name || participant.userId || "User";

						return (
							<div
								className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
								key={participant.sessionId}
							>
								<div className="flex min-w-0 items-center gap-2">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
										{displayName.charAt(0).toUpperCase() || "U"}
									</div>
									<span className="truncate text-sm">
										{displayName}
										{participant.isLocalParticipant ? " (You)" : ""}
									</span>
								</div>
								<div className="flex items-center gap-2">
									{raisedHands.includes(participant.userId) && (
										<span className="text-sm">{"\u270B"}</span>
									)}
									{isMicMuted && (
										<MicOff className="h-4 w-4 text-muted-foreground" />
									)}
									{participant.isSpeaking && (
										<span className="h-2 w-2 rounded-full bg-primary" />
									)}
								</div>
							</div>
						);
					})}
				</div>
				</div>
			)}
		</div>
	);
}
