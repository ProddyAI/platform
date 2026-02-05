"use client";

import { Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	const { data: members, isLoading } = useGetMembers({ workspaceId });
	const [filteredMembers, setFilteredMembers] = useState<MemberWithPresence[]>(
		[]
	);
	const [searchTerm, setSearchTerm] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Get presence information for all users
	const userIds = members?.map((m) => m.userId) || [];
	const { getUserStatus } = useMultipleUserStatuses(userIds, workspaceId);

	// Initialize search term from the searchQuery prop
	useEffect(() => {
		if (open) {
			setSearchTerm(searchQuery || "");
		}
	}, [open, searchQuery]);

	// Focus the search input when the picker opens
	useEffect(() => {
		if (open && searchInputRef.current) {
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 100);
		}
	}, [open]);

	// Process members and add status information
	useEffect(() => {
		if (!members) {
			return;
		}

		const processMembers = async () => {
			const membersWithPresence: MemberWithPresence[] = members.map(
				(member) => ({
					_id: member._id,
					user: {
						name: member.user.name || "", // Add fallback to empty string
						image: member.user.image,
					},
					status: getUserStatus(member.userId), // Use status data
				})
			);

			// Always show all members when first opened or when search is empty
			const filtered =
				searchTerm.trim() === ""
					? membersWithPresence
					: membersWithPresence.filter((member) =>
							member.user.name.toLowerCase().includes(searchTerm.toLowerCase())
						);

			setFilteredMembers(filtered);
		};

		processMembers();
	}, [members, searchTerm, getUserStatus]);

	const handleSelect = (memberId: Id<"members">, memberName: string) => {
		onSelect(memberId, memberName);
		onClose();
	};

	// Don't render anything if not open
	if (!open) {
		return null;
	}

	// Handle clicks inside the mention picker to prevent them from closing the picker
	const handleMentionPickerClick = (e: React.MouseEvent) => {
		e.stopPropagation();
	};

	return (
		<div
			className="fixed bottom-[120px] left-0 right-0 mx-auto w-[90%] max-w-[500px] bg-white border border-gray-200 rounded-md shadow-lg z-[9999] overflow-hidden"
			onClick={handleMentionPickerClick}
		>
			{/* Header */}
			<div className="border-b p-2 bg-gray-50">
				<div className="flex items-center">
					<User className="mr-2 h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">Mention a user</span>
				</div>
			</div>

			{/* User List - Appears ABOVE the search bar */}
			<div className="max-h-[200px] overflow-y-auto p-2">
				{isLoading ? (
					<div className="flex items-center justify-center p-4">
						<p className="text-sm text-muted-foreground">Loading users...</p>
					</div>
				) : filteredMembers.length === 0 ? (
					<div className="flex items-center justify-center p-4">
						<p className="text-sm text-muted-foreground">No users found</p>
					</div>
				) : (
					<div className="space-y-1">
						{filteredMembers.map((member) => (
							<Button
								className="w-full justify-start px-2 py-1.5 h-auto hover:bg-gray-100"
								key={member._id}
								onClick={() => handleSelect(member._id, member.user.name)}
								variant="ghost"
							>
								<div className="flex items-center gap-2">
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
								</div>
							</Button>
						))}
					</div>
				)}
			</div>

			{/* Search Bar - Appears BELOW the user list */}
			<div className="border-t p-2 bg-gray-50">
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						autoFocus
						className="pl-8"
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search users..."
						ref={searchInputRef}
						value={searchTerm}
					/>
				</div>
			</div>
		</div>
	);
};
