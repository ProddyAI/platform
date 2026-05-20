"use client";

import {
	Crown,
	MessageSquare,
	RefreshCw,
	Shield,
	Trash2,
	UserCog,
	Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useRemoveMember } from "@/features/members/api/use-remove-member";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useNewJoinCode } from "@/features/workspaces/api/use-new-join-code";

interface MembersManagementProps {
	workspaceId: Id<"workspaces">;
	currentMember: Doc<"members">;
}

interface EmailInviteSectionProps {
	workspaceId: Id<"workspaces">;
	currentMember: Doc<"members">;
}

type InviteRole = "owner" | "admin" | "member";

const EmailInviteSection = ({
	workspaceId,
	currentMember,
}: EmailInviteSectionProps) => {
	const [email, setEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<InviteRole>("member");
	const [inviteComment, setInviteComment] = useState("");
	const [inviteLoading, setInviteLoading] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [inviteSuccess, setInviteSuccess] = useState(false);
	const [isGeneratingCode, setIsGeneratingCode] = useState(false);

	const newJoinCode = useNewJoinCode();

	const handleGenerateNewCode = async () => {
		setIsGeneratingCode(true);
		try {
			await newJoinCode.mutate({
				workspaceId,
			});
			toast.success("New join code generated");
		} catch (_error) {
			toast.error("Failed to generate new join code");
		} finally {
			setIsGeneratingCode(false);
		}
	};

	const sendInvite = async () => {
		setInviteError(null);
		setInviteSuccess(false);

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email || !emailRegex.test(email.trim())) {
			setInviteError("Enter a valid email address");
			return;
		}

		try {
			setInviteLoading(true);
			const res = await fetch("/api/account/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId,
					email,
					role: inviteRole,
					comment: inviteComment,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to send invite");
			}

			setInviteSuccess(true);
			setEmail("");
			setInviteRole("member");
			setInviteComment("");
			toast.success("Invite sent successfully");
		} catch (err: any) {
			setInviteError(err.message);
			toast.error(err.message || "Failed to send invite");
		} finally {
			setInviteLoading(false);
		}
	};

	return (
		<div className="p-4 bg-muted/30 dark:bg-muted/50 rounded-lg border border-border/50 dark:border-border">
			<div className="grid gap-4">
				<Label className="text-sm font-semibold" htmlFor="emailInvite">
					Invite by Email
				</Label>
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
					<Input
						className="flex-1"
						disabled={inviteLoading}
						id="emailInvite"
						onChange={(e) => {
							setEmail(e.target.value);
							setInviteSuccess(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								sendInvite();
							}
						}}
						placeholder="name@example.com"
						type="email"
						value={email}
					/>
					<Select
						disabled={inviteLoading}
						onValueChange={(value) => setInviteRole(value as InviteRole)}
						value={inviteRole}
					>
						<SelectTrigger aria-label="Invite role">
							<SelectValue placeholder="Role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="member">
								<div className="flex items-center gap-2">
									<Users className="h-4 w-4" />
									Member
								</div>
							</SelectItem>
							<SelectItem value="admin">
								<div className="flex items-center gap-2">
									<Crown className="h-4 w-4" />
									Admin
								</div>
							</SelectItem>
							{currentMember.role === "owner" && (
								<SelectItem value="owner">
									<div className="flex items-center gap-2">
										<Crown className="h-4 w-4" />
										Owner
									</div>
								</SelectItem>
							)}
						</SelectContent>
					</Select>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								disabled={isGeneratingCode}
								onClick={handleGenerateNewCode}
								size="icon"
								variant="outline"
							>
								{isGeneratingCode ? (
									<RefreshCw className="h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="h-4 w-4" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Refresh Code</p>
						</TooltipContent>
					</Tooltip>
					<Button
						className="min-w-[120px]"
						disabled={inviteLoading}
						onClick={sendInvite}
					>
						{inviteLoading ? "Sending..." : "Send Invite"}
					</Button>
				</div>
				<div className="grid gap-2">
					<Label
						className="flex items-center gap-2 text-sm font-medium"
						htmlFor="inviteComment"
					>
						<MessageSquare className="h-4 w-4" />
						Invitation Note
					</Label>
					<Textarea
						disabled={inviteLoading}
						id="inviteComment"
						onChange={(e) => {
							setInviteComment(e.target.value);
							setInviteSuccess(false);
						}}
						placeholder="Let them know why you're inviting them..."
						value={inviteComment}
					/>
				</div>
				{inviteError && (
					<p className="text-sm text-destructive">{inviteError}</p>
				)}
				{inviteSuccess && (
					<p className="text-sm text-green-600">Invite sent successfully</p>
				)}
				<p className="text-xs text-muted-foreground">
					Send an email invitation with a secure link to join the workspace
				</p>
			</div>
		</div>
	);
};

export const MembersManagement = ({
	workspaceId,
	currentMember,
}: MembersManagementProps) => {
	const { data: members, isLoading } = useGetMembers({ workspaceId });
	const { data: workspace } = useGetWorkspace({
		id: workspaceId,
	});
	const [selectedMemberId, setSelectedMemberId] =
		useState<Id<"members"> | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

	const updateMember = useUpdateMember();
	const removeMember = useRemoveMember();

	const isOwner = currentMember.role === "owner";
	const isAdmin = currentMember.role === "admin";

	// Count the number of owners in the workspace
	const ownerCount = members?.filter((m) => m.role === "owner").length || 0;
	const isOnlyOwner = isOwner && ownerCount === 1;

	const handleUpdateRole = async (
		memberId: Id<"members">,
		role: "owner" | "admin" | "member" | "viewer"
	) => {
		// Prevent the only owner from downgrading themselves
		if (memberId === currentMember._id && isOnlyOwner && role !== "owner") {
			toast.error("Cannot change role", {
				description:
					"You are the only owner. Assign another owner first before changing your role.",
			});
			return;
		}

		setIsUpdating(true);

		try {
			await updateMember.mutate({
				id: memberId,
				role,
			});

			toast.success(`User role updated to ${role}`);
		} catch (error: any) {
			toast.error(error.message || "Failed to update user role");
		} finally {
			setIsUpdating(false);
		}
	};

	const openRemoveDialog = (memberId: Id<"members">) => {
		setSelectedMemberId(memberId);
		setRemoveDialogOpen(true);
	};

	const handleRemoveMember = async () => {
		if (!selectedMemberId) return;

		setIsRemoving(true);

		try {
			await removeMember.mutate({
				id: selectedMemberId,
			});

			toast.success("Member removed from workspace");
			setRemoveDialogOpen(false);
		} catch (error: any) {
			toast.error(error.message || "Failed to remove member");
		} finally {
			setIsRemoving(false);
		}
	};

	const getRoleBadgeColor = (role: string) => {
		switch (role) {
			case "owner":
				return "bg-purple-100 text-purple-800 hover:bg-purple-200";
			case "admin":
				return "bg-blue-100 text-blue-800 hover:bg-blue-200";
			default:
				return "bg-gray-100 text-gray-800 hover:bg-gray-200";
		}
	};

	return (
		<TooltipProvider>
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<div>
						<h3 className="text-lg font-medium">Members</h3>
						<p className="text-sm text-muted-foreground">
							Manage the members in your workspace and their roles
						</p>
					</div>
				</div>

				{(isOwner || isAdmin) && workspace && (
					<EmailInviteSection
						currentMember={currentMember}
						workspaceId={workspaceId}
					/>
				)}

				<Separator />

				<div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
					<span className="text-sm font-medium text-muted-foreground">
						Workspace plan
					</span>
					<Badge variant="outline">
						{workspace?.plan ? workspace.plan.toUpperCase() : "FREE"}
					</Badge>
				</div>

				{isLoading ? (
					<div className="flex justify-center py-8">
						<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : !members || members.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Shield className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-medium">No members</h3>
						<p className="text-sm text-muted-foreground">
							Invite members to your workspace
						</p>
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Role</TableHead>
								<TableHead className="w-[200px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((member) => (
								<TableRow key={member._id}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar className="h-8 w-8">
												<AvatarImage
													alt={member.user.name}
													src={member.user.image}
												/>
												<AvatarFallback>
													{member.user.name?.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div>
												<p className="font-medium">{member.user.name}</p>
												<p className="text-xs text-muted-foreground">
													{member.user.email}
												</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge className={getRoleBadgeColor(member.role)}>
											{member.role}
										</Badge>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											{/* Role Management Dropdown */}
											{(isOwner ||
												(isAdmin &&
													(member.role === "member" ||
														member.role === "viewer"))) &&
												!(member._id === currentMember._id && isOnlyOwner) && (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																disabled={isUpdating}
																size="sm"
																variant="outline"
															>
																<UserCog className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															{isOwner && (
																<DropdownMenuItem
																	disabled={member.role === "owner"}
																	onClick={() =>
																		handleUpdateRole(member._id, "owner")
																	}
																>
																	Make Owner
																</DropdownMenuItem>
															)}
															{(isOwner || isAdmin) && (
																<DropdownMenuItem
																	disabled={member.role === "admin"}
																	onClick={() =>
																		handleUpdateRole(member._id, "admin")
																	}
																>
																	Make Admin
																</DropdownMenuItem>
															)}
															{(isOwner || isAdmin) && (
																<DropdownMenuItem
																	disabled={member.role === "member"}
																	onClick={() =>
																		handleUpdateRole(member._id, "member")
																	}
																>
																	Make Member
																</DropdownMenuItem>
															)}
															{(isOwner || isAdmin) && (
																<DropdownMenuItem
																	disabled={member.role === "viewer"}
																	onClick={() =>
																		handleUpdateRole(member._id, "viewer")
																	}
																>
																	Make Viewer
																</DropdownMenuItem>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												)}
											{/* Show a badge for the only owner instead of role change button */}
											{member._id === currentMember._id && isOnlyOwner && (
												<Badge
													className="text-xs text-muted-foreground"
													variant="outline"
												>
													Only Owner
												</Badge>
											)}

											{/* Remove Member Button */}
											{((isOwner && member.role !== "owner") ||
												(isAdmin &&
													(member.role === "member" ||
														member.role === "viewer"))) && (
												<Button
													className="text-destructive hover:bg-destructive/10"
													disabled={member._id === currentMember._id}
													onClick={() => openRemoveDialog(member._id)}
													size="sm"
													variant="outline"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}

				{/* Remove Member Dialog */}
				<AlertDialog onOpenChange={setRemoveDialogOpen} open={removeDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Are you sure?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone. This will remove the member from
								your workspace and delete all of their messages and reactions.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								disabled={isRemoving}
								onClick={handleRemoveMember}
							>
								{isRemoving ? "Removing..." : "Remove Member"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</TooltipProvider>
	);
};
