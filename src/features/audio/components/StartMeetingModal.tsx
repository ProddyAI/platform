import { useMutation, useQuery } from "convex/react";
import { CalendarIcon, Search, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface StartMeetingModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	conversationId?: Id<"conversations">;
}

export const StartMeetingModal = ({
	open,
	onOpenChange,
	conversationId,
}: StartMeetingModalProps) => {
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const _router = useRouter();

	const [meetingType, setMeetingType] = useState<"instant" | "schedule">(
		"instant"
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedMembers, setSelectedMembers] = useState<Set<Id<"users">>>(
		new Set()
	);
	const [date, setDate] = useState("");
	const [time, setTime] = useState("");

	const members = useQuery(api.members.get, { workspaceId });
	const createMessage = useMutation(api.messages.create);
	// In a real app we might have api.meetings.schedule, but for now we'll just send a message.

	const filteredMembers =
		members?.filter((member) =>
			member.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
		) || [];

	const handleToggleMember = (userId: Id<"users">) => {
		const newSelected = new Set(selectedMembers);
		if (newSelected.has(userId)) {
			newSelected.delete(userId);
		} else {
			newSelected.add(userId);
		}
		setSelectedMembers(newSelected);
	};

	const handleSelectAll = () => {
		if (selectedMembers.size === filteredMembers.length) {
			setSelectedMembers(new Set());
		} else {
			const allUserIds = new Set(filteredMembers.map((m) => m.user._id));
			setSelectedMembers(allUserIds);
		}
	};

	const handleStartMeeting = async () => {
		const meetingId = crypto.randomUUID();
		const meetUrl = `/meet/${meetingId}?workspaceId=${workspaceId}${channelId ? `&channelId=${channelId}` : ""}`;

		try {
			if (selectedMembers.size > 0 || channelId) {
				// Send unified message payload to chat (fire and forget to not block navigation)
				createMessage({
					workspaceId,
					channelId,
					conversationId,
					body: JSON.stringify({
						type: "meeting",
						meetingId,
						meetingType,
						meetingDate: date,
						meetingTime: time,
						startedAt: Date.now(),
						participants: Array.from(selectedMembers),
					}),
				}).catch(console.error);
			}

			if (meetingType === "instant") {
				window.open(meetUrl, "_blank");
				onOpenChange(false);
			} else {
				toast.success("Meeting scheduled successfully!");
				onOpenChange(false);
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to start meeting");
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[450px]">
				<DialogHeader>
					<DialogTitle>Start a Meeting</DialogTitle>
				</DialogHeader>

				<div className="flex gap-4 mb-4">
					<Button
						className="flex-1 gap-2"
						onClick={() => setMeetingType("instant")}
						variant={meetingType === "instant" ? "default" : "outline"}
					>
						<Video className="w-4 h-4" /> Instant
					</Button>
					<Button
						className="flex-1 gap-2"
						onClick={() => setMeetingType("schedule")}
						variant={meetingType === "schedule" ? "default" : "outline"}
					>
						<CalendarIcon className="w-4 h-4" /> Schedule
					</Button>
				</div>

				{meetingType === "schedule" && (
					<div className="flex gap-2 mb-4">
						<Input
							className="flex-1"
							onChange={(e) => setDate(e.target.value)}
							type="date"
							value={date}
						/>
						<Input
							className="flex-1"
							onChange={(e) => setTime(e.target.value)}
							type="time"
							value={time}
						/>
					</div>
				)}

				<div className="space-y-4">
					<h3 className="text-sm font-medium">Invite Participants</h3>
					<div className="relative">
						<Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search members..."
							value={searchQuery}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Checkbox
							checked={
								selectedMembers.size > 0 &&
								selectedMembers.size === filteredMembers.length
							}
							id="select-all"
							onCheckedChange={handleSelectAll}
						/>
						<label className="text-sm font-medium" htmlFor="select-all">
							Select All
						</label>
					</div>

					<ScrollArea className="h-[200px] border rounded-md p-2">
						{filteredMembers.map((member) => (
							<div
								className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md"
								key={member._id}
							>
								<Checkbox
									checked={selectedMembers.has(member.user._id)}
									id={`member-${member._id}`}
									onCheckedChange={() => handleToggleMember(member.user._id)}
								/>
								<label
									className="text-sm cursor-pointer flex-1"
									htmlFor={`member-${member._id}`}
								>
									{member.user.name}
								</label>
							</div>
						))}
					</ScrollArea>
				</div>

				<DialogFooter className="mt-6">
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button onClick={handleStartMeeting}>
						{meetingType === "instant" ? "Start Meeting" : "Schedule Meeting"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
