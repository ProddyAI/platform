"use client";

import {
	Calendar,
	ChevronDown,
	ChevronRight,
	Hash,
	RefreshCw,
	Save,
	Trash2,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Doc } from "@/../convex/_generated/dataModel";
import { InviteModal } from "@/app/workspace/[workspaceId]/invitation";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useNewJoinCode } from "@/features/workspaces/api/use-new-join-code";
import { useRemoveWorkspace } from "@/features/workspaces/api/use-remove-workspace";
import { useUpdateWorkspace } from "@/features/workspaces/api/use-update-workspace";
import { ChannelsManagement } from "./channels-management";

interface WorkspaceManagementProps {
	workspace: Doc<"workspaces">;
	currentMember: Doc<"members">;
}

export const WorkspaceManagement = ({
	workspace,
	currentMember,
}: WorkspaceManagementProps) => {
	const router = useRouter();
	const [name, setName] = useState(workspace.name);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [_isGeneratingCode, setIsGeneratingCode] = useState(false);
	const [_showJoinCode, _setShowJoinCode] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [channelsExpanded, setChannelsExpanded] = useState(false);

	const updateWorkspace = useUpdateWorkspace();
	const removeWorkspace = useRemoveWorkspace();
	const newJoinCode = useNewJoinCode();

	// Fetch workspace data for overview
	const { data: members } = useGetMembers({ workspaceId: workspace._id });
	const { data: channels } = useGetChannels({ workspaceId: workspace._id });

	const isOwner = currentMember.role === "owner";

	const handleUpdateName = async () => {
		if (name.length < 3 || name.length > 20) {
			toast.error("Workspace name must be between 3 and 20 characters");
			return;
		}

		setIsUpdating(true);

		try {
			await updateWorkspace.mutate({
				id: workspace._id,
				name,
			});

			toast.success("Workspace name updated");
		} catch (_error) {
			toast.error("Failed to update workspace name");
		} finally {
			setIsUpdating(false);
		}
	};

	const _handleGenerateNewCode = async () => {
		setIsGeneratingCode(true);

		try {
			await newJoinCode.mutate({
				workspaceId: workspace._id,
			});

			toast.success("New join code generated");
		} catch (_error) {
			toast.error("Failed to generate new join code");
		} finally {
			setIsGeneratingCode(false);
		}
	};

	const _handleCopyJoinCode = () => {
		const joinLink = `${window.location.origin}/auth/join/${workspace._id}?code=${workspace.joinCode}`;
		navigator.clipboard.writeText(joinLink);
		toast.success("Join link copied to clipboard");
	};

	const handleDeleteWorkspace = async () => {
		setIsDeleting(true);

		try {
			await removeWorkspace.mutate({
				id: workspace._id,
			});

			toast.success("Workspace deleted");
			router.push("/workspace");
		} catch (_error) {
			toast.error("Failed to delete workspace");
			setIsDeleting(false);
		}
	};

	return (
		<>
			<InviteModal
				joinCode={workspace.joinCode}
				name={workspace.name}
				open={inviteOpen}
				setOpen={setInviteOpen}
			/>
			<div className="space-y-6">
				{/* Workspace Overview */}
				<div>
					<h3 className="text-lg font-medium">Workspace Overview</h3>
					<p className="text-sm text-muted-foreground">
						Quick overview of your workspace
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
								<Calendar className="h-4 w-4 mr-2" />
								Created
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-lg font-semibold">
								{new Date(workspace._creationTime).toLocaleDateString()}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								{Math.floor(
									(Date.now() - workspace._creationTime) / (1000 * 60 * 60 * 24)
								)}{" "}
								days ago
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
								<Users className="h-4 w-4 mr-2" />
								Members
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-lg font-semibold">
								{members?.length || 0}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Total workspace members
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
								<Hash className="h-4 w-4 mr-2" />
								Channels
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="text-lg font-semibold">
								{channels?.length || 0}
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								Active channels
							</p>
						</CardContent>
					</Card>
				</div>

				<Separator />

				{/* Workspace Settings */}
				<div>
					<h3 className="text-lg font-medium">Workspace Settings</h3>
					<p className="text-sm text-muted-foreground">
						Manage your workspace name and other settings
					</p>
				</div>

				<div className="flex justify-between items-start">
					{/* Left side - Edit name */}
					<div className="grid gap-2 w-1/2 pr-4">
						<Label htmlFor="name">Workspace Name</Label>
						<div className="flex items-center gap-2">
							<Input
								className="flex-1"
								id="name"
								onChange={(e) => setName(e.target.value)}
								value={name}
							/>
							<Button disabled={isUpdating} onClick={handleUpdateName}>
								{isUpdating ? (
									<>
										<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									<>
										<Save className="mr-2 h-4 w-4" />
										Save
									</>
								)}
							</Button>
						</div>
					</div>

					{/* Right side - Delete option */}
					{isOwner && (
						<div className="w-1/2 pl-4">
							<div className="grid gap-2">
								<Label className="text-destructive">Delete Workspace</Label>
								<div>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button className="w-full" variant="destructive">
												<Trash2 className="mr-2 h-4 w-4" />
												Delete Workspace
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Are you absolutely sure?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This action cannot be undone. This will permanently
													delete your workspace and remove all associated data
													including messages, channels, and member information.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Cancel</AlertDialogCancel>
												<AlertDialogAction
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													disabled={isDeleting}
													onClick={handleDeleteWorkspace}
												>
													{isDeleting ? "Deleting..." : "Delete"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</div>
						</div>
					)}
				</div>

				<Separator />

				{/* Channels Management Section */}
				{isOwner && (
					<Collapsible
						onOpenChange={setChannelsExpanded}
						open={channelsExpanded}
					>
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-lg font-medium">Channel Management</h3>
								<p className="text-sm text-muted-foreground">
									Create, edit, and manage workspace channels
								</p>
							</div>
							<CollapsibleTrigger asChild>
								<Button size="sm" variant="ghost">
									{channelsExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
									<span className="ml-2">
										{channelsExpanded ? "Hide" : "Show"}
									</span>
								</Button>
							</CollapsibleTrigger>
						</div>
						<CollapsibleContent className="mt-4">
							<ChannelsManagement
								currentMember={currentMember}
								workspaceId={workspace._id}
							/>
						</CollapsibleContent>
					</Collapsible>
				)}
			</div>
		</>
	);
};
