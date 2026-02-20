"use client";

import { Database, Loader, Plug, Settings, Shield, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportDataManagement } from "@/features/manage/import-data-management";
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
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
					variant="ghost"
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
									currentMember={member}
									workspaceId={workspaceId}
								/>
							</div>
						</div>
					) : (
						/* For admins and owners, show all tabs */
						<Tabs className="w-full" defaultValue="workspace">
							<TabsList className="grid w-full grid-cols-4 mb-8">
								<TabsTrigger value="workspace">
									<Settings className="h-4 w-4 mr-2" />
									Workspace
								</TabsTrigger>
								<TabsTrigger value="members">
									<Users className="h-4 w-4 mr-2" />
									Members
								</TabsTrigger>
								<TabsTrigger value="integrations">
									<Plug className="h-4 w-4 mr-2" />
									AI Integrations
								</TabsTrigger>
								<TabsTrigger value="import">
									<Database className="h-4 w-4 mr-2" />
									Import Data
								</TabsTrigger>
							</TabsList>

							<TabsContent
								className="bg-background rounded-lg p-6 shadow-sm border"
								value="workspace"
							>
								<WorkspaceManagement
									currentMember={member}
									workspace={workspace}
								/>
							</TabsContent>

							<TabsContent
								className="bg-background rounded-lg p-6 shadow-sm border"
								value="members"
							>
								<MembersManagement
									currentMember={member}
									workspaceId={workspaceId}
								/>
							</TabsContent>

							<TabsContent
								className="bg-background rounded-lg p-6 shadow-sm border"
								value="integrations"
							>
								<IntegrationsManagement
									currentMember={member}
									workspaceId={workspaceId}
								/>
							</TabsContent>

							<TabsContent
								className="bg-background rounded-lg p-6 shadow-sm border"
								value="import"
							>
								<ImportDataManagement
									currentMember={member}
									workspaceId={workspaceId}
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
