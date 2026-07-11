"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
	Activity,
	ChevronsUpDown,
	HelpCircle,
	Loader,
	LogOut,
	MessageCircle,
	MessageSquare,
	Settings,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showTidioChat } from "@/lib/client/tidio-helpers";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "../api/use-current-user";
import { UserProfileModal } from "./user-profile-modal";

// Removed useMarkOfflineGlobally - now handled by presence system

interface UserButtonProps {
	forceOpenSettings?: boolean;
	defaultTab?: "profile" | "notifications";
	onSettingsClose?: () => void;
	/** "avatar" = compact avatar trigger; "sidebar" = full-width account row. */
	variant?: "avatar" | "sidebar";
	/** For the sidebar variant, collapse to an avatar-only rail button. */
	isCollapsed?: boolean;
}

export const UserButton = ({
	forceOpenSettings = false,
	defaultTab = "profile",
	onSettingsClose,
	variant = "avatar",
	isCollapsed = false,
}: UserButtonProps = {}) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { signOut } = useAuthActions();
	const { data, isLoading } = useCurrentUser();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsTab, setSettingsTab] = useState<"profile" | "notifications">(
		defaultTab
	);

	// Self-handle the `?openUserSettings=profile|notifications` deep link so the
	// account menu can live anywhere (sidebar footer) without the toolbar wiring.
	useEffect(() => {
		const requested = searchParams.get("openUserSettings");
		if (requested === "profile" || requested === "notifications") {
			setSettingsTab(requested);
			setSettingsOpen(true);
			const url = new URL(window.location.href);
			url.searchParams.delete("openUserSettings");
			router.replace(url.pathname + url.search);
		}
	}, [searchParams, router]);
	const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
	const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL;
	const statusPageUrl = process.env.NEXT_PUBLIC_STATUS_URL;
	const hasFeedbackUrl = Boolean(feedbackUrl && feedbackUrl !== "#");
	const hasDocsUrl = Boolean(docsUrl && docsUrl !== "#");
	const hasStatusUrl = Boolean(statusPageUrl && statusPageUrl !== "#");

	// Handle external control for opening settings modal
	useEffect(() => {
		if (forceOpenSettings) {
			setSettingsOpen(true);
		}
	}, [forceOpenSettings]);

	// Handle settings modal close
	const handleSettingsClose = (open: boolean) => {
		setSettingsOpen(open);
		if (!open && onSettingsClose) {
			onSettingsClose();
		}
	};

	if (isLoading) {
		return <Loader className="size-4 animate-spin text-muted-foreground" />;
	}

	if (!data) {
		return null;
	}

	const { image, name, email } = data;
	const avatarFallback = name?.charAt(0).toUpperCase();

	const handleSignOut = async () => {
		// Presence system handles disconnection automatically
		await signOut();
		router.replace("/"); // Redirect to homepage after logout
	};

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger
					aria-label="Account menu"
					className={cn(
						"outline-none focus-visible:ring-2 focus-visible:ring-ring",
						variant === "sidebar"
							? cn(
									"group flex items-center rounded-full transition-standard hover:bg-sidebar-accent",
									isCollapsed
										? "mx-auto size-9 justify-center"
										: "w-full gap-3 px-2 py-1.5"
								)
							: "relative rounded-full"
					)}
				>
					<Avatar
						className={cn(
							"transition hover:opacity-75",
							variant === "sidebar" ? "size-8 flex-shrink-0" : "size-10"
						)}
					>
						<AvatarImage alt={name} src={image || undefined} />
						<AvatarFallback className="text-base">
							{avatarFallback}
						</AvatarFallback>
					</Avatar>
					{variant === "sidebar" && !isCollapsed && (
						<>
							<div className="flex min-w-0 flex-1 flex-col items-start text-left">
								<span className="w-full truncate text-sm font-medium text-foreground">
									{name}
								</span>
								<span className="w-full truncate text-xs text-muted-foreground">
									{email}
								</span>
							</div>
							<ChevronsUpDown className="size-4 flex-shrink-0 text-muted-foreground/70" />
						</>
					)}
				</DropdownMenuTrigger>

				<DropdownMenuContent
					align={variant === "sidebar" ? "start" : "center"}
					className="w-60"
					side={variant === "sidebar" ? "top" : "bottom"}
				>
					<DropdownMenuItem
						className="h-10"
						onClick={() => setSettingsOpen(true)}
					>
						<Settings className="mr-2 size-4" />
						Account Settings
					</DropdownMenuItem>

					<DropdownMenuSeparator />
					<DropdownMenuLabel>Help & Resources</DropdownMenuLabel>

					{hasFeedbackUrl && (
						<DropdownMenuItem
							onClick={() =>
								window.open(feedbackUrl, "_blank", "noopener,noreferrer")
							}
						>
							<MessageSquare className="mr-2 size-4" />
							Feedback
						</DropdownMenuItem>
					)}

					{hasDocsUrl && (
						<DropdownMenuItem
							onClick={() =>
								window.open(docsUrl, "_blank", "noopener,noreferrer")
							}
						>
							<HelpCircle className="mr-2 size-4" />
							Documentation
						</DropdownMenuItem>
					)}

					<DropdownMenuItem onClick={showTidioChat}>
						<MessageCircle className="mr-2 size-4" />
						Chat Support
					</DropdownMenuItem>

					{hasStatusUrl && (
						<DropdownMenuItem
							onClick={() =>
								window.open(statusPageUrl, "_blank", "noopener,noreferrer")
							}
						>
							<Activity className="mr-2 size-4" />
							System Status
						</DropdownMenuItem>
					)}

					<DropdownMenuSeparator />

					<DropdownMenuItem className="h-10" onClick={handleSignOut}>
						<LogOut className="mr-2 size-4" />
						Log out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Account Settings Modal */}
			{data && (
				<UserProfileModal
					defaultTab={settingsTab}
					email={email}
					image={image || undefined}
					mode="edit"
					name={name}
					onOpenChange={handleSettingsClose}
					open={settingsOpen}
				/>
			)}
		</>
	);
};
