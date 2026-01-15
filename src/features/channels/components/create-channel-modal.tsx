"use client";

import { Smile, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";

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
import { Label } from "@/components/ui/label";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { useCreateChannel } from "../api/use-create-channel";
import { useCreateChannelModal } from "../store/use-create-channel-modal";

export const CreateChannelModal = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const [open, setOpen] = useCreateChannelModal();
	const [name, setName] = useState("");
	const [icon, setIcon] = useState<string | undefined>(undefined);
	const [iconImage, setIconImage] = useState<Id<"_storage"> | undefined>(
		undefined
	);
	const [iconPreview, setIconPreview] = useState<string | undefined>(undefined);
	const [isUploading, setIsUploading] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);

	const { mutate, isPending } = useCreateChannel();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();

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
					<div className="space-y-4 py-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">Channel Icon</Label>
								<span className="text-xs text-muted-foreground">
									Select emoji or upload image
								</span>
							</div>
							<div className="flex items-center gap-3">
								<div className="flex-shrink-0 relative">
									<input
										ref={imageInputRef}
										type="file"
										accept="image/*"
										onChange={handleIconImageUpload}
										className="hidden"
										id="icon-upload"
										aria-label="Upload channel icon image"
									/>
									<button
										type="button"
										onClick={() =>
											!isUploading && imageInputRef.current?.click()
										}
										disabled={isUploading}
										className="relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all disabled:cursor-not-allowed disabled:opacity-50"
										aria-label="Upload channel icon"
									>
										{iconPreview || icon ? (
											<>
												{iconPreview ? (
													<img
														src={iconPreview}
														alt="Channel icon preview"
														className="h-full w-full object-cover rounded-sm"
													/>
												) : (
													<span
														className="text-4xl"
														role="img"
														aria-label="Channel emoji icon"
													>
														{icon}
													</span>
												)}
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														if (iconPreview || iconImage) {
															clearIconImage();
														}
														if (icon) {
															setIcon(undefined);
														}
													}}
													className="absolute -top-2 -right-2 h-6 w-6 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
													aria-label="Remove icon"
												>
													<X className="h-3.5 w-3.5" />
												</button>
											</>
										) : (
											<div className="flex flex-col items-center gap-1">
												<Upload className="h-6 w-6 text-gray-400" />
												<span className="text-xs text-gray-500 text-center">
													{isUploading ? "Uploading..." : "Upload"}
												</span>
											</div>
										)}
									</button>
									<EmojiPopover
										onEmojiSelect={handleEmojiSelect}
										hint="Select emoji icon"
									>
										<button
											type="button"
											className="absolute -bottom-1 -right-1 h-7 w-7 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
											aria-label="Select emoji icon"
										>
											<Smile className="h-4 w-4" />
										</button>
									</EmojiPopover>
								</div>
								<div className="flex-1">
									<Label
										htmlFor="name"
										className="text-sm font-medium mb-1 block"
									>
										Channel Name
									</Label>
									<Input
										id="name"
										value={name}
										onChange={handleChange}
										disabled={isPending}
										required
										autoFocus
										minLength={3}
										maxLength={20}
										placeholder="e.g. plan-budget"
										className="h-10"
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Max 5MB for images
									</p>
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
