"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Loader, Smile, Trash, TriangleAlert, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { toast } from "sonner";

import { EmojiPopover } from "@/components/emoji-popover";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGetChannel } from "@/features/channels/api/use-get-channel";
import { useRemoveChannel } from "@/features/channels/api/use-remove-channel";
import { useUpdateChannel } from "@/features/channels/api/use-update-channel";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";
import { useChannelId } from "@/hooks/use-channel-id";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import type { Id } from "@/../convex/_generated/dataModel";
import { WorkspaceToolbar } from "../../toolbar";
import Topbar from "./topbar";

const ChannelLayout = ({ children }: PropsWithChildren) => {
	const router = useRouter();
	const channelId = useChannelId();
	const workspaceId = useWorkspaceId();
	const { data: channel, isLoading: channelLoading } = useGetChannel({
		id: channelId,
	});
	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});
	const [ConfirmDialog, confirm] = useConfirm(
		"Delete this channel?",
		"You are about to delete this channel and any of its associated messages. This action is irreversible."
	);

	const [value, setValue] = useState("");
	const [icon, setIcon] = useState<string | undefined>(undefined);
	const [iconImage, setIconImage] = useState<Id<"_storage"> | undefined>(
		undefined
	);
	const [iconPreview, setIconPreview] = useState<string | undefined>(undefined);
	const [editOpen, setEditOpen] = useState(false);
	const [iconEditOpen, setIconEditOpen] = useState(false);
	const [channelDialogOpen, setChannelDialogOpen] = useState(false);
	const [imageLoadError, setImageLoadError] = useState(false);
	const [isUploadingIcon, setIsUploadingIcon] = useState(false);
	const imageInputRef = useRef<HTMLInputElement>(null);

	const { mutate: updateChannel, isPending: isUpdatingChannel } =
		useUpdateChannel();
	const { mutate: removeChannel, isPending: isRemovingChannel } =
		useRemoveChannel();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();

	// Set the initial values when channel data is loaded
	useEffect(() => {
		if (channel) {
			setValue(channel.name);
			setIcon(channel.icon);
			setIconImage(channel.iconImage);
			if (channel.iconImageUrl) {
				setIconPreview(channel.iconImageUrl);
			}
		}
	}, [channel]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/\s+/g, "-").toLowerCase();
		setValue(value);
	};

	const handleEmojiSelect = (emoji: string) => {
		setIcon(emoji);
		setIconImage(undefined);
		setIconPreview(undefined);
	};

	const handleIconImageUpload = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type
		const allowedImageTypes = [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
		];
		if (!allowedImageTypes.includes(file.type)) {
			toast.error("Please upload a JPEG, PNG, GIF, or WebP image");
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		setIsUploadingIcon(true);

		try {
			const url = await generateUploadUrl({}, { throwError: true });

			if (typeof url !== "string" || url.trim().length === 0) {
				throw new Error("Failed to get upload URL");
			}

			const result = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!result.ok) {
				throw new Error("Failed to upload image");
			}

			const { storageId } = await result.json();

			setIconImage(storageId);
			setIconPreview((previousPreview) => {
				if (previousPreview && !previousPreview.startsWith("http")) {
					URL.revokeObjectURL(previousPreview);
				}
				return URL.createObjectURL(file);
			});
			setIcon(undefined);

			toast.success("Icon image uploaded successfully");
		} catch (error) {
			console.error("Failed to upload channel icon:", error);
			toast.error("Failed to upload image. Please try again.");
		} finally {
			setIsUploadingIcon(false);
		}
	};

	const clearIconImage = () => {
		setIconImage(undefined);
		setIconPreview((previousPreview) => {
			if (previousPreview && !previousPreview.startsWith("http")) {
				URL.revokeObjectURL(previousPreview);
			}
			return undefined;
		});
		if (imageInputRef.current) {
			imageInputRef.current.value = "";
		}
	};

	const handleEditOpen = (value: boolean) => {
		if (member?.role !== "admin") return;
		setEditOpen(value);
	};

	const handleIconEditOpen = (value: boolean) => {
		setIconEditOpen(value);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		updateChannel(
			{ id: channelId, name: value, icon, iconImage },
			{
				onSuccess: () => {
					toast.success("Channel updated.");
					setEditOpen(false);
				},
				onError: () => {
					toast.error("Failed to update channel.");
				},
			}
		);
	};

	const handleIconSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Make sure channel exists before accessing its properties
		if (!channel) {
			toast.error("Channel not found.");
			return;
		}

		updateChannel(
			{ id: channelId, name: channel.name, icon },
			{
				onSuccess: () => {
					toast.success("Channel icon updated.");
					setIconEditOpen(false);
				},
				onError: () => {
					toast.error("Failed to update channel icon.");
				},
			}
		);
	};

	const handleDelete = async () => {
		const ok = await confirm();

		if (!ok) return;

		removeChannel(
			{ id: channelId },
			{
				onSuccess: () => {
					toast.success("Channel deleted");
					router.push(`/workspace/${workspaceId}`);
				},
				onError: () => {
					toast.error("Failed to delete channel.");
				},
			}
		);
	};

	if (channelLoading || memberLoading) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!channel) {
		return (
			<div className="flex h-full flex-1 flex-col items-center justify-center gap-y-2">
				<TriangleAlert className="size-5 text-muted-foreground" />
				<span className="text-sm text-muted-foreground">
					Channel not found.
				</span>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<ConfirmDialog />

			<WorkspaceToolbar>
				<Dialog onOpenChange={setChannelDialogOpen} open={channelDialogOpen}>
					<DialogTrigger asChild>
						<Button
							className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
							size="sm"
							variant="ghost"
						>
							<div className="flex items-center">
								{channel.iconImageUrl && !imageLoadError ? (
									<div className="mr-2 h-5 w-5 rounded-full overflow-hidden">
										<img
											alt={`Channel icon for ${channel.name}`}
											className="h-full w-full object-cover"
											onError={() => setImageLoadError(true)}
											src={channel.iconImageUrl}
										/>
									</div>
								) : channel.icon ? (
									<span className="mr-2 text-xl">{channel.icon}</span>
								) : (
									<div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 mr-2">
										<span className="text-xs font-medium text-gray-600">
											{channel.name.charAt(0).toLowerCase()}
										</span>
									</div>
								)}
								<span className="truncate"># {channel.name}</span>
							</div>
							<FaChevronDown className="ml-2 size-2.5 transition-transform duration-200 group-hover:rotate-180" />
						</Button>
					</DialogTrigger>

					<DialogContent className="overflow-hidden bg-gray-50 p-0">
						<DialogHeader className="border-b bg-white p-4">
							<DialogTitle className="flex items-center">
								{channel.iconImageUrl && !imageLoadError ? (
									<div className="mr-2 h-6 w-6 rounded-full overflow-hidden">
										<img
											alt={`Channel icon for ${channel.name}`}
											className="h-full w-full object-cover"
											onError={() => setImageLoadError(true)}
											src={channel.iconImageUrl}
										/>
									</div>
								) : channel.icon ? (
									<span className="mr-2 text-xl">{channel.icon}</span>
								) : (
									<div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 mr-2">
										<span className="text-xs font-medium text-gray-600">
											{channel.name.charAt(0).toLowerCase()}
										</span>
									</div>
								)}
								<span># {channel.name}</span>
							</DialogTitle>

							<VisuallyHidden.Root>
								<DialogDescription>Your channel preferences</DialogDescription>
							</VisuallyHidden.Root>
						</DialogHeader>

						<div className="flex flex-col gap-y-2 px-4 pb-4 pt-4">
							{/* Admin-only dialog for editing both name and icon */}
							{member?.role === "admin" && (
								<Dialog
									onOpenChange={handleEditOpen}
									open={editOpen || isUpdatingChannel}
								>
									<DialogTrigger asChild>
										<button
											className="flex w-full cursor-pointer flex-col rounded-lg border bg-white px-5 py-4 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
											disabled={isUpdatingChannel}
										>
											<div className="flex w-full items-center justify-between">
												<p className="text-sm font-semibold">
													Channel name and icon
												</p>
												<p className="text-sm font-semibold text-[#1264A3] hover:underline">
													Edit
												</p>
											</div>

											<div className="flex items-center gap-3 mt-2">
												<div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 border border-gray-200 overflow-hidden">
													{channel.iconImageUrl && !imageLoadError ? (
														<img
															alt={`Channel icon for ${channel.name}`}
															className="h-full w-full object-cover"
															onError={() => setImageLoadError(true)}
															src={channel.iconImageUrl}
														/>
													) : channel.icon ? (
														<span className="text-xl">{channel.icon}</span>
													) : (
														<span className="text-sm font-medium text-gray-600">
															{channel.name.charAt(0).toLowerCase()}
														</span>
													)}
												</div>
												<div>
													<p className="text-sm font-medium">
														# {channel.name}
													</p>
													<p className="text-xs text-muted-foreground">
														{channel.iconImageUrl
															? "Custom image icon"
															: channel.icon
																? "Custom emoji icon"
																: "Default letter icon"}
													</p>
												</div>
											</div>
										</button>
									</DialogTrigger>

									<DialogContent>
										<DialogHeader>
											<DialogTitle>Edit channel name and icon</DialogTitle>

											<VisuallyHidden.Root>
												<DialogDescription>
													Rename this channel to match your case.
												</DialogDescription>
											</VisuallyHidden.Root>
										</DialogHeader>

										<form className="space-y-4" onSubmit={handleSubmit}>
											<div className="space-y-4">
												<div className="flex flex-col gap-2">
													<div className="flex items-center justify-between">
														<label className="text-sm font-medium">
															Channel Icon
														</label>
														<span className="text-xs text-muted-foreground">
															Select emoji or upload image
														</span>
													</div>
													<div className="flex items-center gap-3">
														<div className="flex-shrink-0 relative">
															<input
																accept="image/*"
																className="hidden"
																id="icon-upload"
																onChange={handleIconImageUpload}
																ref={imageInputRef}
																type="file"
															/>
															<div
																className="relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all"
																onClick={() =>
																	!isUploadingIcon && imageInputRef.current?.click()
																}
															>
																{iconPreview || icon ? (
																	<>
																		{iconPreview ? (
																			<img
																				alt="Icon preview"
																				className="h-full w-full object-cover rounded"
																				src={iconPreview}
																			/>
																		) : (
																			<span className="text-4xl">{icon}</span>
																		)}
																		<button
																			className="absolute -top-2 -right-2 h-6 w-6 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
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
																			<X className="h-3.5 w-3.5" />
																		</button>
																	</>
																) : (
																	<div className="flex flex-col items-center gap-1">
																		<Upload className="h-6 w-6 text-gray-400" />
																		<span className="text-xs text-gray-500 text-center">
																			{isUploadingIcon ? "Uploading..." : "Upload"}
																		</span>
																	</div>
																)}
															</div>
															<EmojiPopover
																hint="Select emoji icon"
																onEmojiSelect={handleEmojiSelect}
															>
																<button
																	className="absolute -bottom-1 -right-1 h-7 w-7 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
																	type="button"
																>
																	<Smile className="h-4 w-4" />
																</button>
															</EmojiPopover>
														</div>
														<div className="flex-1">
															<label className="text-sm font-medium mb-1 block">
																Channel Name
															</label>
															<Input
																autoFocus
																disabled={isUpdatingChannel}
																maxLength={20}
																minLength={3}
																onChange={handleChange}
																placeholder="e.g. plan-budget"
																required
																value={value}
															/>
															<p className="text-xs text-muted-foreground mt-1">
																Max 5MB for images
															</p>

															{member?.role === "admin" && (
																<button
																	className="flex cursor-pointer items-center gap-x-2 rounded-lg border bg-white px-5 py-4 text-rose-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
																	disabled={isRemovingChannel}
																	onClick={handleDelete}
																>
																	<Trash className="size-4" />
																	<p className="text-sm font-semibold">Delete channel</p>
																</button>
															)}
														</div>
													</div>
												</div>
											</div>

											<DialogFooter>
												<DialogClose asChild>
													<Button disabled={isUpdatingChannel} variant="outline">
														Cancel
													</Button>
												</DialogClose>

												<Button disabled={isUpdatingChannel} type="submit">
													Save
												</Button>
											</DialogFooter>
										</form>
									</DialogContent>
								</Dialog>
							)}

							<Dialog
								onOpenChange={handleIconEditOpen}
								open={iconEditOpen || (isUpdatingChannel && !editOpen)}
							>
								<DialogTrigger asChild>
									<button className="flex w-full cursor-pointer flex-col rounded-lg border bg-white px-5 py-4 hover:bg-gray-50">
										<div className="flex w-full items-center justify-between">
											<p className="text-sm font-semibold">Channel icon</p>
											<p className="text-sm font-semibold text-[#1264A3] hover:underline">
												Edit
											</p>
										</div>

										<div className="flex items-center gap-3 mt-2">
											<div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 border border-gray-200 overflow-hidden">
												{channel.iconImageUrl && !imageLoadError ? (
													<img
														alt={`Channel icon for ${channel.name}`}
														className="h-full w-full object-cover"
														onError={() => setImageLoadError(true)}
														src={channel.iconImageUrl}
													/>
												) : channel.icon ? (
													<span className="text-xl">{channel.icon}</span>
												) : (
													<span className="text-sm font-medium text-gray-600">
														{channel.name.charAt(0).toLowerCase()}
													</span>
												)}
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													{channel.iconImageUrl
														? "Custom image icon"
														: channel.icon
															? "Custom emoji icon"
															: "Default letter icon"}
												</p>
												<p className="text-xs text-muted-foreground">
													Click to change the channel icon
												</p>
											</div>
										</div>
									</button>
								</DialogTrigger>

								<DialogContent>
									<DialogHeader>
										<DialogTitle>Edit channel icon</DialogTitle>
										<DialogDescription>
											Choose an emoji to represent this channel
										</DialogDescription>
									</DialogHeader>

									<form className="space-y-4" onSubmit={handleIconSubmit}>
										<div className="space-y-4">
											<div className="flex flex-col gap-2">
												<div className="flex items-center justify-between">
													<label className="text-sm font-medium">
														Channel Icon
													</label>
													<span className="text-xs text-muted-foreground">
														Click to select an emoji
													</span>
												</div>
												<div className="flex items-center justify-center">
													<div className="flex-shrink-0">
														<EmojiPopover
															hint="Select channel icon"
															onEmojiSelect={handleEmojiSelect}
														>
															<div className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-100 hover:bg-gray-200 hover:border-gray-400 transition-all">
																{icon ? (
																	<span className="text-4xl">{icon}</span>
																) : (
																	<div className="flex flex-col items-center">
																		<span className="text-sm text-gray-600">
																			Select
																		</span>
																		<span className="text-sm text-gray-600">
																			Icon
																		</span>
																	</div>
																)}
															</div>
														</EmojiPopover>
													</div>
												</div>
											</div>
										</div>

										<DialogFooter>
											<DialogClose asChild>
												<Button disabled={isUpdatingChannel} variant="outline">
													Cancel
												</Button>
											</DialogClose>

											<Button disabled={isUpdatingChannel} type="submit">
												Save
											</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>
						</div>
					</DialogContent>
				</Dialog>
			</WorkspaceToolbar>

			<Topbar />

			<div className="flex-1 overflow-y-auto">{children}</div>
		</div>
	);
};

export default ChannelLayout;