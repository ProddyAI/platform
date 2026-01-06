"use client";

import { Hash, Loader, Plug, Settings, Shield, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelsManagement } from "@/features/manage/channels-management";
import { IntegrationsManagement } from "@/features/manage/integrations-management";
import { MembersManagement } from "@/features/manage/members-management";

import { WorkspaceManagement } from "@/features/manage/workspace-management";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

const ManagePage = () => {
	// Set document title
	useDocumentTitle("Manage Workspace");

	const workspaceId = useWorkspaceId();
	const _router = useRouter();

	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});
	const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({
		id: workspaceId,
	});

	if (memberLoading || workspaceLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!member || !workspace) {
		return (
			<div className="flex h-full flex-col items-center justify-center">
				<Shield className="h-12 w-12 text-muted-foreground mb-4" />
				<h2 className="text-2xl font-bold">Access Denied</h2>
				<p className="text-muted-foreground">
					You don't have permission to access this page.
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<WorkspaceToolbar>
				<Button
					variant="ghost"
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
				>
					<Settings className="mr-2 size-5" />
					<span className="truncate">Manage</span>
				</Button>
			</WorkspaceToolbar>

			{/* Content */}
			<div className="flex-1 overflow-auto p-6 bg-white">
				<div className="max-w-6xl mx-auto">
					{/* For members, show only Integrations */}
					{member.role === "member" ? (
						<div>
							<div className="mb-6">
								<h2 className="text-2xl font-bold mb-2">My Integrations</h2>
								<p className="text-muted-foreground">
									Connect and manage your personal integrations with external
									services. These connections are unique to you and will be used
									when you interact with Proddy AI and other features.
								</p>
							</div>
							<div className="bg-background rounded-lg p-6 shadow-sm border">
								<IntegrationsManagement
									workspaceId={workspaceId}
									currentMember={member}
								/>
							</div>
						</div>
					) : (
						/* For admins and owners, show all tabs */
						<Tabs defaultValue="integrations" className="w-full">
							<TabsList className="grid w-full grid-cols-4 mb-8">
								<TabsTrigger value="workspace">
									<Settings className="h-4 w-4 mr-2" />
									Workspace
								</TabsTrigger>
								<TabsTrigger value="channels">
									<Hash className="h-4 w-4 mr-2" />
									Channels
								</TabsTrigger>
								<TabsTrigger value="members">
									<Users className="h-4 w-4 mr-2" />
									Members
								</TabsTrigger>
								<TabsTrigger value="integrations">
									<Plug className="h-4 w-4 mr-2" />
									Integrations
								</TabsTrigger>
							</TabsList>

							<TabsContent
								value="workspace"
								className="bg-background rounded-lg p-6 shadow-sm border"
							>
								<WorkspaceManagement
									workspace={workspace}
									currentMember={member}
								/>
							</TabsContent>

							<TabsContent
								value="channels"
								className="bg-background rounded-lg p-6 shadow-sm border"
							>
								<ChannelsManagement
									workspaceId={workspaceId}
									currentMember={member}
								/>
							</TabsContent>

							<TabsContent
								value="members"
								className="bg-background rounded-lg p-6 shadow-sm border"
							>
								<MembersManagement
									workspaceId={workspaceId}
									currentMember={member}
								/>
							</TabsContent>

							<TabsContent
								value="integrations"
								className="bg-background rounded-lg p-6 shadow-sm border"
							>
								<IntegrationsManagement
									workspaceId={workspaceId}
									currentMember={member}
								/>
							</TabsContent>
						</Tabs>
					)}
				</div>
			</div>
		</div>
	);
};

export default ManagePage;
