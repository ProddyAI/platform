"use client";

import { Smile, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { LimitIndicator } from "@/components/limit-indicator";
import { EmojiPopover } from "@/components/pickers/emoji-popover";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGenerateUploadUrl } from "@/hooks/use-generate-upload-url";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useWorkspaceLimit } from "@/hooks/use-workspace-limit";

import { useCreateChannel } from "../api/use-create-channel";
import { useCreateChannelModal } from "../store/use-create-channel-modal";

export const CreateChannelModal = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const [open, setOpen] = useCreateChannelModal();
	const [name, setName] = useState("");
	const [icon, setIcon] = useState<string | undefined>();
	const [iconImage, setIconImage] = useState<Id<"_storage"> | undefined>();
	const [iconPreview, setIconPreview] = useState<string | undefined>();
	const [isUploading, setIsUploading] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);

	const { mutate, isPending } = useCreateChannel();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();
	const { maxReached } = useWorkspaceLimit("channel");

	// Cleanup blob URL on unmount to prevent memory leaks
	useEffect(() => {
		return () => {
			if (iconPreview) {
				URL.revokeObjectURL(iconPreview);
			}
		};
	}, [iconPreview]);

	const handleClose = () => {
		setName("");
		setIcon(undefined);
		setIconImage(undefined);
		// Properly revoke the blob URL before clearing
		setIconPreview((previousPreview) => {
			if (previousPreview) {
				URL.revokeObjectURL(previousPreview);
			}
			return undefined;
		});
		setOpen(false);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		// While a create is in flight the dialog is held open (see `open={open ||
		// isPending}` below), so ignore close attempts instead of wiping the form.
		if (isPending) return;
		if (!nextOpen) {
			handleClose();
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/\s+/g, "-").toLowerCase();
		setName(value);
	};

	const handleEmojiSelect = (emoji: string) => {
		setIcon(emoji);
		// Clear image if emoji is selected and revoke blob URL
		setIconImage(undefined);
		setIconPreview((previousPreview) => {
			if (previousPreview) {
				URL.revokeObjectURL(previousPreview);
			}
			return undefined;
		});
	};

	const handleIconImageUpload = async (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		// Validate file type
		if (!file.type.startsWith("image/")) {
			toast.error("Please upload an image file");
			return;
		}

		setIsUploading(true);
		try {
			// Generate upload URL
			const url = await generateUploadUrl({}, { throwError: true });

			if (!url) {
				throw new Error("Failed to generate upload URL");
			}

			// Upload the file
			const result = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!result.ok) {
				throw new Error("Failed to upload image");
			}

			const { storageId } = (await result.json()) as {
				storageId: Id<"_storage">;
			};

			// Revoke previous preview URL before creating new one
			setIconPreview((previousPreview) => {
				if (previousPreview) {
					URL.revokeObjectURL(previousPreview);
				}
				return URL.createObjectURL(file);
			});
			setIconImage(storageId);
			// Clear emoji if image is selected
			setIcon(undefined);

			toast.success("Image uploaded successfully");
		} catch (error) {
			console.error("Failed to upload icon image:", error);
			if (error instanceof Error) {
				toast.error(`Upload failed: ${error.message}`);
			} else {
				toast.error("Failed to upload image");
			}
		} finally {
			setIsUploading(false);
		}
	};

	const clearIconImage = () => {
		setIconImage(undefined);
		setIconPreview((previousPreview) => {
			if (previousPreview) {
				URL.revokeObjectURL(previousPreview);
			}
			return undefined;
		});
		if (imageInputRef.current) {
			imageInputRef.current.value = "";
		}
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!workspaceId) {
			toast.error("Workspace ID is required");
			return;
		}

		mutate(
			{
				name,
				workspaceId,
				icon,
				iconImage,
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
		<Dialog onOpenChange={handleOpenChange} open={open || isPending}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a channel</DialogTitle>
					<DialogDescription>
						Channels are where your team communicates. They&apos;re best when
						organized around a topic. Choose an emoji icon to make your channel
						easily recognizable.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					{maxReached && (
						<div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
							<span>
								You have reached the channel limit for your plan. Upgrade to
								create channels.
							</span>
							<LimitIndicator featureLabel="Channels" />
						</div>
					)}
					<div className="space-y-4 py-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">Channel Icon</Label>
								<span className="text-xs text-muted-foreground">
									Select emoji or upload image
								</span>
							</div>
							<div className="flex items-start gap-3">
								<div className="flex flex-col items-center gap-1.5">
									<div className="flex-shrink-0 relative">
										<input
											accept="image/*"
											aria-label="Upload channel icon image"
											className="hidden"
											id="icon-upload"
											onChange={handleIconImageUpload}
											ref={imageInputRef}
											type="file"
										/>
										<button
											aria-label="Upload channel icon"
											className="relative flex size-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-muted hover:bg-accent hover:border-primary/50 transition-all disabled:cursor-not-allowed disabled:opacity-50"
											disabled={isUploading || maxReached}
											onClick={() =>
												!isUploading &&
												!maxReached &&
												imageInputRef.current?.click()
											}
											type="button"
										>
											{iconPreview || icon ? (
												<>
													{iconPreview ? (
														<Image
															alt="Channel icon preview"
															className="object-cover rounded-sm"
															fill
															sizes="80px"
															src={iconPreview}
														/>
													) : (
														<span
															aria-label="Channel emoji icon"
															className="text-4xl"
															role="img"
														>
															{icon}
														</span>
													)}
													<button
														aria-label="Remove icon"
														className="absolute -top-2 -right-2 size-6 rounded-full border-2 border-border bg-card text-foreground flex items-center justify-center hover:bg-accent shadow-md z-50"
														onClick={(e) => {
															e.stopPropagation();
															if (iconPreview || iconImage) {
																clearIconImage();
															}
															if (icon) {
																setIcon(undefined);
															}
														}}
														type="button"
													>
														<X className="size-3.5" />
													</button>
												</>
											) : (
												<div className="flex flex-col items-center gap-1">
													<Upload className="size-6 text-muted-foreground" />
													<span className="text-xs text-muted-foreground text-center">
														{isUploading ? "Uploading..." : "Upload"}
													</span>
												</div>
											)}
										</button>
										<EmojiPopover
											hint="Select emoji icon"
											onEmojiSelect={handleEmojiSelect}
										>
											<button
												aria-label="Select emoji icon"
												className="absolute -bottom-1 -right-1 size-7 rounded-full border-2 border-border bg-card text-foreground flex items-center justify-center hover:bg-accent shadow-md z-50 disabled:opacity-50 disabled:cursor-not-allowed"
												disabled={maxReached}
												type="button"
											>
												<Smile className="size-4" />
											</button>
										</EmojiPopover>
									</div>
									<p className="w-20 text-center text-xs text-muted-foreground">
										Max 5MB for images
									</p>
								</div>
								<div className="flex-1">
									<Label
										className="text-sm font-medium mb-1 block"
										htmlFor="name"
									>
										Channel Name
									</Label>
									<Input
										className="h-10"
										disabled={isPending || maxReached}
										id="name"
										maxLength={20}
										minLength={3}
										onChange={handleChange}
										placeholder="e.g. plan-budget"
										required
										value={name}
									/>
									<p className="text-xs text-muted-foreground mt-1">
										3-20 characters
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="flex justify-end">
						<Button
							disabled={isPending || maxReached || !name.trim()}
							loading={isPending}
						>
							Create
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};
