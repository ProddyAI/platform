"use client";

import { User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useGetMembers } from "@/features/members/api/use-get-members";
import type { UserStatus } from "@/features/presence/components/presence-indicator";
import { PresenceIndicator } from "@/features/presence/components/presence-indicator";
import { useMultipleUserStatuses } from "@/features/presence/hooks/use-user-status";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface MentionPickerProps {
	open: boolean;
	onClose: () => void;
	onSelect: (memberId: Id<"members">, memberName: string) => void;
	searchQuery: string;
}

interface MemberWithPresence {
	_id: Id<"members">;
	user: {
		name: string;
		image?: string;
	};
	status: UserStatus;
}

export const MentionPicker = ({
	open,
	onClose,
	onSelect,
	searchQuery,
}: MentionPickerProps) => {
	const workspaceId = useWorkspaceId();
	const { data: members, isLoading } = useGetMembers({
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const [searchTerm, setSearchTerm] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Get presence information for all users
	const userIds = members?.map((m) => m.userId) || [];
	const { getUserStatus } = useMultipleUserStatuses(
		userIds,
		workspaceId as Id<"workspaces">
	);

	// Initialize search term from the searchQuery prop
	useEffect(() => {
		if (open) {
			setSearchTerm(searchQuery || "");
		}
	}, [open, searchQuery]);

	// Focus the search input when the picker opens
	useEffect(() => {
		if (!open) {
			return;
		}
		const timeoutId = setTimeout(() => {
			searchInputRef.current?.focus();
		}, 100);
		return () => clearTimeout(timeoutId);
	}, [open]);

	// Members with presence information, filtered by cmdk as the user types
	const membersWithPresence: MemberWithPresence[] = useMemo(
		() =>
			(members || []).map((member) => ({
				_id: member._id,
				user: {
					name: member.user.name || "", // Add fallback to empty string
					image: member.user.image,
				},
				status: getUserStatus(member.userId), // Use status data
			})),
		[members, getUserStatus]
	);

	const handleSelect = (memberId: Id<"members">, memberName: string) => {
		onSelect(memberId, memberName);
		onClose();
	};

	// Don't render anything if not open
	if (!open) {
		return null;
	}

	return (
		<div
			className="fixed bottom-[120px] left-0 right-0 z-50 mx-auto w-[90%] max-w-[500px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				// Let cmdk handle Arrow/Enter navigation; only intercept Escape to close.
				if (e.key === "Escape") {
					e.stopPropagation();
					onClose();
				}
			}}
		>
			<Command label="Mention a user">
				{/* Header */}
				<div className="flex items-center gap-2 border-b px-3 py-2">
					<User className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="text-sm font-medium">Mention a user</span>
				</div>

				<CommandInput
					onValueChange={setSearchTerm}
					placeholder="Search users..."
					ref={searchInputRef}
					value={searchTerm}
				/>

				<CommandList className="max-h-[200px]">
					<CommandEmpty>
						{isLoading ? "Loading users..." : "No users found"}
					</CommandEmpty>
					{membersWithPresence.length > 0 && (
						<CommandGroup>
							{membersWithPresence.map((member) => (
								<CommandItem
									className="gap-2"
									key={member._id}
									onSelect={() => handleSelect(member._id, member.user.name)}
									value={`${member.user.name} ${member._id}`}
								>
									<div className="relative">
										<Avatar className="h-8 w-8">
											<AvatarImage
												alt={member.user.name}
												src={member.user.image}
											/>
											<AvatarFallback>
												{member.user.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<PresenceIndicator status={member.status} />
									</div>
									<span className="text-sm">{member.user.name}</span>
								</CommandItem>
							))}
						</CommandGroup>
					)}
				</CommandList>
			</Command>
		</div>
	);
};
