"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { useSetProjectConnectedChannel } from "../api/use-set-project-connected-channel";
import { useConnectProjectChannelModal } from "../store/use-connect-project-channel-modal";

export const ConnectProjectChannelModal = () => {
	const workspaceId = useWorkspaceId();
	const [state, setState] = useConnectProjectChannelModal();
	const [selectedChannelId, setSelectedChannelId] = useState("none");

	const { data: channels } = useGetChannels({ workspaceId });
	const { mutate, isPending } = useSetProjectConnectedChannel();

	const project = useQuery(
		api.projects.getById,
		state.projectId ? { id: state.projectId } : "skip"
	);

	const chatChannels = (channels || []).filter(
		(channel) => channel.type !== "board"
	);

	useEffect(() => {
		if (!project) return;
		setSelectedChannelId(project.connectedChannelId || "none");
	}, [project]);

	const handleClose = () => {
		setState({
			open: false,
			projectId: null,
		});
		setSelectedChannelId("none");
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!state.projectId) return;

		mutate(
			{
				projectId: state.projectId,
				channelId:
					selectedChannelId === "none"
						? null
						: (selectedChannelId as Id<"channels">),
			},
			{
				onSuccess: () => {
					toast.success("Project channel updated.");
					handleClose();
				},
				onError: () => {
					toast.error("Failed to update project channel.");
				},
			}
		);
	};

	return (
		<Dialog onOpenChange={handleClose} open={state.open || isPending}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Connect project channel</DialogTitle>
					<DialogDescription>
						Choose where status-change updates should be posted.
					</DialogDescription>
				</DialogHeader>

				{project ? (
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="rounded-md border p-3 bg-muted/30">
							<p className="text-sm font-medium">{project.name}</p>
							<p className="text-xs text-muted-foreground mt-1">
								Board channel: {project.boardChannelName || "Unknown"}
							</p>
						</div>

						<Select
							onValueChange={setSelectedChannelId}
							value={selectedChannelId}
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

						<div className="flex justify-end gap-2">
							<Button
								disabled={isPending}
								onClick={handleClose}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={isPending} type="submit">
								Save connection
							</Button>
						</div>
					</form>
				) : (
					<div className="text-sm text-muted-foreground">
						Loading project...
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};
