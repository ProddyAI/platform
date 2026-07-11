import { useMutation, useQuery } from "convex/react";
import { Hash, Loader, Search, User, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface NewMeetingModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// Start an instant meeting from anywhere in the workspace by picking the
// target first — a channel or an individual person — unlike StartMeetingModal,
// which assumes the channel/conversation from the current route.
export const NewMeetingModal = ({
	open,
	onOpenChange,
}: NewMeetingModalProps) => {
	const workspaceId = useWorkspaceId();

	const [target, setTarget] = useState<"channel" | "person">("channel");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedChannelId, setSelectedChannelId] =
		useState<Id<"channels"> | null>(null);
	const [selectedMemberId, setSelectedMemberId] =
		useState<Id<"members"> | null>(null);
	const [isStarting, setIsStarting] = useState(false);

	const channels = useQuery(api.messaging.channels.get, { workspaceId });
	const members = useQuery(api.workspace.members.get, { workspaceId });
	const { data: currentMember } = useCurrentMember({ workspaceId });

	const createMessage = useMutation(api.messaging.messages.create);
	const createOrGetConversation = useMutation(
		api.messaging.conversations.createOrGet
	);

	const query = searchQuery.toLowerCase();
	const filteredChannels =
		channels?.filter((channel) => channel.name.toLowerCase().includes(query)) ||
		[];
	const filteredMembers =
		members?.filter(
			(member) =>
				member._id !== currentMember?._id &&
				member.user?.name?.toLowerCase().includes(query)
		) || [];

	const canStart =
		target === "channel"
			? Boolean(selectedChannelId)
			: Boolean(selectedMemberId);

	const handleStartMeeting = async () => {
		const meetingId = crypto.randomUUID();

		try {
			setIsStarting(true);

			let meetUrl = `/meet/${meetingId}?workspaceId=${workspaceId}`;

			if (target === "channel" && selectedChannelId) {
				meetUrl += `&channelId=${selectedChannelId}`;
				await createMessage({
					workspaceId,
					channelId: selectedChannelId,
					body: JSON.stringify({
						type: "meeting",
						meetingId,
						meetingType: "instant",
						startedAt: Date.now(),
						participants: [],
					}),
				});
			} else if (target === "person" && selectedMemberId) {
				const conversationId = await createOrGetConversation({
					workspaceId,
					memberId: selectedMemberId,
				});
				meetUrl += `&conversationId=${conversationId}`;
				const otherUser = members?.find(
					(member) => member._id === selectedMemberId
				)?.user;
				await createMessage({
					workspaceId,
					conversationId,
					body: JSON.stringify({
						type: "meeting",
						meetingId,
						meetingType: "instant",
						startedAt: Date.now(),
						participants: otherUser ? [otherUser._id] : [],
					}),
				});
			}

			window.open(meetUrl, "_blank", "noopener,noreferrer");
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			toast.error("Failed to start meeting");
		} finally {
			setIsStarting(false);
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[450px]">
				<DialogHeader>
					<DialogTitle>Start a Meeting</DialogTitle>
				</DialogHeader>

				<Tabs
					onValueChange={(value) => {
						setTarget(value as "channel" | "person");
						setSearchQuery("");
					}}
					value={target}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger className="gap-1.5" value="channel">
							<Hash className="size-3.5" /> Channel
						</TabsTrigger>
						<TabsTrigger className="gap-1.5" value="person">
							<User className="size-3.5" /> Person
						</TabsTrigger>
					</TabsList>
				</Tabs>

				<div className="space-y-4">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={
								target === "channel"
									? "Search channels..."
									: "Search members..."
							}
							value={searchQuery}
						/>
					</div>

					<ScrollArea className="h-[200px] rounded-lg border p-2">
						{target === "channel" ? (
							channels === undefined ? (
								<div aria-busy="true" className="space-y-1">
									{[0, 1, 2, 3].map((i) => (
										<Skeleton className="h-9 w-full" key={i} />
									))}
								</div>
							) : filteredChannels.length === 0 ? (
								<div className="flex h-full items-center justify-center">
									<p className="text-sm text-muted-foreground">
										{searchQuery
											? "No channels match your search"
											: "No channels in this workspace yet"}
									</p>
								</div>
							) : (
								filteredChannels.map((channel) => (
									<button
										className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selectedChannelId === channel._id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
										key={channel._id}
										onClick={() => setSelectedChannelId(channel._id)}
										type="button"
									>
										<Hash className="size-4 shrink-0" />
										<span className="flex-1 truncate text-sm">
											{channel.name}
										</span>
									</button>
								))
							)
						) : members === undefined ? (
							<div aria-busy="true" className="space-y-1">
								{[0, 1, 2, 3].map((i) => (
									<Skeleton className="h-9 w-full" key={i} />
								))}
							</div>
						) : filteredMembers.length === 0 ? (
							<div className="flex h-full items-center justify-center">
								<p className="text-sm text-muted-foreground">
									{searchQuery
										? "No members match your search"
										: "No other members in this workspace yet"}
								</p>
							</div>
						) : (
							filteredMembers.map((member) => {
								if (!member.user) return null;
								return (
									<button
										className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selectedMemberId === member._id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
										key={member._id}
										onClick={() => setSelectedMemberId(member._id)}
										type="button"
									>
										<User className="size-4 shrink-0" />
										<span className="flex-1 truncate text-sm">
											{member.user.name}
										</span>
									</button>
								);
							})
						)}
					</ScrollArea>
				</div>

				<DialogFooter className="mt-2">
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						className="gap-1.5"
						disabled={!canStart || isStarting}
						onClick={handleStartMeeting}
					>
						{isStarting ? (
							<Loader className="size-4 animate-spin" />
						) : (
							<Video className="size-4" />
						)}
						{isStarting ? "Starting..." : "Start Meeting"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
