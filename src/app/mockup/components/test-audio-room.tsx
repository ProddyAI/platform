"use client";

import {
	Mic,
	MicOff,
	MoreHorizontal,
	Phone,
	PhoneOff,
	Settings,
	Users,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioParticipant {
	id: string;
	name: string;
	initials: string;
	isMuted: boolean;
	isSpeaking: boolean;
	isHost: boolean;
}

interface TestAudioRoomProps {
	isInCall?: boolean;
	onToggleCall?: () => void;
}

export const TestAudioRoom = ({
	isInCall = false,
	onToggleCall,
}: TestAudioRoomProps) => {
	const [isMuted, setIsMuted] = useState(false);
	const [isSpeakerOn, setIsSpeakerOn] = useState(true);
	const [inCall, setInCall] = useState(isInCall);

	// Mock participants data
	const participants: AudioParticipant[] = [
		{
			id: "1",
			name: "Alex Rodriguez",
			initials: "AR",
			isMuted: false,
			isSpeaking: true,
			isHost: true,
		},
		{
			id: "2",
			name: "Sarah Johnson",
			initials: "SJ",
			isMuted: true,
			isSpeaking: false,
			isHost: false,
		},
		{
			id: "3",
			name: "Maya Patel",
			initials: "MP",
			isMuted: false,
			isSpeaking: false,
			isHost: false,
		},
		{
			id: "4",
			name: "You",
			initials: "YU",
			isMuted: isMuted,
			isSpeaking: false,
			isHost: false,
		},
	];

	const handleToggleCall = () => {
		setInCall(!inCall);
		onToggleCall?.();
	};

	const handleToggleMute = () => {
		setIsMuted(!isMuted);
	};

	const handleToggleSpeaker = () => {
		setIsSpeakerOn(!isSpeakerOn);
	};

	if (!inCall) {
		return (
			<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
				<Button
					onClick={handleToggleCall}
					className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
				>
					<Phone className="h-5 w-5" />
					Join Audio Room
					<Badge variant="secondary" className="ml-2 bg-white/20 text-white">
						{participants.length - 1} active
					</Badge>
				</Button>
			</div>
		);
	}

	return (
		<div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-2xl z-50">
			<div className="max-w-7xl mx-auto flex items-center justify-between">
				{/* Left side - Participants */}
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<Users className="h-5 w-5 text-gray-400" />
						<span className="text-sm font-medium">Canvas Audio Room</span>
						<Badge variant="secondary" className="bg-gray-700 text-gray-200">
							{participants.length} participants
						</Badge>
					</div>

					{/* Participants avatars */}
					<div className="flex items-center gap-2">
						{participants.slice(0, 4).map((participant) => (
							<div key={participant.id} className="relative">
								<Avatar
									className={cn(
										"h-8 w-8 border-2",
										participant.isSpeaking
											? "border-green-400"
											: "border-gray-600"
									)}
								>
									<AvatarFallback
										className={cn(
											"text-xs font-medium",
											participant.isHost
												? "bg-blue-600 text-white"
												: "bg-gray-600 text-gray-200"
										)}
									>
										{participant.initials}
									</AvatarFallback>
								</Avatar>

								{/* Mute indicator */}
								{participant.isMuted && (
									<div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5">
										<MicOff className="h-2.5 w-2.5 text-white" />
									</div>
								)}

								{/* Speaking indicator */}
								{participant.isSpeaking && !participant.isMuted && (
									<div className="absolute -top-1 -right-1 bg-green-400 rounded-full w-3 h-3 animate-pulse" />
								)}
							</div>
						))}

						{participants.length > 4 && (
							<div className="h-8 w-8 bg-gray-700 rounded-full flex items-center justify-center border-2 border-gray-600">
								<span className="text-xs font-medium text-gray-300">
									+{participants.length - 4}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Center - Audio Controls */}
				<div className="flex items-center gap-3">
					{/* Mute/Unmute */}
					<Button
						onClick={handleToggleMute}
						variant="ghost"
						size="sm"
						className={cn(
							"h-10 w-10 rounded-full",
							isMuted
								? "bg-red-600 hover:bg-red-700 text-white"
								: "bg-gray-700 hover:bg-gray-600 text-gray-200"
						)}
					>
						{isMuted ? (
							<MicOff className="h-5 w-5" />
						) : (
							<Mic className="h-5 w-5" />
						)}
					</Button>

					{/* Speaker On/Off */}
					<Button
						onClick={handleToggleSpeaker}
						variant="ghost"
						size="sm"
						className={cn(
							"h-10 w-10 rounded-full",
							!isSpeakerOn
								? "bg-red-600 hover:bg-red-700 text-white"
								: "bg-gray-700 hover:bg-gray-600 text-gray-200"
						)}
					>
						{isSpeakerOn ? (
							<Volume2 className="h-5 w-5" />
						) : (
							<VolumeX className="h-5 w-5" />
						)}
					</Button>

					{/* Settings */}
					<Button
						variant="ghost"
						size="sm"
						className="h-10 w-10 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200"
					>
						<Settings className="h-5 w-5" />
					</Button>

					{/* More options */}
					<Button
						variant="ghost"
						size="sm"
						className="h-10 w-10 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200"
					>
						<MoreHorizontal className="h-5 w-5" />
					</Button>

					{/* Leave Call */}
					<Button
						onClick={handleToggleCall}
						variant="ghost"
						size="sm"
						className="h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 text-white ml-2"
					>
						<PhoneOff className="h-5 w-5" />
					</Button>
				</div>

				{/* Right side - Call info */}
				<div className="flex items-center gap-4">
					<div className="text-sm text-gray-400">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
							<span>Live Audio</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
