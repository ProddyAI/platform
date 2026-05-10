import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useChannelId } from "@/hooks/use-channel-id";
import { useRouter } from "next/navigation";
import { Search, Users, CalendarIcon, Video } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Id } from "@/../convex/_generated/dataModel";

interface StartMeetingModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	conversationId?: Id<"conversations">;
}

export const StartMeetingModal = ({ open, onOpenChange, conversationId }: StartMeetingModalProps) => {
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const router = useRouter();
	
	const [meetingType, setMeetingType] = useState<"instant" | "schedule">("instant");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedMembers, setSelectedMembers] = useState<Set<Id<"users">>>(new Set());
	const [date, setDate] = useState("");
	const [time, setTime] = useState("");
	
	const members = useQuery(api.members.get, { workspaceId });
	const createMessage = useMutation(api.messages.create);
	// In a real app we might have api.meetings.schedule, but for now we'll just send a message.
	
	const filteredMembers = members?.filter(member => 
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
			const allUserIds = new Set(filteredMembers.map(m => m.user._id));
			setSelectedMembers(allUserIds);
		}
	};

	const handleStartMeeting = async () => {
		const meetingId = crypto.randomUUID();
		const meetUrl = `/meet/${meetingId}?workspaceId=${workspaceId}${channelId ? `&channelId=${channelId}` : ''}`;
		
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
						participants: Array.from(selectedMembers)
					})
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[450px]">
				<DialogHeader>
					<DialogTitle>Start a Meeting</DialogTitle>
				</DialogHeader>
				
				<div className="flex gap-4 mb-4">
					<Button 
						variant={meetingType === "instant" ? "default" : "outline"}
						className="flex-1 gap-2"
						onClick={() => setMeetingType("instant")}
					>
						<Video className="w-4 h-4" /> Instant
					</Button>
					<Button 
						variant={meetingType === "schedule" ? "default" : "outline"}
						className="flex-1 gap-2"
						onClick={() => setMeetingType("schedule")}
					>
						<CalendarIcon className="w-4 h-4" /> Schedule
					</Button>
				</div>

				{meetingType === "schedule" && (
					<div className="flex gap-2 mb-4">
						<Input 
							type="date" 
							value={date} 
							onChange={(e) => setDate(e.target.value)} 
							className="flex-1"
						/>
						<Input 
							type="time" 
							value={time} 
							onChange={(e) => setTime(e.target.value)} 
							className="flex-1"
						/>
					</div>
				)}

				<div className="space-y-4">
					<h3 className="text-sm font-medium">Invite Participants</h3>
					<div className="relative">
						<Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
						<Input 
							placeholder="Search members..." 
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
					
					<div className="flex items-center gap-2">
						<Checkbox 
							id="select-all" 
							checked={selectedMembers.size > 0 && selectedMembers.size === filteredMembers.length}
							onCheckedChange={handleSelectAll}
						/>
						<label htmlFor="select-all" className="text-sm font-medium">Select All</label>
					</div>

					<ScrollArea className="h-[200px] border rounded-md p-2">
						{filteredMembers.map((member) => (
							<div key={member._id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md">
								<Checkbox 
									id={`member-${member._id}`} 
									checked={selectedMembers.has(member.user._id)}
									onCheckedChange={() => handleToggleMember(member.user._id)}
								/>
								<label htmlFor={`member-${member._id}`} className="text-sm cursor-pointer flex-1">
									{member.user.name}
								</label>
							</div>
						))}
					</ScrollArea>
				</div>

				<DialogFooter className="mt-6">
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={handleStartMeeting}>
						{meetingType === "instant" ? "Start Meeting" : "Schedule Meeting"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
