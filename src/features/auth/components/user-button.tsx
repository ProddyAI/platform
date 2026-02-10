"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
	Activity,
	HelpCircle,
	HeartPulse,
	Loader,
	LogOut,
	Map,
	Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useCurrentUser } from "../api/use-current-user";
import { UserProfileModal } from "./user-profile-modal";
import { showTidioChat } from "@/lib/client/tidio-helpers";

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
	const roadmapUrl = process.env.NEXT_PUBLIC_ROADMAP_URL;
	const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL;
	const statusPageUrl = process.env.NEXT_PUBLIC_STATUS_URL;
	const hasRoadmapUrl = Boolean(roadmapUrl && roadmapUrl !== "#");
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

	const hasHelpLinks = true;

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

				<DropdownMenuContent align="center" className="w-60" side="bottom">
					<DropdownMenuItem
						className="h-10"
						onClick={() => setSettingsOpen(true)}
					>
						<Settings className="mr-2 size-4" />
						Account Settings
					</DropdownMenuItem>

					{hasHelpLinks && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuLabel>Help & Resources</DropdownMenuLabel>
						</>
					)}

					{hasRoadmapUrl && (
						<DropdownMenuItem
							onClick={() =>
								window.open(roadmapUrl, "_blank", "noopener,noreferrer")
							}
						>
							<Map className="mr-2 size-4" />
							Roadmap & Feedback
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
						<HeartPulse className="mr-2 size-4" />
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
					defaultTab={defaultTab}
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
