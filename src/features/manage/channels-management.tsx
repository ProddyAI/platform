"use client";

import {
	Edit,
	Hash,
	Plus,
	RefreshCw,
	Smile,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { EmojiPopover } from "@/components/emoji-popover";
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
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCreateChannel } from "@/features/channels/api/use-create-channel";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useRemoveChannel } from "@/features/channels/api/use-remove-channel";
import { useUpdateChannel } from "@/features/channels/api/use-update-channel";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";

interface ChannelsManagementProps {
	workspaceId: Id<"workspaces">;
	currentMember: Doc<"members">;
}

export const ChannelsManagement = ({
	workspaceId,
	currentMember,
}: ChannelsManagementProps) => {
	const { data: channels, isLoading } = useGetChannels({ workspaceId });
	const [newChannelName, setNewChannelName] = useState("");
	const [newChannelIcon, setNewChannelIcon] = useState<string | undefined>(
		undefined
	);
	const [newChannelIconImage, setNewChannelIconImage] = useState<
		Id<"_storage"> | undefined
	>(undefined);
	const [newChannelIconPreview, setNewChannelIconPreview] = useState<
		string | undefined
	>(undefined);
	const [editChannelName, setEditChannelName] = useState("");
	const [editChannelIcon, setEditChannelIcon] = useState<string | undefined>(
		undefined
	);
	const [editChannelIconImage, setEditChannelIconImage] = useState<
		Id<"_storage"> | undefined
	>(undefined);
	const [editChannelIconPreview, setEditChannelIconPreview] = useState<
		string | undefined
	>(undefined);
	const [editChannelId, setEditChannelId] = useState<Id<"channels"> | null>(
		null
	);
	const [deleteChannelId, setDeleteChannelId] = useState<Id<"channels"> | null>(
		null
	);
	const [isCreating, setIsCreating] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isUploadingNew, setIsUploadingNew] = useState(false);
	const [isUploadingEdit, setIsUploadingEdit] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	const newImageInputRef = useRef<HTMLInputElement>(null);
	const editImageInputRef = useRef<HTMLInputElement>(null);

	const createChannel = useCreateChannel();
	const updateChannel = useUpdateChannel();
	const removeChannel = useRemoveChannel();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();

	const handleNewChannelEmojiSelect = (emoji: string) => {
		setNewChannelIcon(emoji);
		setNewChannelIconImage(undefined);
		setNewChannelIconPreview(undefined);
	};

	const handleEditChannelEmojiSelect = (emoji: string) => {
		setEditChannelIcon(emoji);
		setEditChannelIconImage(undefined);
		setEditChannelIconPreview(undefined);
	};

	const handleNewIconImageUpload = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type - only allow safe image formats
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

		setIsUploadingNew(true);

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
				// Parse error response for detailed error messages
				let errorMessage = "Failed to upload image";

				// Provide specific error based on HTTP status
				if (result.status === 400) {
					errorMessage =
						"Invalid file format. Please upload a valid image file.";
				} else if (result.status === 401 || result.status === 403) {
					errorMessage = "Authentication failed. Please try logging in again.";
				} else if (result.status === 413) {
					errorMessage = "Image file is too large. Maximum size is 5MB.";
				} else if (result.status === 415) {
					errorMessage =
						"Unsupported file type. Please use PNG, JPG, GIF, or WebP.";
				} else if (
					result.status === 500 ||
					result.status === 502 ||
					result.status === 503
				) {
					errorMessage = "Server error. Please try again in a few moments.";
				} else if (result.status === 504) {
					errorMessage =
						"Upload timeout. Please check your connection and try again.";
				}

				// Try to get more specific error from response
				try {
					const errorData = await result.json();
					if (errorData.message || errorData.error) {
						errorMessage = errorData.message || errorData.error;
					}
				} catch {
					// If JSON parsing fails, use status text if available
					if (result.statusText) {
						errorMessage = `${errorMessage} (${result.statusText})`;
					}
				}

				// Throw error with HTTP status for better error handling
				const error = new Error(errorMessage);
				(error as any).status = result.status;
				throw error;
			}

			const { storageId } = await result.json();

			setNewChannelIconImage(storageId);
			setNewChannelIconPreview((previousPreview) => {
				if (previousPreview) {
					URL.revokeObjectURL(previousPreview);
				}
				return URL.createObjectURL(file);
			});
			setNewChannelIcon(undefined);

			toast.success("Icon image uploaded successfully");
		} catch (error) {
			console.error("Failed to upload new channel icon:", error);

			// Provide specific error messages based on error type and HTTP status
			if (error instanceof TypeError && error.message.includes("fetch")) {
				toast.error(
					"Network error: Unable to connect to the server. Please check your internet connection."
				);
			} else if (error instanceof Error) {
				const status = (error as any).status;

				// Handle HTTP status codes
				if (status === 400) {
					toast.error(
						"Invalid file format. Please upload a valid image file (PNG, JPG, SVG)."
					);
				} else if (status === 401 || status === 403) {
					toast.error(
						"You don't have permission to upload images. Please try logging in again."
					);
				} else if (status === 413) {
					toast.error("Image file is too large. Maximum size is 5MB.");
				} else if (status === 415) {
					toast.error(
						"Unsupported file type. Please use PNG, JPG, or SVG format."
					);
				} else if (status === 500 || status === 502 || status === 503) {
					toast.error("Server error. Please try again in a few moments.");
				} else if (status === 504) {
					toast.error(
						"Upload timeout. Please check your connection and try again."
					);
				} else if (error.message.includes("upload URL")) {
					toast.error("Failed to get upload URL. Please try again.");
				} else if (error.message.includes("upload image")) {
					toast.error(
						"Server rejected the upload. Please ensure the image is valid and try again."
					);
				} else {
					toast.error(`Upload failed: ${error.message}`);
				}
			} else {
				toast.error(
					"An unexpected error occurred while uploading the icon image. Please try again."
				);
			}
		} finally {
			setIsUploadingNew(false);
		}
	};

	const handleEditIconImageUpload = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type - only allow safe image formats
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

		setIsUploadingEdit(true);

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
				// Parse error response for detailed error messages
				let errorMessage = "Failed to upload image";

				// Provide specific error based on HTTP status
				if (result.status === 400) {
					errorMessage =
						"Invalid file format. Please upload a valid image file.";
				} else if (result.status === 401 || result.status === 403) {
					errorMessage = "Authentication failed. Please try logging in again.";
				} else if (result.status === 413) {
					errorMessage = "Image file is too large. Maximum size is 5MB.";
				} else if (result.status === 415) {
					errorMessage =
						"Unsupported file type. Please use PNG, JPG, GIF, or WebP.";
				} else if (
					result.status === 500 ||
					result.status === 502 ||
					result.status === 503
				) {
					errorMessage = "Server error. Please try again in a few moments.";
				} else if (result.status === 504) {
					errorMessage =
						"Upload timeout. Please check your connection and try again.";
				}

				// Try to get more specific error from response
				try {
					const errorData = await result.json();
					if (errorData.message || errorData.error) {
						errorMessage = errorData.message || errorData.error;
					}
				} catch {
					// If JSON parsing fails, use status text if available
					if (result.statusText) {
						errorMessage = `${errorMessage} (${result.statusText})`;
					}
				}

				// Throw error with HTTP status for better error handling
				const error = new Error(errorMessage);
				(error as any).status = result.status;
				throw error;
			}

			const { storageId } = await result.json();

			setEditChannelIconImage(storageId);
			setEditChannelIconPreview((previousPreview) => {
				if (previousPreview) {
					URL.revokeObjectURL(previousPreview);
				}
				return URL.createObjectURL(file);
			});
			setEditChannelIcon(undefined);

			toast.success("Icon image uploaded successfully");
		} catch (error) {
			console.error("Failed to upload edit channel icon:", error);

			// Provide specific error messages based on error type and HTTP status
			if (error instanceof TypeError && error.message.includes("fetch")) {
				toast.error(
					"Network error: Unable to connect to the server. Please check your internet connection."
				);
			} else if (error instanceof Error) {
				const status = (error as any).status;

				// Handle HTTP status codes
				if (status === 400) {
					toast.error(
						"Invalid file format. Please upload a valid image file (PNG, JPG, SVG)."
					);
				} else if (status === 401 || status === 403) {
					toast.error(
						"You don't have permission to upload images. Please try logging in again."
					);
				} else if (status === 413) {
					toast.error("Image file is too large. Maximum size is 5MB.");
				} else if (status === 415) {
					toast.error(
						"Unsupported file type. Please use PNG, JPG, or SVG format."
					);
				} else if (status === 500 || status === 502 || status === 503) {
					toast.error("Server error. Please try again in a few moments.");
				} else if (status === 504) {
					toast.error(
						"Upload timeout. Please check your connection and try again."
					);
				} else if (error.message.includes("upload URL")) {
					toast.error("Failed to get upload URL. Please try again.");
				} else if (error.message.includes("upload image")) {
					toast.error(
						"Server rejected the upload. Please ensure the image is valid and try again."
					);
				} else {
					toast.error(`Upload failed: ${error.message}`);
				}
			} else {
				toast.error(
					"An unexpected error occurred while uploading the icon image. Please try again."
				);
			}
		} finally {
			setIsUploadingEdit(false);
		}
	};

	const clearNewIconImage = () => {
		setNewChannelIconImage(undefined);
		setNewChannelIconPreview((previousPreview) => {
			if (previousPreview) {
				URL.revokeObjectURL(previousPreview);
			}
			return undefined;
		});
		if (newImageInputRef.current) {
			newImageInputRef.current.value = "";
		}
	};

	const clearEditIconImage = () => {
		setEditChannelIconImage(undefined);
		setEditChannelIconPreview((previousPreview) => {
			if (previousPreview) {
				URL.revokeObjectURL(previousPreview);
			}
			return undefined;
		});
		if (editImageInputRef.current) {
			editImageInputRef.current.value = "";
		}
	};

	const handleCreateChannel = async () => {
		if (newChannelName.length < 3 || newChannelName.length > 20) {
			toast.error("Channel name must be between 3 and 20 characters");
			return;
		}

		setIsCreating(true);

		try {
			await createChannel.mutate({
				name: newChannelName,
				workspaceId,
				icon: newChannelIcon,
				iconImage: newChannelIconImage,
			});

			toast.success("Channel created");
			setNewChannelName("");
			setNewChannelIcon(undefined);
			setNewChannelIconImage(undefined);
			setNewChannelIconPreview(undefined);
			setCreateDialogOpen(false);
		} catch (error) {
			console.error("Failed to create channel:", error);

			// Provide specific error messages based on error type
			if (error instanceof TypeError && error.message.includes("fetch")) {
				toast.error(
					"Network error: Unable to connect to the server. Please check your internet connection."
				);
			} else if (error instanceof Error) {
				if (
					error.message.includes("already exists") ||
					error.message.includes("duplicate")
				) {
					toast.error(
						"A channel with this name already exists. Please choose a different name."
					);
				} else if (
					error.message.includes("permission") ||
					error.message.includes("unauthorized")
				) {
					toast.error(
						"You don't have permission to create channels in this workspace."
					);
				} else if (error.message.includes("limit")) {
					toast.error(
						"Channel limit reached. Please delete some channels before creating new ones."
					);
				} else {
					toast.error(`Failed to create channel: ${error.message}`);
				}
			} else {
				toast.error(
					"An unexpected error occurred while creating the channel. Please try again."
				);
			}
		} finally {
			setIsCreating(false);
		}
	};

	const handleUpdateChannel = async () => {
		if (!editChannelId) return;

		if (editChannelName.length < 3 || editChannelName.length > 20) {
			toast.error("Channel name must be between 3 and 20 characters");
			return;
		}

		setIsUpdating(true);

		try {
			await updateChannel.mutate({
				id: editChannelId,
				name: editChannelName,
				icon: editChannelIcon,
				iconImage: editChannelIconImage,
			});

			toast.success("Channel updated");
			setEditChannelName("");
			setEditChannelIcon(undefined);
			setEditChannelIconImage(undefined);
			setEditChannelIconPreview(undefined);
			setEditChannelId(null);
			setEditDialogOpen(false);
		} catch (error) {
			console.error("Failed to update channel:", error);

			// Provide specific error messages based on error type
			if (error instanceof TypeError && error.message.includes("fetch")) {
				toast.error(
					"Network error: Unable to connect to the server. Please check your internet connection."
				);
			} else if (error instanceof Error) {
				if (error.message.includes("not found")) {
					toast.error(
						"Channel not found. It may have been deleted by another user."
					);
				} else if (
					error.message.includes("already exists") ||
					error.message.includes("duplicate")
				) {
					toast.error(
						"A channel with this name already exists. Please choose a different name."
					);
				} else if (
					error.message.includes("permission") ||
					error.message.includes("unauthorized")
				) {
					toast.error("You don't have permission to update this channel.");
				} else {
					toast.error(`Failed to update channel: ${error.message}`);
				}
			} else {
				toast.error(
					"An unexpected error occurred while updating the channel. Please try again."
				);
			}
		} finally {
			setIsUpdating(false);
		}
	};

	const handleDeleteChannel = async () => {
		if (!deleteChannelId) return;

		setIsDeleting(true);

		try {
			await removeChannel.mutate({
				id: deleteChannelId,
			});

			toast.success("Channel deleted");
			setDeleteChannelId(null);
			setDeleteDialogOpen(false);
		} catch (error) {
			console.error("Failed to delete channel:", error);

			// Provide specific error messages based on error type
			if (error instanceof TypeError && error.message.includes("fetch")) {
				toast.error(
					"Network error: Unable to connect to the server. Please check your internet connection."
				);
			} else if (error instanceof Error) {
				if (error.message.includes("not found")) {
					toast.error("Channel not found. It may have already been deleted.");
				} else if (
					error.message.includes("permission") ||
					error.message.includes("unauthorized")
				) {
					toast.error("You don't have permission to delete this channel.");
				} else if (
					error.message.includes("has messages") ||
					error.message.includes("not empty")
				) {
					toast.error(
						"Cannot delete channel with existing messages. Please archive it instead."
					);
				} else if (
					error.message.includes("general") ||
					error.message.includes("default")
				) {
					toast.error("The general channel cannot be deleted.");
				} else {
					toast.error(`Failed to delete channel: ${error.message}`);
				}
			} else {
				toast.error(
					"An unexpected error occurred while deleting the channel. Please try again."
				);
			}
		} finally {
			setIsDeleting(false);
		}
	};

	const openEditDialog = (
		channel: Doc<"channels"> & { iconImageUrl?: string | null }
	) => {
		setEditChannelId(channel._id);
		setEditChannelName(channel.name);
		setEditChannelIcon(channel.icon);
		setEditChannelIconImage(channel.iconImage);
		setEditChannelIconPreview(channel.iconImageUrl || undefined);
		setEditDialogOpen(true);
	};

	const openDeleteDialog = (channelId: Id<"channels">) => {
		setDeleteChannelId(channelId);
		setDeleteDialogOpen(true);
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-medium">Channels</h3>
					<p className="text-sm text-muted-foreground">
						Manage the channels in your workspace
					</p>
				</div>

				<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							New Channel
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add a channel</DialogTitle>
							<DialogDescription>
								Channels are where your team communicates. They're best when
								organized around a topic. Choose an emoji icon to make your
								channel easily recognizable.
							</DialogDescription>
						</DialogHeader>
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
											ref={newImageInputRef}
											type="file"
											accept="image/*"
											onChange={handleNewIconImageUpload}
											className="hidden"
											id="new-icon-upload"
										/>
										<div className="relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all">
											<button
												type="button"
												className="absolute inset-0 rounded-md"
												aria-label="Upload channel icon"
												onClick={() =>
													!isUploadingNew && newImageInputRef.current?.click()
												}
											/>
											<div className="relative z-10 flex h-full w-full items-center justify-center">
												{newChannelIconPreview || newChannelIcon ? (
													<>
														{newChannelIconPreview ? (
															<img
																src={newChannelIconPreview}
																alt="Icon preview"
																className="h-full w-full object-cover"
															/>
														) : (
															<span className="text-4xl">{newChannelIcon}</span>
														)}
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																if (
																	newChannelIconPreview ||
																	newChannelIconImage
																) {
																	clearNewIconImage();
																}
																if (newChannelIcon) {
																	setNewChannelIcon(undefined);
																}
															}}
															className="absolute -top-2 -right-2 h-6 w-6 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
														>
															<X className="h-3.5 w-3.5" />
														</button>
													</>
												) : (
													<div className="flex flex-col items-center gap-1">
														<Upload className="h-6 w-6 text-gray-400" />
														<span className="text-xs text-gray-500 text-center">
															{isUploadingNew ? "Uploading..." : "Upload"}
														</span>
													</div>
												)}
											</div>
										</div>
										<EmojiPopover
											onEmojiSelect={handleNewChannelEmojiSelect}
											hint="Select emoji icon"
										>
											<button
												type="button"
												className="absolute -bottom-1 -right-1 h-7 w-7 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
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
											value={newChannelName}
											onChange={(e) => setNewChannelName(e.target.value)}
											placeholder="e.g. plan-budget"
											required
											minLength={3}
											maxLength={20}
											className="h-10 !leading-[1.5] py-2.5"
											style={{ lineHeight: "1.5" }}
										/>
										<p className="text-xs text-muted-foreground mt-1">
											Max 5MB for images
										</p>
									</div>
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button onClick={handleCreateChannel} disabled={isCreating}>
								{isCreating ? (
									<>
										<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
										Creating...
									</>
								) : (
									"Create Channel"
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			<Separator />

			{isLoading ? (
				<div className="flex justify-center py-8">
					<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : !channels || channels.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<Hash className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium">No channels</h3>
					<p className="text-sm text-muted-foreground">
						Create a channel to get started
					</p>
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead className="w-[200px]">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{channels.map((channel) => (
							<TableRow key={channel._id}>
								<TableCell className="font-medium">
									<div className="flex items-center">
										{channel.icon ? (
											<span className="mr-2 text-xl">{channel.icon}</span>
										) : (
											<Hash className="mr-2 h-4 w-4 text-muted-foreground" />
										)}
										{channel.name}
									</div>
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => openEditDialog(channel)}
										>
											<Edit className="h-4 w-4" />
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="text-destructive hover:bg-destructive/10"
											onClick={() => openDeleteDialog(channel._id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			{/* Edit Channel Dialog */}
			<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Channel</DialogTitle>
						<DialogDescription>
							Update the channel name and icon
						</DialogDescription>
					</DialogHeader>
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
										ref={editImageInputRef}
										type="file"
										accept="image/*"
										onChange={handleEditIconImageUpload}
										className="hidden"
										id="edit-icon-upload"
									/>
									<div className="relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all">
										<button
											type="button"
											className="absolute inset-0 rounded-md"
											aria-label="Upload channel icon"
											onClick={() =>
												!isUploadingEdit && editImageInputRef.current?.click()
											}
										/>
										<div className="relative z-10 flex h-full w-full items-center justify-center">
											{editChannelIconPreview || editChannelIcon ? (
												<>
													{editChannelIconPreview ? (
														<img
															src={editChannelIconPreview}
															alt="Icon preview"
															className="h-full w-full object-cover"
														/>
													) : (
														<span className="text-4xl">{editChannelIcon}</span>
													)}
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															if (
																editChannelIconPreview ||
																editChannelIconImage
															) {
																clearEditIconImage();
															}
															if (editChannelIcon) {
																setEditChannelIcon(undefined);
															}
														}}
														className="absolute -top-2 -right-2 h-6 w-6 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
													>
														<X className="h-3.5 w-3.5" />
													</button>
												</>
											) : (
												<div className="flex flex-col items-center gap-1">
													<Upload className="h-6 w-6 text-gray-400" />
													<span className="text-xs text-gray-500 text-center">
														{isUploadingEdit ? "Uploading..." : "Upload"}
													</span>
												</div>
											)}
										</div>
									</div>
									<EmojiPopover
										onEmojiSelect={handleEditChannelEmojiSelect}
										hint="Select emoji icon"
									>
										<button
											type="button"
											className="absolute -bottom-1 -right-1 h-7 w-7 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-100 shadow-md border-2 border-gray-200 z-50"
										>
											<Smile className="h-4 w-4" />
										</button>
									</EmojiPopover>
								</div>
								<div className="flex-1">
									<Label
										htmlFor="edit-name"
										className="text-sm font-medium mb-1 block"
									>
										Channel Name
									</Label>
									<Input
										id="edit-name"
										value={editChannelName}
										onChange={(e) => setEditChannelName(e.target.value)}
										required
										minLength={3}
										maxLength={20}
										className="h-10 !leading-[1.5] py-2.5"
										style={{ lineHeight: "1.5" }}
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Max 5MB for images
									</p>
								</div>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={handleUpdateChannel} disabled={isUpdating}>
							{isUpdating ? (
								<>
									<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
									Updating...
								</>
							) : (
								"Update Channel"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Channel Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							channel and all of its messages.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteChannel}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
