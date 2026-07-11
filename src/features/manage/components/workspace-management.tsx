"use client";

import { ChevronDown, ChevronRight, Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { useRemoveWorkspace } from "@/features/workspaces/api/use-remove-workspace";
import { useUpdateWorkspace } from "@/features/workspaces/api/use-update-workspace";
import { cn } from "@/lib/utils";
import { ChannelsManagement } from "./channels-management";

interface WorkspaceManagementProps {
	workspace: Doc<"workspaces">;
	currentMember: Doc<"members">;
}

interface DeleteWorkspaceSectionProps {
	isOwner: boolean;
	workspaceId: Id<"workspaces">;
}

const DeleteWorkspaceSection = ({
	isOwner,
	workspaceId,
}: DeleteWorkspaceSectionProps) => {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const removeWorkspace = useRemoveWorkspace();

	if (!isOwner) return null;

	const isConfirmed = confirmText.trim().toLowerCase() === "delete workspace";

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) setConfirmText("");
	};

	const handleDeleteWorkspace = async () => {
		if (!isConfirmed) return;

		setIsDeleting(true);

		try {
			await removeWorkspace.mutate({
				id: workspaceId,
			});

			toast.success("Workspace deleted");
			router.push("/workspace");
		} catch (_error) {
			toast.error("Failed to delete workspace");
			setIsDeleting(false);
		}
	};

	return (
		<div className="grid gap-2">
			<Label>Delete workspace</Label>
			<p className="text-xs text-muted-foreground mb-2">
				Permanently delete this workspace and all its data. This action is
				irreversible.
			</p>
			<AlertDialog onOpenChange={handleOpenChange} open={isOpen}>
				<AlertDialogTrigger asChild>
					<Button className="w-full" variant="destructive">
						<Trash2 className="mr-2 size-4" />
						Delete workspace
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete your
							workspace and remove all associated data including messages,
							channels, and member information.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="grid gap-2">
						<Label
							className="text-sm font-medium"
							htmlFor="confirm-delete-workspace"
						>
							Type{" "}
							<span className="font-semibold text-destructive">
								delete workspace
							</span>{" "}
							to confirm
						</Label>
						<Input
							autoComplete="off"
							disabled={isDeleting}
							id="confirm-delete-workspace"
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder="Type 'delete workspace' to confirm"
							value={confirmText}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isDeleting || !isConfirmed}
							onClick={handleDeleteWorkspace}
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export const WorkspaceManagement = ({
	workspace,
	currentMember,
}: WorkspaceManagementProps) => {
	const [name, setName] = useState(workspace.name);
	const [isUpdating, setIsUpdating] = useState(false);
	const [channelsExpanded, setChannelsExpanded] = useState(false);

	const updateWorkspace = useUpdateWorkspace();

	// Fetch workspace data for overview
	const { data: members } = useGetMembers({ workspaceId: workspace._id });
	const { data: channels } = useGetChannels({ workspaceId: workspace._id });

	const isOwner = currentMember.role === "owner";
	const isAdmin = currentMember.role === "admin";
	const canRename = isOwner || isAdmin;

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

	const isNameDirty = name !== workspace.name;
	const isNameValid = name.trim().length >= 3 && name.trim().length <= 20;

	return (
		<div className="space-y-6">
			{/* Workspace Overview */}
			<div>
				<h3 className="text-lg font-semibold tracking-tight">
					Workspace overview
				</h3>
				<p className="text-sm text-muted-foreground">
					Quick overview of your workspace
				</p>
			</div>

			<p className="text-sm text-muted-foreground">
				Created {new Date(workspace._creationTime).toLocaleDateString()} ·{" "}
				{members?.length || 0} {members?.length === 1 ? "member" : "members"} ·{" "}
				{channels?.length || 0}{" "}
				{channels?.length === 1 ? "channel" : "channels"}
			</p>

			<Separator />

			{/* Workspace Settings */}
			<div>
				<h3 className="text-lg font-semibold tracking-tight">
					Workspace settings
				</h3>
				<p className="text-sm text-muted-foreground">
					Manage your workspace name and other settings
				</p>
			</div>

			<div
				className={cn(
					"grid grid-cols-1 gap-8 items-start",
					isOwner && "md:grid-cols-2"
				)}
			>
				<div className="grid gap-2">
					<Label htmlFor="name">Workspace name</Label>
					<div className="flex items-center gap-2">
						<Input
							className="flex-1"
							disabled={!canRename}
							id="name"
							maxLength={20}
							onChange={(e) => setName(e.target.value)}
							value={name}
						/>
						{canRename && (
							<Button
								disabled={isUpdating || !isNameDirty || !isNameValid}
								onClick={handleUpdateName}
							>
								{isUpdating ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										Saving…
									</>
								) : (
									<>
										<Save className="mr-2 size-4" />
										Save
									</>
								)}
							</Button>
						)}
					</div>
					<p className="text-xs text-muted-foreground">3–20 characters</p>
				</div>

				<div className="grid gap-4">
					<DeleteWorkspaceSection
						isOwner={isOwner}
						workspaceId={workspace._id}
					/>
				</div>
			</div>

			<Separator />

			{/* Channels Management Section */}
			{(isOwner || isAdmin) && (
				<Collapsible onOpenChange={setChannelsExpanded} open={channelsExpanded}>
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-lg font-semibold tracking-tight">
								Channel management
							</h3>
							<p className="text-sm text-muted-foreground">
								Create, edit, and manage workspace channels
							</p>
						</div>
						<CollapsibleTrigger asChild>
							<Button size="sm" variant="ghost">
								{channelsExpanded ? (
									<ChevronDown className="size-4" />
								) : (
									<ChevronRight className="size-4" />
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
	);
};
