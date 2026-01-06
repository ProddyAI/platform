"use client";

import { Check, Search, Users, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Member {
	_id: Id<"members">;
	user: {
		name: string;
		image?: string;
	};
}

interface MemberSelectorProps {
	members: Member[];
	selectedMemberIds: Id<"members">[];
	onChange: (memberIds: Id<"members">[]) => void;
	placeholder?: string;
}

const MemberSelector: React.FC<MemberSelectorProps> = ({
	members,
	selectedMemberIds,
	onChange,
	placeholder = "Assign members",
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [open, setOpen] = useState(false);

	// Filter members based on search term
	const filteredMembers = members.filter((member) =>
		member.user.name.toLowerCase().includes(searchTerm.toLowerCase())
	);

	// Get selected members data
	const selectedMembers = members.filter((member) =>
		selectedMemberIds.includes(member._id)
	);

	// Toggle member selection
	const toggleMember = (memberId: Id<"members">) => {
		if (selectedMemberIds.includes(memberId)) {
			onChange(selectedMemberIds.filter((id) => id !== memberId));
		} else {
			onChange([...selectedMemberIds, memberId]);
		}
	};

	// Remove a selected member
	const removeMember = (e: React.MouseEvent, memberId: Id<"members">) => {
		e.stopPropagation();
		onChange(selectedMemberIds.filter((id) => id !== memberId));
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					{selectedMembers.length > 0 ? (
						<div className="flex flex-wrap gap-1 max-w-[90%] overflow-hidden">
							{selectedMembers.map((member) => (
								<Badge
									key={member._id}
									variant="secondary"
									className="flex items-center gap-1"
								>
									<Avatar className="h-4 w-4">
										<AvatarImage
											src={member.user.image}
											alt={member.user.name}
										/>
										<AvatarFallback className="text-[8px]">
											{member.user.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="text-xs truncate max-w-[100px]">
										{member.user.name}
									</span>
								</Badge>
							))}
						</div>
					) : (
						<span className="text-muted-foreground flex items-center gap-1">
							<Users className="h-4 w-4" />
							{placeholder}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[300px] p-0">
				<div className="flex flex-col">
					{/* Search input */}
					<div className="p-2 border-b">
						<div className="relative">
							<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search members..."
								className="pl-8"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
					</div>

					{/* Member list */}
					<ScrollArea className="h-[200px]">
						<div className="p-2">
							{filteredMembers.length === 0 ? (
								<div className="p-4 text-center text-sm text-muted-foreground">
									No members found
								</div>
							) : (
								filteredMembers.map((member) => (
									<div
										key={member._id}
										className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer"
										onClick={() => toggleMember(member._id)}
									>
										<div className="flex items-center gap-2">
											<Avatar className="h-6 w-6">
												<AvatarImage
													src={member.user.image}
													alt={member.user.name}
												/>
												<AvatarFallback>
													{member.user.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="text-sm">{member.user.name}</span>
										</div>
										{selectedMemberIds.includes(member._id) ? (
											<Check className="h-4 w-4 text-secondary" />
										) : null}
									</div>
								))
							)}
						</div>
					</ScrollArea>

					{/* Selected members */}
					{selectedMembers.length > 0 && (
						<div className="p-2 border-t">
							<div className="text-xs font-medium text-muted-foreground mb-2">
								Selected ({selectedMembers.length})
							</div>
							<div className="flex flex-wrap gap-1">
								{selectedMembers.map((member) => (
									<Badge
										key={member._id}
										variant="secondary"
										className="flex items-center gap-1"
									>
										<Avatar className="h-4 w-4">
											<AvatarImage
												src={member.user.image}
												alt={member.user.name}
											/>
											<AvatarFallback className="text-[8px]">
												{member.user.name.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="text-xs truncate max-w-[100px]">
											{member.user.name}
										</span>
										<X
											className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer"
											onClick={(e) => removeMember(e, member._id)}
										/>
									</Badge>
								))}
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default MemberSelector;
