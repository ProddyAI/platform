"use client";

import { useConvexAuth } from "convex/react";
import { Loader } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Script from "next/script";
import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { NavigationListener } from "@/components/navigation-listener";
import { MessageSelectionProvider } from "@/contexts/message-selection-context";
import { WorkspacePresenceTracker } from "@/features/presence/components/workspace-presence-tracker";
import { useUpdateLastActiveWorkspace } from "@/features/workspaces/api/use-update-last-active-workspace";
import { useSidebarCollapsed } from "@/features/workspaces/api/use-workspace-preferences";
import { useSidebarWidth } from "@/features/workspaces/hooks/use-sidebar-width";
import { usePanel } from "@/hooks/use-panel";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { setupGlobalMentionHandler } from "@/lib/client/mention-handler";

import { cn } from "@/lib/utils";

import { MobileFooter } from "./mobile-footer";
import { WorkspaceSidebar } from "./sidebar";
import { WorkspaceToolbar } from "./toolbar";
import { WorkspaceTitleProvider } from "./workspace-title-context";

const Thread = dynamic(
	() => import("@/features/messages/components/thread").then((m) => m.Thread),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		),
	}
);

const Profile = dynamic(
	() => import("@/features/members/components/profile").then((m) => m.Profile),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		),
	}
);

const SelectionModal = dynamic(
	() =>
		import("@/features/chats/components/selection-modal").then(
			(m) => m.SelectionModal
		),
	{ ssr: false }
);

const WorkspaceIdLayout = ({ children }: Readonly<PropsWithChildren>) => {
	const router = useRouter();
	const { parentMessageId, profileMemberId, onClose } = usePanel();
	const [isMobile, setIsMobile] = useState(false);
	const [showMobileSidebar, setShowMobileSidebar] = useState(false);
	const workspaceId = useWorkspaceId();
	const updateLastActiveWorkspace = useUpdateLastActiveWorkspace();

	// Redirect if workspaceId is "create" (which happens if user hits /workspace/create manually)
	useEffect(() => {
		if ((workspaceId as string | undefined) === "create") {
			router.replace("/workspace");
		}
	}, [workspaceId, router]);

	// Use the Convex-backed sidebar collapsed state
	const [isCollapsed, setIsCollapsed] = useSidebarCollapsed({
		workspaceId: workspaceId as Id<"workspaces">,
	});

	// Adjustable width (localStorage-backed) for the expanded sidebar.
	const { width, isResizing, startResizing, resetWidth } = useSidebarWidth();

	// Handle mobile menu toggle
	const handleMobileMenuToggle = useCallback(() => {
		if (isMobile) {
			setShowMobileSidebar((prev) => !prev);
			return;
		}

		setIsCollapsed(!isCollapsed);
	}, [isMobile, isCollapsed, setIsCollapsed]);

	const showPanel = Boolean(parentMessageId) || Boolean(profileMemberId);

	// Check if mobile on initial load and when window resizes
	useEffect(() => {
		const checkIfMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};

		// Check on initial load
		checkIfMobile();

		// Set up event listener for window resize
		window.addEventListener("resize", checkIfMobile);

		// Clean up event listener
		return () => window.removeEventListener("resize", checkIfMobile);
	}, []);

	// Collapse sidebar by default on mobile
	useEffect(() => {
		if (isMobile) {
			setIsCollapsed(true);
		}
	}, [isMobile, setIsCollapsed]);

	// Set up global mention handler
	useEffect(() => {
		setupGlobalMentionHandler();
	}, []);

	const { isAuthenticated, isLoading } = useConvexAuth();

	// Update last active workspace when the user visits a workspace
	useEffect(() => {
		if (workspaceId && !isLoading && isAuthenticated) {
			updateLastActiveWorkspace({ workspaceId });
		}
	}, [workspaceId, updateLastActiveWorkspace, isLoading, isAuthenticated]);

	return (
		<>
			<Script id="theme-init" strategy="beforeInteractive">
				{`
					try {
						const theme = localStorage.getItem('theme');
						if (theme === 'dark') {
							document.documentElement.classList.add('dark');
						} else {
							document.documentElement.classList.remove('dark');
						}
					} catch (e) {}
				`}
			</Script>
			<WorkspaceTitleProvider>
				<MessageSelectionProvider>
					<WorkspacePresenceTracker
						workspaceId={workspaceId as Id<"workspaces">}
					>
						<div className="size-full min-w-0 flex flex-col overflow-hidden">
							<div className="flex h-full min-w-0 overflow-hidden">
								{/* Adjustable-width sidebar with collapse/expand - Hidden on mobile */}
								<div
									className={cn(
										"h-full bg-sidebar overflow-y-auto overflow-x-hidden custom-scrollbar",
										"flex-shrink-0 relative z-10 hidden md:block",
										// Skip the width animation while actively dragging so the
										// sidebar tracks the pointer instead of lagging behind it.
										!isResizing && "transition-all duration-300 ease-in-out"
									)}
									style={{ width: isCollapsed ? 70 : width }}
								>
									<WorkspaceSidebar
										isCollapsed={isCollapsed}
										setIsCollapsed={setIsCollapsed}
									/>

									{/* Drag handle to resize the expanded sidebar. */}
									{!isCollapsed && (
										<div
											aria-hidden="true"
											className={cn(
												"absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize",
												"transition-colors hover:bg-primary/40",
												isResizing && "bg-primary/60"
											)}
											onDoubleClick={resetWidth}
											onMouseDown={startResizing}
										/>
									)}
								</div>

								{/* Mobile Sidebar Overlay */}
								{showMobileSidebar && (
									<>
										{/* Backdrop */}
										<button
											aria-label="Close mobile sidebar"
											className="md:hidden fixed inset-0 bg-black/50 z-40"
											onClick={() => setShowMobileSidebar(false)}
											type="button"
										/>
										{/* Sidebar Overlay */}
										<div
											className={cn(
												"md:hidden fixed left-0 z-50",
												"bg-sidebar overflow-y-auto overflow-x-hidden custom-scrollbar",
												"w-[280px] shadow-2xl",
												"transform transition-transform duration-300 ease-in-out",
												"overscroll-contain",
												"top-4 bottom-4",
												"rounded-r-2xl",
												showMobileSidebar
													? "translate-x-0"
													: "-translate-x-full"
											)}
											style={{
												WebkitOverflowScrolling: "touch",
											}}
										>
											{/* Mobile overlay: close via onMobileClose without mutating collapse state. */}
											<WorkspaceSidebar
												isCollapsed={false}
												onMobileClose={() => setShowMobileSidebar(false)}
												setIsCollapsed={setIsCollapsed}
											/>
										</div>
									</>
								)}

								{/* Main content area - remove overflow-auto to prevent toolbar scrolling */}
								<div className="flex-1 h-full min-w-0 flex flex-col overflow-x-hidden pb-24 md:pb-0">
									{(workspaceId as string | undefined) === "create" ? (
										<div className="flex h-full items-center justify-center">
											<Loader className="size-6 animate-spin text-muted-foreground" />
										</div>
									) : (
										<>
											{/* Mounted once here so search/notifications/theme-toggle/user-menu
											are available on every workspace route; pages only supply a title
											via useSetWorkspaceTitle. */}
											<WorkspaceToolbar />
											<div className="flex-1 min-h-0 flex flex-col">
												{children}
											</div>
										</>
									)}
								</div>

								{/* Right panel for threads and profiles - Hidden on mobile */}
								{showPanel && (
									<div className="hidden md:block w-[350px] h-full overflow-auto border-l border-border/30 flex-shrink-0 transition-all duration-300 ease-in-out">
										{parentMessageId ? (
											<Thread
												messageId={parentMessageId as Id<"messages">}
												onClose={onClose}
											/>
										) : profileMemberId ? (
											<Profile
												memberId={profileMemberId as Id<"members">}
												onClose={onClose}
											/>
										) : (
											<div className="flex h-full items-center justify-center">
												<Loader className="size-5 animate-spin text-muted-foreground" />
											</div>
										)}
									</div>
								)}
							</div>
							<MobileFooter onMenuClick={handleMobileMenuToggle} />
							<SelectionModal />
							<NavigationListener />
						</div>
					</WorkspacePresenceTracker>
				</MessageSelectionProvider>
			</WorkspaceTitleProvider>
		</>
	);
};

export default WorkspaceIdLayout;
