"use client";

import { Root as VisuallyHiddenRoot } from "@radix-ui/react-visually-hidden";
import {
	ChevronDown,
	Loader,
	Smile,
	Trash,
	TriangleAlert,
	Upload,
	X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import {
	type PropsWithChildren,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { EmojiPopover } from "@/components/pickers/emoji-popover";
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
import { AiNotemaker } from "@/features/ai-notemaker/components/ai-notemaker";
import { useAiNotemakerStore } from "@/features/ai-notemaker/store/use-ai-notemaker-store";
import { useGetChannel } from "@/features/channels/api/use-get-channel";
import { useRemoveChannel } from "@/features/channels/api/use-remove-channel";
import { useUpdateChannel } from "@/features/channels/api/use-update-channel";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useChannelId } from "@/hooks/use-channel-id";
import { useConfirm } from "@/hooks/use-confirm";
import { useGenerateUploadUrl } from "@/hooks/use-generate-upload-url";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useSetWorkspaceTitle } from "../../workspace-title-context";

interface ChannelIconProps {
	iconImageUrl?: string | null;
	icon?: string;
	name: string;
	size?: "sm" | "md" | "lg" | "xl";
	imageLoadError?: boolean;
	onImageError?: () => void;
}

const emojiSizeClasses: Record<
	NonNullable<ChannelIconProps["size"]>,
	string
> = {
	sm: "h-5 w-5 text-base",
	md: "h-6 w-6 text-lg",
	lg: "h-10 w-10 text-3xl",
	xl: "h-20 w-20 text-6xl",
};

const ChannelIcon = ({
	iconImageUrl,
	icon,
	name,
	size = "sm",
	imageLoadError = false,
	onImageError,
}: ChannelIconProps) => {
	const sizeClasses = {
		sm: "h-5 w-5",
		md: "h-6 w-6",
		lg: "h-10 w-10",
		xl: "h-20 w-20",
	};

	const containerSize = sizeClasses[size];

	if (iconImageUrl && !imageLoadError) {
		return (
			<div className={`${containerSize} rounded-full overflow-hidden relative`}>
				<Image
					alt={`Channel icon for ${name}`}
					className="h-full w-full object-cover"
					fill
					onError={onImageError}
					src={iconImageUrl}
				/>
			</div>
		);
	}

	if (icon) {
		return (
			<span
				className={`${emojiSizeClasses[size] ?? emojiSizeClasses.sm} inline-flex items-center justify-center leading-none`}
			>
				{icon}
			</span>
		);
	}

	return (
		<div
			className={`${containerSize} flex items-center justify-center rounded-full bg-gray-100`}
		>
			<span className="text-xs font-medium text-gray-600">
				{name.charAt(0).toLowerCase()}
			</span>
		</div>
	);
};

interface ChannelIconPreviewProps {
	iconImageUrl?: string | null;
	icon?: string;
	iconPreview?: string;
	channelName: string;
	imageLoadError: boolean;
	setImageLoadError: (value: boolean) => void;
}

const ChannelIconPreview = ({
	iconImageUrl,
	icon,
	iconPreview,
	channelName,
	imageLoadError,
	setImageLoadError,
}: ChannelIconPreviewProps) => {
	if (iconPreview) {
		return (
			<div className="h-full w-full relative">
				<Image
					alt="Icon preview"
					className="h-full w-full object-cover rounded"
					fill
					src={iconPreview}
				/>
			</div>
		);
	}

	if (icon) {
		return <span className="text-4xl">{icon}</span>;
	}

	return (
		<ChannelIcon
			iconImageUrl={iconImageUrl}
			imageLoadError={imageLoadError}
			name={channelName}
			onImageError={() => setImageLoadError(true)}
			size="xl"
		/>
	);
};

interface ChannelIconUploaderProps {
	icon?: string;
	iconImage?: Id<"_storage">;
	iconPreview?: string;
	channelName: string;
	imageLoadError: boolean;
	isUploadingIcon: boolean;
	imageInputRef: React.RefObject<HTMLInputElement>;
	setIcon: (icon: string | undefined) => void;
	setImageLoadError: (value: boolean) => void;
	onIconImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
	clearIconImage: () => void;
}

const ChannelIconUploader = ({
	icon,
	iconImage,
	iconPreview,
	channelName,
	imageLoadError,
	isUploadingIcon,
	imageInputRef,
	setIcon,
	setImageLoadError,
	onIconImageUpload,
	clearIconImage,
}: ChannelIconUploaderProps) => {
	return (
		<div className="flex-shrink-0 relative">
			<input
				accept="image/*"
				className="hidden"
				id="icon-upload"
				onChange={onIconImageUpload}
				ref={imageInputRef}
				type="file"
			/>
			<button
				aria-label="Upload workspace icon"
				className="relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all disabled:cursor-not-allowed disabled:opacity-50"
				disabled={isUploadingIcon}
				onClick={() => !isUploadingIcon && imageInputRef.current?.click()}
				type="button"
			>
				{iconPreview || icon ? (
					<ChannelIconPreview
						channelName={channelName}
						icon={icon}
						iconImageUrl={
							iconPreview?.startsWith("http") ? iconPreview : undefined
						}
						iconPreview={
							iconPreview && !iconPreview.startsWith("http")
								? iconPreview
								: undefined
						}
						imageLoadError={imageLoadError}
						setImageLoadError={setImageLoadError}
					/>
				) : (
					<div className="flex flex-col items-center gap-1">
						<Upload className="h-6 w-6 text-gray-400" />
						<span className="text-xs text-gray-500 text-center">
							{isUploadingIcon ? "Uploading..." : "Upload"}
						</span>
					</div>
				)}
			</button>
			{(iconPreview || icon) && (
				<button
					className="absolute -top-2 -right-2 h-6 w-6 bg-card text-foreground rounded-full flex items-center justify-center hover:bg-accent shadow-md border-2 border-border z-50"
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
			)}
			<EmojiPopover
				hint="Select emoji icon"
				onEmojiSelect={(e) => {
					clearIconImage();
					setIcon(e);
				}}
			>
				<button
					className="absolute -bottom-1 -right-1 h-7 w-7 bg-card text-foreground rounded-full flex items-center justify-center hover:bg-accent shadow-md border-2 border-border z-50"
					type="button"
				>
					<Smile className="h-4 w-4" />
				</button>
			</EmojiPopover>
		</div>
	);
};

interface ChannelNameDialogProps {
	channel: {
		_id: Id<"channels">;
		name: string;
		icon?: string;
		iconImage?: Id<"_storage">;
		iconImageUrl?: string | null;
	};
	member: { _id: Id<"members">; role: string };
	isUpdatingChannel: boolean;
	isRemovingChannel: boolean;
	imageInputRef: React.RefObject<HTMLInputElement>;
	onDelete: () => void;
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	onIconImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
	clearIconImage: () => void;
	setEditOpen: (open: boolean) => void;
	setIcon: (icon: string | undefined) => void;
	setValue: (value: string) => void;
	value: string;
	icon?: string;
	iconImage?: Id<"_storage">;
	iconPreview?: string;
	imageLoadError: boolean;
	isUploadingIcon: boolean;
	setImageLoadError: (value: boolean) => void;
	editOpen: boolean;
}

const ChannelNameDialog = ({
	channel,
	member,
	isUpdatingChannel,
	isRemovingChannel,
	imageInputRef,
	onDelete,
	onSubmit,
	onIconImageUpload,
	clearIconImage,
	setEditOpen,
	setIcon,
	setValue,
	value,
	icon,
	iconImage,
	iconPreview,
	imageLoadError,
	isUploadingIcon,
	setImageLoadError,
	editOpen,
}: ChannelNameDialogProps) => {
	const nameInputRef = useRef<HTMLInputElement>(null);
	const isChannelEditOpen = editOpen || isUpdatingChannel;

	useEffect(() => {
		if (isChannelEditOpen) {
			setTimeout(() => {
				nameInputRef.current?.focus();
			}, 0);
		}
	}, [isChannelEditOpen]);
	return (
		<Dialog onOpenChange={setEditOpen} open={isChannelEditOpen}>
			<DialogTrigger asChild>
				<button
					className="flex w-full cursor-pointer flex-col rounded-lg border bg-card px-5 py-4 hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
					disabled={isUpdatingChannel}
					type="button"
				>
					<div className="flex w-full items-center justify-between">
						<p className="text-sm font-semibold">Channel name and icon</p>
						<p className="text-sm font-semibold text-primary hover:underline">
							Edit
						</p>
					</div>

					<div className="flex items-center gap-3 mt-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 border border-gray-200 overflow-hidden">
							<ChannelIcon
								icon={channel.icon}
								iconImageUrl={channel.iconImageUrl}
								imageLoadError={imageLoadError}
								name={channel.name}
								onImageError={() => setImageLoadError(true)}
								size="md"
							/>
						</div>
						<div>
							<p className="text-sm font-medium"># {channel.name}</p>
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
					<VisuallyHiddenRoot>
						<DialogDescription>
							Update this channel's name and icon.
						</DialogDescription>
					</VisuallyHiddenRoot>
				</DialogHeader>

				<form className="space-y-4" onSubmit={onSubmit}>
					<div className="space-y-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<p className="text-sm font-medium">Channel Icon</p>
								<span className="text-xs text-muted-foreground">
									Select emoji or upload image
								</span>
							</div>
							<div className="flex items-center gap-3">
								<ChannelIconUploader
									channelName={channel.name}
									clearIconImage={clearIconImage}
									icon={icon}
									iconImage={iconImage}
									iconPreview={iconPreview}
									imageInputRef={imageInputRef}
									imageLoadError={imageLoadError}
									isUploadingIcon={isUploadingIcon}
									onIconImageUpload={onIconImageUpload}
									setIcon={setIcon}
									setImageLoadError={setImageLoadError}
								/>
								<div className="flex-1">
									<label
										className="text-sm font-medium mb-1 block"
										htmlFor="channel-name-input"
									>
										Channel Name
									</label>
									<Input
										disabled={isUpdatingChannel}
										id="channel-name-input"
										maxLength={20}
										minLength={3}
										onChange={(e) =>
											setValue(
												e.target.value.replace(/\s+/g, "-").toLowerCase()
											)
										}
										placeholder="e.g. plan-budget"
										ref={nameInputRef}
										required
										value={value}
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Images up to 5MB
									</p>
								</div>
							</div>
						</div>

						{(member.role === "admin" || member.role === "owner") && (
							<div className="border-t pt-4">
								<button
									className="flex w-full cursor-pointer items-center gap-x-2 rounded-lg border bg-card px-5 py-4 text-destructive hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
									disabled={isRemovingChannel}
									onClick={onDelete}
									type="button"
								>
									<Trash className="size-4" />
									<p className="text-sm font-semibold">Delete channel</p>
								</button>
							</div>
						)}
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
	);
};

interface ChannelIconDialogProps {
	channel: {
		_id: Id<"channels">;
		name: string;
		icon?: string;
		iconImage?: Id<"_storage">;
		iconImageUrl?: string | null;
	};
	iconEditOpen: boolean;
	isUpdatingChannel: boolean;
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	onIconEditOpenChange: (open: boolean) => void;
	setIcon: (icon: string | undefined) => void;
	setIconImage: React.Dispatch<
		React.SetStateAction<Id<"_storage"> | undefined>
	>;
	setIconPreview: React.Dispatch<React.SetStateAction<string | undefined>>;
	icon?: string;
}

const ChannelIconDialog = ({
	channel,
	iconEditOpen,
	isUpdatingChannel,
	onSubmit,
	onIconEditOpenChange,
	setIcon,
	setIconImage,
	setIconPreview,
	icon,
}: ChannelIconDialogProps) => {
	return (
		<Dialog onOpenChange={onIconEditOpenChange} open={iconEditOpen}>
			<DialogTrigger asChild>
				<button
					className="flex w-full cursor-pointer flex-col rounded-lg border bg-card px-5 py-4 hover:bg-accent"
					type="button"
				>
					<div className="flex w-full items-center justify-between">
						<p className="text-sm font-semibold">Channel icon</p>
						<p className="text-sm font-semibold text-primary hover:underline">
							Edit
						</p>
					</div>

					<div className="flex items-center gap-3 mt-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 border border-gray-200 overflow-hidden">
							<ChannelIcon
								icon={channel.icon}
								iconImageUrl={channel.iconImageUrl}
								name={channel.name}
								size="md"
							/>
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

				<form className="space-y-4" onSubmit={onSubmit}>
					<div className="space-y-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<p className="text-sm font-medium">Channel Icon</p>
								<span className="text-xs text-muted-foreground">
									Click to select an emoji
								</span>
							</div>
							<div className="flex items-center justify-center">
								<div className="flex-shrink-0">
									<EmojiPopover
										hint="Select channel icon"
										onEmojiSelect={(e) => {
											setIconImage(() => undefined);
											setIconPreview(() => undefined);
											setIcon(e);
										}}
									>
										<div className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-100 hover:bg-gray-200 hover:border-gray-400 transition-all">
											{icon ? (
												<span className="text-4xl">{icon}</span>
											) : (
												<div className="flex flex-col items-center">
													<span className="text-sm text-gray-600">Select</span>
													<span className="text-sm text-gray-600">Icon</span>
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
	);
};

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
	const { isExpanded, isOpen } = useAiNotemakerStore();
	const [ConfirmDialog, confirm] = useConfirm(
		"Delete this channel?",
		"You are about to delete this channel and any of its associated messages. This action is irreversible."
	);

	const [value, setValue] = useState("");
	const [icon, setIcon] = useState<string | undefined>();
	const [iconImage, setIconImage] = useState<Id<"_storage"> | undefined>();
	const [iconPreview, setIconPreview] = useState<string | undefined>();
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

	useEffect(() => {
		setImageLoadError(false);
	}, []);

	const _handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value.replace(/\s+/g, "-").toLowerCase();
		setValue(value);
	};

	const _handleEmojiSelect = (emoji: string) => {
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

	const _handleEditOpen = (value: boolean) => {
		if (member?.role !== "admin") return;
		setEditOpen(value);
	};

	const _handleIconEditOpen = (value: boolean) => {
		setIconEditOpen(value);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		updateChannel(
			{
				id: channelId,
				name: value,
				icon,
				iconImage:
					iconImage === undefined && channel?.iconImage ? null : iconImage,
			},
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
			{
				id: channelId,
				name: channel.name,
				icon,
				iconImage:
					iconImage === undefined && channel.iconImage ? null : iconImage,
			},
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

	// The title slot is just the small settings trigger button (memoized so
	// registering it doesn't re-fire, and re-render every consumer, on every
	// unrelated render of this page). The actual settings dialog is rendered
	// separately below in the normal page body, fully controlled by the same
	// channelDialogOpen/setChannelDialogOpen state, so its much larger and
	// more volatile subtree never has to be memoized as "title content."
	const channelTitle = useMemo(
		() =>
			channel ? (
				<Button
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					onClick={() => setChannelDialogOpen(true)}
					size="sm"
					variant="ghost"
				>
					<div className="flex min-w-0 items-center gap-2">
						<ChannelIcon
							icon={channel.icon}
							iconImageUrl={channel.iconImageUrl}
							imageLoadError={imageLoadError}
							name={channel.name}
							onImageError={() => setImageLoadError(true)}
						/>
						<span className="truncate"># {channel.name}</span>
					</div>
					<ChevronDown className="ml-2 size-2.5 transition-transform duration-200 group-hover:rotate-180" />
				</Button>
			) : null,
		[channel, imageLoadError]
	);
	useSetWorkspaceTitle(channelTitle);

	const channelSettingsDialog = channel ? (
		<Dialog onOpenChange={setChannelDialogOpen} open={channelDialogOpen}>
			<DialogContent className="overflow-hidden bg-gray-50 p-0">
				<DialogHeader className="border-b bg-card p-4">
					<DialogTitle className="flex items-center gap-2">
						<ChannelIcon
							icon={channel.icon}
							iconImageUrl={channel.iconImageUrl}
							imageLoadError={imageLoadError}
							name={channel.name}
							onImageError={() => setImageLoadError(true)}
							size="md"
						/>
						<span># {channel.name}</span>
					</DialogTitle>

					<VisuallyHiddenRoot>
						<DialogDescription>Your channel preferences</DialogDescription>
					</VisuallyHiddenRoot>
				</DialogHeader>

				<div className="flex flex-col gap-y-2 px-4 pb-4 pt-4">
					{member?.role === "admin" && (
						<ChannelNameDialog
							channel={channel}
							clearIconImage={clearIconImage}
							editOpen={editOpen}
							icon={icon}
							iconImage={iconImage}
							iconPreview={iconPreview}
							imageInputRef={imageInputRef}
							imageLoadError={imageLoadError}
							isRemovingChannel={isRemovingChannel}
							isUpdatingChannel={isUpdatingChannel}
							isUploadingIcon={isUploadingIcon}
							member={member}
							onDelete={handleDelete}
							onIconImageUpload={handleIconImageUpload}
							onSubmit={handleSubmit}
							setEditOpen={setEditOpen}
							setIcon={setIcon}
							setImageLoadError={setImageLoadError}
							setValue={setValue}
							value={value}
						/>
					)}

					<ChannelIconDialog
						channel={channel}
						icon={icon}
						iconEditOpen={iconEditOpen}
						isUpdatingChannel={isUpdatingChannel}
						onIconEditOpenChange={setIconEditOpen}
						onSubmit={handleIconSubmit}
						setIcon={setIcon}
						setIconImage={setIconImage}
						setIconPreview={setIconPreview}
					/>
				</div>
			</DialogContent>
		</Dialog>
	) : null;

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
		<div className="flex h-full flex-col w-full min-w-0 overflow-x-hidden">
			<ConfirmDialog />
			{channelSettingsDialog}

			<div className="flex-1 flex min-h-0 min-w-0">
				{(!isExpanded || !isOpen) && (
					<div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
						{children}
					</div>
				)}
				{isOpen && (
					<div
						className={
							isExpanded
								? "w-full h-full"
								: "flex w-[380px] border-l border-border"
						}
					>
						<AiNotemaker
							channelId={channelId as string}
							workspaceId={workspaceId as string}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

export default ChannelLayout;
