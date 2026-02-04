"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
	AlertTriangle,
	Camera,
	Edit3,
	Globe,
	Loader2,
	Mail,
	MapPin,
	Phone,
	Save,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUpdateUser } from "@/features/auth/api/use-update-user";
import { NotificationSettings } from "@/features/preferences/components/notification-settings";
import { StatusSelector } from "@/features/preferences/components/status-selector";
import { StatusTrackingSettings } from "@/features/preferences/components/status-tracking-settings";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";
import { useCurrentUser } from "../api/use-current-user";
import { useDeleteAccount } from "../api/use-delete-account";
import { PasswordChangeForm } from "./password-change-form";

interface UserProfileModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name?: string;
	email?: string;
	image?: string;
	mode: "view" | "edit";
	defaultTab?: "profile" | "notifications";
}

export const UserProfileModal = ({
	open,
	onOpenChange,
	name = "",
	email = "",
	image,
	mode,
	defaultTab = "profile",
}: UserProfileModalProps) => {
	const { data: currentUser } = useCurrentUser();
	const { updateUser } = useUpdateUser();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();
	const [isUpdating, setIsUpdating] = useState(false);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isUploadingBanner, setIsUploadingBanner] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const bannerFileInputRef = useRef<HTMLInputElement>(null);
	const [bannerPreview, setBannerPreview] = useState<string | null>(null);

	// Delete account state
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const deleteAccount = useDeleteAccount();
	const { signOut } = useAuthActions();
	const router = useRouter();

	// Reset confirmation input when dialog closes
	useEffect(() => {
		if (!deleteDialogOpen) setConfirmText("");
	}, [deleteDialogOpen]);

	const [displayName, setDisplayName] = useState(name);
	const [bio, setBio] = useState("");
	const [location, setLocation] = useState("");
	const [website, setWebsite] = useState("");
	const [phone, setPhone] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

	// Initialize form data when user data loads
	useEffect(() => {
		if (currentUser) {
			setDisplayName(currentUser.name || "");
			setBio((currentUser as any).bio || "");
			setLocation((currentUser as any).location || "");
			setWebsite((currentUser as any).website || "");
			setPhone(currentUser.phone || "");
		}
	}, [currentUser]);

	// Track changes
	useEffect(() => {
		if (currentUser) {
			const hasNameChange = displayName !== (currentUser.name || "");
			const hasBioChange = bio !== ((currentUser as any).bio || "");
			const hasLocationChange =
				location !== ((currentUser as any).location || "");
			const hasWebsiteChange = website !== ((currentUser as any).website || "");
			const hasPhoneChange = phone !== (currentUser.phone || "");

			setHasChanges(
				hasNameChange ||
					hasBioChange ||
					hasLocationChange ||
					hasWebsiteChange ||
					hasPhoneChange
			);
		}
	}, [displayName, bio, location, website, phone, currentUser]);

	const avatarFallback = displayName?.charAt(0).toUpperCase() ?? "?";
	const isEditMode = mode === "edit";
	const _title = isEditMode
		? "Account Settings"
		: displayName || "Your Profile";

	const memberSince = currentUser?._creationTime
		? new Date(currentUser._creationTime).toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
			})
		: "Unknown";

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!isEditMode || !hasChanges || !currentUser) return;

		setIsUpdating(true);
		try {
			await updateUser({
				name: displayName.trim(),
				bio: bio.trim() || undefined,
				location: location.trim() || undefined,
				website: website.trim() || undefined,
				phone: phone.trim() || undefined,
			});

			toast.success("Profile updated successfully");
			setIsEditing(false);
			setHasChanges(false);
		} catch (error) {
			toast.error("Failed to update profile");
			console.error("Profile update error:", error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleCancel = () => {
		if (currentUser) {
			setDisplayName(currentUser.name || "");
			setBio((currentUser as any).bio || "");
			setLocation((currentUser as any).location || "");
			setWebsite((currentUser as any).website || "");
			setPhone(currentUser.phone || "");
		}
		setIsEditing(false);
		setHasChanges(false);
	};

	const handleAvatarChange = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = [
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/gif",
			"image/webp",
		];
		if (!validTypes.includes(file.type)) {
			toast.error("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
			return;
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB in bytes
		if (file.size > maxSize) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		// Create preview URL outside try block so it's accessible in catch
		const previewUrl = URL.createObjectURL(file);
		setAvatarPreview(previewUrl);

		try {
			setIsUploadingAvatar(true);

			// Generate upload URL
			const uploadUrl = await generateUploadUrl({}, { throwError: true });
			if (!uploadUrl) throw new Error("Failed to generate upload URL");

			// Upload file
			const result = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!result.ok) throw new Error("Failed to upload image");

			const { storageId } = await result.json();

			// Update user profile with new image
			await updateUser({ image: storageId });

			toast.success("Avatar updated successfully!");
		} catch (error) {
			console.error("Avatar upload error:", error);
			toast.error("Failed to upload avatar. Please try again.");
		} finally {
			// Always clean up preview URL and reset states
			URL.revokeObjectURL(previewUrl);
			setAvatarPreview(null);
			setIsUploadingAvatar(false);

			// Reset file input
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleBannerChange = () => {
		bannerFileInputRef.current?.click();
	};

	const handleBannerFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = [
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/gif",
			"image/webp",
		];
		if (!validTypes.includes(file.type)) {
			toast.error("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
			return;
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB in bytes
		if (file.size > maxSize) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		const previewUrl = URL.createObjectURL(file);
		setBannerPreview(previewUrl);

		try {
			setIsUploadingBanner(true);

			const uploadUrl = await generateUploadUrl({}, { throwError: true });
			if (!uploadUrl) throw new Error("Failed to generate upload URL");

			const result = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!result.ok) {
				// Try to read response text for a more helpful error
				let resText = "";
				try {
					resText = await result.text();
				} catch (_e) {
					// ignore
				}
				throw new Error(
					`Upload failed: ${result.status} ${resText.slice(0, 200)}`
				);
			}

			let storageId: string | undefined;
			try {
				const json = await result.json();
				storageId = (json && (json.storageId || json.id || json.storage_id)) as
					| string
					| undefined;
			} catch (_e) {
				// If parsing failed, try to read text for debugging
				const text = await result.text();
				throw new Error(`Upload response parse failed: ${text.slice(0, 200)}`);
			}

			if (typeof storageId !== "string" || storageId.trim().length === 0) {
				throw new Error("Storage service did not return a valid storage id");
			}

			const bannerId = storageId.trim() as Id<"_storage">;

			// Update user profile with new banner
			await updateUser({ banner: bannerId });

			toast.success("Banner updated successfully!");
		} catch (error: any) {
			console.error("Banner upload error:", error);
			toast.error(
				error?.message || "Failed to upload banner. Please try again."
			);
		} finally {
			URL.revokeObjectURL(previewUrl);
			setBannerPreview(null);
			setIsUploadingBanner(false);

			if (bannerFileInputRef.current) {
				bannerFileInputRef.current.value = "";
			}
		}
	};

	const handleResetBanner = async () => {
		try {
			setIsUploadingBanner(true);
			await updateUser({ removeBanner: true });
			toast.success("Banner reset to default");
			setBannerPreview(null);

			// Refresh to ensure latest user data is fetched and UI updates
			try {
				router.refresh();
			} catch (e) {
				// as a fallback, reload the page
				console.warn("router.refresh failed, falling back to full reload", e);
				window.location.reload();
			}
		} catch (error) {
			console.error("Reset banner error:", error);
			toast.error("Failed to reset banner. Please try again.");
		} finally {
			setIsUploadingBanner(false);
		}
	};

	// Delete account handler
	const handleDeleteAccount = async () => {
		try {
			setIsDeleting(true);

			await deleteAccount();
			toast.success("Account deleted successfully");
			await signOut();
			router.replace("/");
		} catch (error) {
			console.error("Failed to delete account:", error);
			toast.error("Failed to delete account. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	// Compute left panel banner state and styles separately to avoid complex inline expressions
	const hasBanner = Boolean(bannerPreview || currentUser?.banner);
	const leftPanelClass = `w-80 p-6 border-r flex-shrink-0 relative ${hasBanner ? "bg-cover bg-center" : "bg-gradient-to-b from-primary/5 to-primary/10"}`;
	const leftPanelStyle = hasBanner
		? { backgroundImage: `url(${bannerPreview || currentUser?.banner})` }
		: undefined;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
				<div className="flex h-full overflow-hidden">
					{/* Left Panel - Profile Overview with banner */}
					<div className={leftPanelClass} style={leftPanelStyle}>
						{hasBanner && (
							<div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-primary/10 opacity-60 pointer-events-none" />
						)}

						{isEditMode && isEditing && (
							<div className="absolute top-3 right-3 z-20 flex items-center gap-2">
								<Button
									size="sm"
									variant="ghost"
									className="rounded-full size-8 p-0 shadow-md"
									onClick={handleResetBanner}
									aria-label="Reset banner"
									disabled={isUploadingBanner}
								>
									<Trash2 className="size-4" />
								</Button>

								<Button
									size="sm"
									variant="secondary"
									className="rounded-full size-8 p-0 shadow-md"
									onClick={handleBannerChange}
									aria-label="Change banner"
									disabled={isUploadingBanner}
								>
									{isUploadingBanner ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Camera className="size-4" />
									)}
								</Button>
							</div>
						)}

						<div className="flex flex-col items-center justify-center text-center h-full relative z-10">
							<div className="w-full max-w-xs bg-white/70 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/20 dark:border-slate-700/50">
								<div className="space-y-4 flex-1 flex flex-col items-center justify-center">
									<div className="relative">
										<Avatar className="size-24 ring-4 ring-white dark:ring-slate-700 shadow-lg">
											<AvatarImage
												src={
													avatarPreview ||
													image ||
													currentUser?.image ||
													undefined
												}
											/>
											<AvatarFallback className="text-2xl bg-primary/10 text-primary">
												{avatarFallback}
											</AvatarFallback>
										</Avatar>

										{isUploadingAvatar && (
											<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
												<Loader2 className="size-6 text-white animate-spin" />
											</div>
										)}

										{isEditMode && isEditing && (
											<Button
												size="sm"
												variant="secondary"
												className="absolute -bottom-1 -right-1 rounded-full size-8 p-0 z-10 shadow-md"
												onClick={handleAvatarChange}
												aria-label="Change avatar"
												disabled={isUploadingAvatar}
											>
												{isUploadingAvatar ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													<Camera className="size-4" />
												)}
											</Button>
										)}

										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											onChange={handleFileChange}
											className="hidden"
										/>

										<input
											ref={bannerFileInputRef}
											type="file"
											accept="image/*"
											onChange={handleBannerFileChange}
											className="hidden"
										/>
									</div>

									<div className="space-y-2">
										<h2 className="text-xl font-semibold">
											{displayName || currentUser?.name || "Unknown User"}
										</h2>
										<p className="text-sm text-muted-foreground">
											{currentUser?.email}
										</p>
										<Badge variant="secondary" className="text-xs">
											Member since {memberSince}
										</Badge>

										{isEditMode && !isEditing && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setIsEditing(true)}
												className="gap-2 mt-3"
											>
												<Edit3 className="size-4" />
												Edit Profile
											</Button>
										)}

										{isEditMode && isEditing && (
											<div className="flex flex-col gap-2 mt-3">
												<Button
													type="button"
													variant="outline"
													onClick={handleCancel}
													disabled={isUpdating}
													className="gap-2 w-full"
													size="sm"
												>
													<X className="size-4" />
													Cancel
												</Button>
												<Button
													type="submit"
													disabled={isUpdating || !hasChanges}
													className="gap-2 w-full"
													size="sm"
													form="profile-form"
												>
													<Save className="size-4" />
													{isUpdating ? "Saving..." : "Save Changes"}
												</Button>
											</div>
										)}
									</div>
								</div>
							</div>

							<div className="flex-shrink-0 flex flex-col justify-center space-y-4 w-full min-h-0 mt-6">
								{bio && (
									<p className="text-sm text-muted-foreground italic max-w-full break-words">
										"{bio}"
									</p>
								)}

								<div className="space-y-2 w-full">
									{location && (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<MapPin className="size-4 flex-shrink-0" />
											<span className="truncate">{location}</span>
										</div>
									)}
									{website && (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<Globe className="size-4 flex-shrink-0" />
											<a
												href={
													website.startsWith("http")
														? website
														: `https://${website}`
												}
												target="_blank"
												rel="noopener noreferrer"
												className="text-primary hover:underline truncate"
											>
												{website}
											</a>
										</div>
									)}
									{phone && (
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<Phone className="size-4 flex-shrink-0" />
											<span className="truncate">{phone}</span>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Right Panel - Content */}
					<div className="flex-1 flex flex-col overflow-hidden">
						<DialogHeader className="px-6 py-4 border-b flex-shrink-0">
							<DialogTitle className="text-2xl font-semibold">
								{isEditMode ? "Account Settings" : "Profile"}
							</DialogTitle>
						</DialogHeader>

						<div className="flex-1 overflow-y-auto min-w-0">
							{isEditMode ? (
								<div className="h-full flex flex-col overflow-hidden">
									<Tabs
										defaultValue={defaultTab}
										className="w-full h-full flex flex-col overflow-hidden"
									>
										<TabsList className="grid w-full grid-cols-2 mx-6 mt-4 flex-shrink-0">
											<TabsTrigger value="profile" className="gap-2">
												<User className="size-4" />
												Profile
											</TabsTrigger>
											<TabsTrigger value="notifications" className="gap-2">
												<Mail className="size-4" />
												Notifications
											</TabsTrigger>
										</TabsList>

										<TabsContent
											value="profile"
											className="flex-1 overflow-y-auto min-w-0 px-6"
											data-state="active"
										>
											<div className="py-6 space-y-6 max-w-none">
												{isEditing ? (
													<form
														id="profile-form"
														onSubmit={handleSubmit}
														className="space-y-6"
													>
														<Card>
															<CardHeader>
																<CardTitle className="flex items-center gap-2">
																	<User className="size-5" />
																	Personal Information
																</CardTitle>
																<CardDescription>
																	Update your personal details and profile
																	information
																</CardDescription>
															</CardHeader>
															<CardContent className="space-y-4">
																<div className="grid grid-cols-2 gap-4">
																	<div className="space-y-2">
																		<Label htmlFor="name">Display Name *</Label>
																		<Input
																			id="name"
																			value={displayName}
																			onChange={(e) =>
																				setDisplayName(e.target.value)
																			}
																			disabled={isUpdating}
																			required
																			placeholder="Enter your display name"
																		/>
																	</div>
																	<div className="space-y-2">
																		<Label htmlFor="email">Email Address</Label>
																		<Input
																			id="email"
																			value={currentUser?.email || ""}
																			disabled
																			readOnly
																			className="bg-muted"
																		/>
																		<p className="text-xs text-muted-foreground">
																			Email cannot be changed
																		</p>
																	</div>
																</div>

																<div className="space-y-2">
																	<Label htmlFor="bio">Bio</Label>
																	<Input
																		id="bio"
																		value={bio}
																		onChange={(e) => setBio(e.target.value)}
																		disabled={isUpdating}
																		placeholder="Tell us about yourself..."
																		maxLength={160}
																	/>
																	<p className="text-xs text-muted-foreground">
																		{bio.length}/160 characters
																	</p>
																</div>

																<div className="grid grid-cols-2 gap-4">
																	<div className="space-y-2">
																		<Label htmlFor="location">Location</Label>
																		<Input
																			id="location"
																			value={location}
																			onChange={(e) =>
																				setLocation(e.target.value)
																			}
																			disabled={isUpdating}
																			placeholder="City, Country"
																		/>
																	</div>
																	<div className="space-y-2">
																		<Label htmlFor="website">Website</Label>
																		<Input
																			id="website"
																			value={website}
																			onChange={(e) =>
																				setWebsite(e.target.value)
																			}
																			disabled={isUpdating}
																			placeholder="https://yourwebsite.com"
																		/>
																	</div>
																</div>

																<div className="space-y-2">
																	<Label htmlFor="phone">Phone Number</Label>
																	<Input
																		id="phone"
																		value={phone}
																		onChange={(e) => setPhone(e.target.value)}
																		disabled={isUpdating}
																		placeholder="+1 (555) 123-4567"
																	/>
																</div>
															</CardContent>
														</Card>

														<Card>
															<CardHeader>
																<CardTitle>Privacy Settings</CardTitle>
																<CardDescription>
																	Control your privacy and status visibility
																</CardDescription>
															</CardHeader>
															<CardContent className="space-y-6">
																<StatusTrackingSettings />
																<Separator />
																<StatusSelector />
															</CardContent>
														</Card>
													</form>
												) : (
													<div className="space-y-6">
														<Card>
															<CardHeader>
																<CardTitle>Profile Information</CardTitle>
																<CardDescription>
																	Your personal details and contact information
																</CardDescription>
															</CardHeader>
															<CardContent className="space-y-4">
																<div className="grid grid-cols-2 gap-6">
																	<div>
																		<Label className="text-sm font-medium text-muted-foreground">
																			Display Name
																		</Label>
																		<p className="text-sm font-medium">
																			{currentUser?.name || "Not set"}
																		</p>
																	</div>
																	<div>
																		<Label className="text-sm font-medium text-muted-foreground">
																			Email Address
																		</Label>
																		<p className="text-sm font-medium">
																			{currentUser?.email || "Not set"}
																		</p>
																	</div>
																</div>

																{((currentUser as any)?.bio ||
																	(currentUser as any)?.location ||
																	(currentUser as any)?.website ||
																	currentUser?.phone) && (
																	<>
																		<Separator />
																		<div className="grid grid-cols-2 gap-6">
																			{(currentUser as any)?.bio && (
																				<div className="col-span-2">
																					<Label className="text-sm font-medium text-muted-foreground">
																						Bio
																					</Label>
																					<p className="text-sm">
																						{(currentUser as any).bio}
																					</p>
																				</div>
																			)}
																			{(currentUser as any)?.location && (
																				<div>
																					<Label className="text-sm font-medium text-muted-foreground">
																						Location
																					</Label>
																					<p className="text-sm">
																						{(currentUser as any).location}
																					</p>
																				</div>
																			)}
																			{(currentUser as any)?.website && (
																				<div>
																					<Label className="text-sm font-medium text-muted-foreground">
																						Website
																					</Label>
																					<a
																						href={
																							(
																								currentUser as any
																							).website.startsWith("http")
																								? (currentUser as any).website
																								: `https://${(currentUser as any).website}`
																						}
																						target="_blank"
																						rel="noopener noreferrer"
																						className="text-sm text-primary hover:underline"
																					>
																						{(currentUser as any).website}
																					</a>
																				</div>
																			)}
																			{currentUser?.phone && (
																				<div>
																					<Label className="text-sm font-medium text-muted-foreground">
																						Phone
																					</Label>
																					<p className="text-sm">
																						{currentUser.phone}
																					</p>
																				</div>
																			)}
																		</div>
																	</>
																)}
															</CardContent>
														</Card>

														<Card>
															<CardHeader>
																<CardTitle>Privacy Settings</CardTitle>
															</CardHeader>
															<CardContent className="space-y-6">
																<StatusTrackingSettings />
																<Separator />
																<StatusSelector />
															</CardContent>
														</Card>

														{/* Password Change Form */}
														<PasswordChangeForm />

														<Card className="border-destructive/50">
															<CardHeader>
																<CardTitle className="text-destructive flex items-center gap-2">
																	<AlertTriangle className="size-5" />
																	Danger Zone
																</CardTitle>
																<CardDescription>
																	Permanently delete your account and all
																	associated data.
																</CardDescription>
															</CardHeader>
															<CardContent>
																<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
																	<div className="space-y-1">
																		<p className="text-sm font-medium">
																			Delete this account
																		</p>
																		<p className="text-sm text-muted-foreground">
																			This action cannot be undone. Your
																			workspaces, channels, messages, and other
																			data will be permanently deleted.
																		</p>
																	</div>
																	<Button
																		variant="destructive"
																		onClick={() => setDeleteDialogOpen(true)}
																		className="gap-2 whitespace-nowrap"
																	>
																		<Trash2 className="size-4" />
																		Delete Account
																	</Button>
																</div>
															</CardContent>
														</Card>
													</div>
												)}
											</div>
										</TabsContent>

										<TabsContent
											value="notifications"
											className="flex-1 overflow-y-auto min-w-0 px-6"
											data-state="inactive"
										>
											<div className="py-6">
												<NotificationSettings />
											</div>
										</TabsContent>
									</Tabs>
								</div>
							) : (
								<div className="p-6 h-full overflow-y-auto min-w-0">
									<Card>
										<CardHeader>
											<CardTitle>Contact Information</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="flex items-center gap-3">
												<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
													<Mail className="size-5 text-primary" />
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Email Address
													</p>
													{currentUser?.email ? (
														<a
															href={`mailto:${currentUser.email}`}
															className="text-sm font-medium text-primary hover:underline"
														>
															{currentUser.email}
														</a>
													) : (
														<p className="text-sm text-muted-foreground">
															No email available
														</p>
													)}
												</div>
											</div>

											{currentUser?.phone && (
												<div className="flex items-center gap-3">
													<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
														<Phone className="size-5 text-primary" />
													</div>
													<div>
														<p className="text-sm font-medium text-muted-foreground">
															Phone Number
														</p>
														<p className="text-sm font-medium">
															{currentUser.phone}
														</p>
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								</div>
							)}
						</div>
					</div>
				</div>
			</DialogContent>

			{/* Delete Account Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Account</DialogTitle>
						<DialogDescription>
							This action cannot be undone. This will permanently delete your
							account and remove all associated data.
						</DialogDescription>
					</DialogHeader>

					<div className="flex items-center gap-x-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						<AlertTriangle className="size-4" />
						<p>
							Warning: This will delete all your workspaces, channels, and
							messages.
						</p>
					</div>

					<div className="mt-4">
						<Label htmlFor="confirm-delete" className="text-sm font-medium">
							Type{" "}
							<span className="font-semibold text-destructive">
								delete my account
							</span>{" "}
							to confirm
						</Label>
						<Input
							id="confirm-delete"
							placeholder="Type 'delete my account' to confirm"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							disabled={isDeleting}
							className="mt-2"
							autoComplete="off"
						/>
						<p className="text-xs text-muted-foreground mt-2">
							This will permanently delete your account and all associated data.
						</p>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setDeleteDialogOpen(false);
								setConfirmText("");
							}}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteAccount}
							disabled={
								isDeleting ||
								confirmText.trim().toLowerCase() !== "delete my account"
							}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Deleting...
								</>
							) : (
								<>
									<Trash2 className="mr-2 size-4" />
									Delete Account
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Dialog>
	);
};
