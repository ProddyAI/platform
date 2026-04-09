"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { useCreateProject } from "../api/use-create-project";
import { useCreateProjectModal } from "../store/use-create-project-modal";

export const CreateProjectModal = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();

	const [open, setOpen] = useCreateProjectModal();
	const [name, setName] = useState("");
	const [connectedChannelId, setConnectedChannelId] = useState<string>("none");

	const { data: channels } = useGetChannels({ workspaceId });
	const { isPending, mutate } = useCreateProject();

	const chatChannels = (channels || []).filter(
		(channel) => channel.type !== "board"
	);

	const handleClose = () => {
		setOpen(false);
		setName("");
		setConnectedChannelId("none");
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		mutate(
			{
				workspaceId,
				name,
				connectedChannelId:
					connectedChannelId !== "none"
						? (connectedChannelId as Id<"channels">)
						: undefined,
			},
			{
				onSuccess: (projectId) => {
					if (!projectId) {
						toast.error("Failed to create project.");
						return;
					}

					toast.success("Project created.");
					router.push(`/workspace/${workspaceId}/project/${projectId}/board`);
					handleClose();
				},
				onError: () => {
					toast.error("Failed to create project.");
				},
			}
		);
	};

	return (
		<Dialog onOpenChange={handleClose} open={open || isPending}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a project</DialogTitle>
					<DialogDescription>
						Projects own boards. You can optionally connect one chat channel for
						status-change updates.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<Input
						autoFocus
						disabled={isPending}
						maxLength={48}
						minLength={3}
						onChange={(e) => setName(e.target.value)}
						placeholder="Project name"
						required
						value={name}
					/>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Connected channel</p>
						<Select
							onValueChange={setConnectedChannelId}
							value={connectedChannelId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Not connected" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Not connected</SelectItem>
								{chatChannels.map((channel) => (
									<SelectItem key={channel._id} value={channel._id}>
										# {channel.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex justify-end">
						<Button disabled={isPending || name.trim().length < 3}>
							Create project
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};
