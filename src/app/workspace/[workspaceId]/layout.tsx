"use client";

import { Loader } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { SelectionModal } from "@/features/chats/components/selection-modal";
import { MessageSelectionProvider } from "@/features/smart/contexts/message-selection-context";
import { Profile } from "@/features/members/components/profile";
import { Thread } from "@/features/messages/components/thread";
import { WorkspacePresenceTracker } from "@/features/presence/components/workspace-presence-tracker";
import { useUpdateLastActiveWorkspace } from "@/features/workspaces/api/use-update-last-active-workspace";
import { useSidebarCollapsed } from "@/features/workspaces/api/use-workspace-preferences";
import { usePanel } from "@/hooks/use-panel";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { setupGlobalMentionHandler } from "@/lib/mention-handler";
import { NavigationListener } from "@/components/navigation-listener";

import { cn } from "@/lib/utils";

import { WorkspaceSidebar } from "./sidebar";

const WorkspaceIdLayout = ({ children }: Readonly<PropsWithChildren>) => {
  const { parentMessageId, profileMemberId, onClose } = usePanel();
  const [isMobile, setIsMobile] = useState(false);
  const workspaceId = useWorkspaceId();
  const updateLastActiveWorkspace = useUpdateLastActiveWorkspace();

  // Use the Convex-backed sidebar collapsed state
  const [isCollapsed, setIsCollapsed] = useSidebarCollapsed({ workspaceId });

  const showPanel = !!parentMessageId || !!profileMemberId;

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

  // Update last active workspace when the user visits a workspace
  useEffect(() => {
    if (workspaceId) {
      updateLastActiveWorkspace({ workspaceId });
    }
  }, [workspaceId, updateLastActiveWorkspace]);

  return (
    <MessageSelectionProvider>
      <WorkspacePresenceTracker workspaceId={workspaceId}>
        <div className="h-full flex flex-col">
          <div className="flex h-full">
            {/* Fixed-width sidebar with collapse/expand functionality */}
            <div
              className={cn(
                "h-full bg-primary/50 overflow-y-auto overflow-x-hidden",
                "transition-all duration-300 ease-in-out flex-shrink-0 relative z-10",
                isCollapsed ? "w-[70px]" : "w-[280px]"
              )}
            >
              <WorkspaceSidebar
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
              />
            </div>

            {/* Main content area - remove overflow-auto to prevent toolbar scrolling */}
            <div className="flex-1 h-full flex flex-col">{children}</div>

            {/* Right panel for threads and profiles */}
            {showPanel && (
              <div className="w-[350px] h-full overflow-auto border-l border-border/30 flex-shrink-0 transition-all duration-300 ease-in-out">
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
          <SelectionModal />
          <NavigationListener />
        </div>
      </WorkspacePresenceTracker>
    </MessageSelectionProvider>
  );
};

export default WorkspaceIdLayout;
