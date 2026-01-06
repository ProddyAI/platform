"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Loader, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "../api/use-current-user";
import { UserProfileModal } from "./user-profile-modal";

// Removed useMarkOfflineGlobally - now handled by presence system

interface UserButtonProps {
	forceOpenSettings?: boolean;
	defaultTab?: "profile" | "notifications";
	onSettingsClose?: () => void;
}

export const UserButton = ({
	forceOpenSettings = false,
	defaultTab = "profile",
	onSettingsClose,
}: UserButtonProps = {}) => {
	const router = useRouter();
	const { signOut } = useAuthActions();
	const { data, isLoading } = useCurrentUser();
	const [settingsOpen, setSettingsOpen] = useState(false);

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
				<DropdownMenuTrigger className="relative outline-none">
					<Avatar className="size-10 transition hover:opacity-75">
						<AvatarImage alt={name} src={image || undefined} />
						<AvatarFallback className="text-base">
							{avatarFallback}
						</AvatarFallback>
					</Avatar>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="center" side="bottom" className="w-60">
					<DropdownMenuItem
						onClick={() => setSettingsOpen(true)}
						className="h-10"
					>
						<Settings className="mr-2 size-4" />
						Account Settings
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={handleSignOut} className="h-10">
						<LogOut className="mr-2 size-4" />
						Log out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Account Settings Modal */}
			{data && (
				<UserProfileModal
					open={settingsOpen}
					onOpenChange={handleSettingsClose}
					name={name}
					email={email}
					image={image || undefined}
					mode="edit"
					defaultTab={defaultTab}
				/>
			)}
		</>
	);
};
