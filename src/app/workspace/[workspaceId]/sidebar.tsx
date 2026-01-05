"use client";

import {
  AlertTriangle,
  BarChart,
  CalendarIcon,
  ChevronDown,
  Loader,
  MessageSquareText,
  PlusIcon,
  SendHorizonal,
  Users,
  AtSign,
  Hash,
  PanelLeftClose,
  PanelLeftOpen,
  CheckSquare,
  Settings,
  LayoutDashboard,
  Bot,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useToggle } from "react-use";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useCreateChannelModal } from "@/features/channels/store/use-create-channel-modal";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useChannelId } from "@/hooks/use-channel-id";
import { useMemberId } from "@/hooks/use-member-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

import { WorkspaceHeader } from "./header";
import { SidebarItem, MemberItem, ChannelItem } from "./options";

// DroppableItem Component
interface DroppableItemProps {
  label: string;
  hint: string;
  icon: React.ElementType;
  onNew?: () => void;
  children: React.ReactNode;
  isCollapsed?: boolean;
  isExpanded: boolean;
  onToggle: (label: string) => void;
}

const DroppableItem = ({
  children,
  hint,
  label,
  icon: Icon,
  onNew,
  isCollapsed = false,
  isExpanded,
  onToggle,
}: DroppableItemProps) => {
  const handleToggle = () => {
    onToggle(label);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full",
        isCollapsed ? "px-1" : "px-2 md:px-4"
      )}
    >
      <div
        className="group flex w-full cursor-pointer items-center gap-x-2 md:gap-x-3 rounded-[10px] px-2 md:px-4 py-2.5 text-sm font-medium transition-standard text-secondary-foreground/80 hover:bg-secondary-foreground/10"
        onClick={handleToggle}
      >
        {isCollapsed ? (
          <div className="relative flex-shrink-0">
            <Hint label={label} side="right" align="center">
              <Icon className="size-4 md:size-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
            </Hint>
          </div>
        ) : (
          <Icon className="size-4 md:size-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
        )}

        {!isCollapsed && (
          <>
            <span className="truncate min-w-0">{label}</span>
            <ChevronDown
              className={cn(
                "ml-auto size-4 flex-shrink-0 transition-transform duration-200",
                !isExpanded && "-rotate-90"
              )}
            />

            {onNew && (
              <Hint label={hint} side="top" align="center">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNew();
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 flex-shrink-0 p-0 text-secondary-foreground/80 opacity-0 transition-all group-hover:opacity-100 rounded-[8px] hover:bg-secondary-foreground/10"
                >
                  <PlusIcon className="size-4 transition-transform duration-200 hover:scale-110" />
                </Button>
              </Hint>
            )}
          </>
        )}
      </div>

      {isExpanded && <div className="mt-2 space-y-1.5 pl-1 md:pl-2">{children}</div>}
    </div>
  );
};

// WorkspaceSidebar Component
export const WorkspaceSidebar = ({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}) => {
  const workspaceId = useWorkspaceId();
  const channelId = useChannelId();
  const memberId = useMemberId();
  const pathname = usePathname();
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Channels: true,  // Channels expanded by default
    Members: false   // Members collapsed by default
  });

  const [_open, setOpen] = useCreateChannelModal();

  const handleSectionToggle = (label: string) => {
    // If we're expanding a section, collapse all others
    if (!expandedSections[label]) {
      const newExpandedSections: Record<string, boolean> = {};

      // Set all sections to collapsed
      Object.keys(expandedSections).forEach(section => {
        newExpandedSections[section] = false;
      });

      // Expand only the clicked section
      newExpandedSections[label] = true;

      setExpandedSections(newExpandedSections);
    } else {
      // If we're collapsing a section, just toggle it
      setExpandedSections({
        ...expandedSections,
        [label]: !expandedSections[label]
      });
    }
  };

  const { data: member, isLoading: memberLoading } = useCurrentMember({
    workspaceId,
  });
  const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({
    id: workspaceId,
  });
  const { data: channels, isLoading: channelsLoading } = useGetChannels({
    workspaceId,
  });
  const { data: members, isLoading: membersLoading } = useGetMembers({
    workspaceId,
  });

  if (memberLoading || workspaceLoading || channelsLoading || membersLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-primary">
        <Loader className="size-6 animate-spin text-secondary-foreground animate-pulse-subtle" />
      </div>
    );
  }

  if (!workspace || !member) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-y-3 bg-primary">
        <AlertTriangle className="size-6 text-secondary-foreground animate-pulse-subtle" />
        <p className="text-sm font-medium text-secondary-foreground animate-fade-in">
          Workspace not found.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-primary transition-all duration-300 ease-in-out border-r-2 border-white/20 dark:border-border/40",
        isCollapsed ? "w-[70px]" : "w-[280px]"
      )}
    >
      {/* Workspace Header */}
      <div className="flex-shrink-0">
        <WorkspaceHeader
          workspace={workspace}
          isAdmin={member.role === "admin"}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Dashboard Link */}
      <div className="mt-4 px-2 md:px-4">
        <SidebarItem
          label="Dashboard"
          icon={LayoutDashboard}
          id="dashboard"
          href={`/workspace/${workspaceId}/dashboard`}
          isActive={pathname.includes("/dashboard")}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Proddy AI Link */}
      <div className="mt-2 px-2 md:px-4">
        <SidebarItem
          label="Proddy AI"
          icon={Bot}
          id="assistant"
          href={`/workspace/${workspaceId}/assistant`}
          isActive={pathname.includes("/assistant")}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Channels Section */}
      {channels && channels.length > 0 && (
        <div className="mt-2">
          <DroppableItem
            label="Channels"
            hint="Channels"
            icon={Hash}
            isCollapsed={isCollapsed}
            isExpanded={expandedSections.Channels}
            onToggle={handleSectionToggle}
          >
            {channels.map((item) => (
              <ChannelItem
                key={item._id}
                id={item._id}
                label={item.name}
                icon={item.icon}
                iconImageUrl={item.iconImageUrl}
                isActive={channelId === item._id}
                isCollapsed={isCollapsed}
              />
            ))}

            {/* New Channel option - only visible to admins and owners */}
            {(member.role === "admin" || member.role === "owner") && (
              <div
                className={cn(
                  "group flex items-center gap-2 md:gap-3 font-medium text-sm overflow-hidden rounded-[10px] transition-standard w-full text-secondary-foreground/80 hover:bg-secondary-foreground/10 hover:translate-x-1 cursor-pointer",
                  isCollapsed ? "justify-center px-1 md:px-2 py-2 md:py-2.5" : "justify-start px-2 md:px-4 py-2 md:py-2.5"
                )}
                onClick={() => setOpen(true)}
              >
                {isCollapsed ? (
                  <div className="relative flex-shrink-0">
                    <Hint label="New Channel" side="right" align="center">
                      <div className="flex items-center justify-center">
                        <PlusIcon className="size-4 text-secondary-foreground/80" />
                      </div>
                    </Hint>
                  </div>
                ) : (
                  <>
                    <PlusIcon className="size-4 text-secondary-foreground/80" />
                    <span className="truncate min-w-0">New Channel</span>
                  </>
                )}
              </div>
            )}
          </DroppableItem>
        </div>
      )}

      {/* Members Section */}
      {members && members.length > 0 && (
        <div className="mt-2">
          <DroppableItem
            label="Members"
            hint="Members"
            icon={Users}
            isCollapsed={isCollapsed}
            isExpanded={expandedSections.Members}
            onToggle={handleSectionToggle}
          >
            {members.map((item) => (
              <MemberItem
                key={item._id}
                id={item._id}
                label={item.user.name}
                image={item.user.image}
                isActive={item._id === memberId}
                isCollapsed={isCollapsed}
              />
            ))}
          </DroppableItem>
        </div>
      )}

      {/* Divider between dynamic and static sections */}
      <Separator className="my-4 mx-4 bg-secondary-foreground/10" />

      {/* Static Items */}
      <div className="flex flex-col gap-2 px-4">
        <SidebarItem
          label="Outbox"
          icon={SendHorizonal}
          id="outbox"
          href={`/workspace/${workspaceId}/outbox`}
          isActive={pathname.includes("/outbox")}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          label="Threads"
          icon={MessageSquareText}
          id="threads"
          href={`/workspace/${workspaceId}/threads`}
          isActive={pathname.includes("/threads")}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          label="Tasks"
          icon={CheckSquare}
          id="tasks"
          href={`/workspace/${workspaceId}/tasks`}
          isActive={pathname.includes("/tasks")}
          isCollapsed={isCollapsed}
        />
        <SidebarItem
          label="Calendar"
          icon={CalendarIcon}
          id="calendar"
          href={`/workspace/${workspaceId}/calendar`}
          isActive={pathname.includes("/calendar")}
          isCollapsed={isCollapsed}
        />
        {(member.role === "admin" || member.role === "owner") && (
          <SidebarItem
            label="Reports"
            icon={BarChart}
            id="reports"
            href={`/workspace/${workspaceId}/reports`}
            isActive={pathname.includes("/reports")}
            isCollapsed={isCollapsed}
          />
        )}
        <SidebarItem
          label="Manage"
          icon={Settings}
          id="manage"
          href={`/workspace/${workspaceId}/manage`}
          isActive={pathname.includes("/manage")}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Collapse/Expand Button */}
      <div className="mt-auto mb-4 flex justify-center">
        <Hint
          label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          side="right"
        >
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-secondary-foreground/10"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4 text-secondary-foreground/80" />
            ) : (
              <PanelLeftClose className="size-4 text-secondary-foreground/80" />
            )}
          </Button>
        </Hint>
      </div>
    </div>
  );
};
