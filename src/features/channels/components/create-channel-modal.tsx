"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmojiPopover } from "@/components/emoji-popover";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { useCreateChannel } from "../api/use-create-channel";
import { useCreateChannelModal } from "../store/use-create-channel-modal";

export const CreateChannelModal = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const [open, setOpen] = useCreateChannelModal();
	const [name, setName] = useState("");
	const [icon, setIcon] = useState<string | undefined>(undefined);

	const { mutate, isPending } = useCreateChannel();

	const handleClose = () => {
		setName("");
		setIcon(undefined);
		setOpen(false);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/\s+/g, "-").toLowerCase();

		setName(value);
	};

	const handleEmojiSelect = (emoji: string) => {
		setIcon(emoji);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		mutate(
			{
				name,
				workspaceId,
				icon,
			},
			{
				onSuccess: (id) => {
					toast.success("Channel created.");

					router.push(`/workspace/${workspaceId}/channel/${id}/chats`);
					handleClose();
				},
				onError: () => {
					toast.error("Failed to create channel.");
				},
			}
		);
	};

	return (
		<Dialog open={open || isPending} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a channel</DialogTitle>
					<DialogDescription>
						Channels are where your team communicates. They&apos;re best when
						organized around a topic. Choose an emoji icon to make your channel
						easily recognizable.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<label className="text-sm font-medium">Channel Icon</label>
								<span className="text-xs text-muted-foreground">
									Click to select an emoji
								</span>
							</div>
							<div className="flex items-center gap-3">
								<div className="flex-shrink-0">
									<EmojiPopover
										onEmojiSelect={handleEmojiSelect}
										hint="Select channel icon"
									>
										<div className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-100 hover:bg-gray-200 hover:border-gray-400 transition-all">
											{icon ? (
												<span className="text-2xl">{icon}</span>
											) : (
												<div className="flex flex-col items-center">
													<span className="text-xs text-gray-600">Select</span>
													<span className="text-xs text-gray-600">Icon</span>
												</div>
											)}
										</div>
									</EmojiPopover>
								</div>
								<div className="flex-1">
									<label className="text-sm font-medium mb-1 block">
										Channel Name
									</label>
									<Input
										value={name}
										onChange={handleChange}
										disabled={isPending}
										required
										autoFocus
										minLength={3}
										maxLength={20}
										placeholder="e.g. plan-budget"
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="flex justify-end">
						<Button disabled={isPending}>Create</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};
