"use client";

import {
	CreditCard,
	Database,
	Loader,
	Plug,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingSection } from "@/features/billing/components/billing-section";
import { ImportDataManagement } from "@/features/manage/components/import-data-management";
import { IntegrationsManagement } from "@/features/manage/components/integrations-management";
import { MembersManagement } from "@/features/manage/components/members-management";
import { WorkspaceManagement } from "@/features/manage/components/workspace-management";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

const MANAGE_TABS = [
	"workspace",
	"members",
	"billing",
	"integrations",
	"import",
] as const;

type ManageTab = (typeof MANAGE_TABS)[number];

function getTabFromLocation(): ManageTab {
	if (typeof window === "undefined") return "workspace";

	const hashTab = window.location.hash.replace("#", "");
	if (MANAGE_TABS.includes(hashTab as ManageTab)) {
		return hashTab as ManageTab;
	}

	const params = new URLSearchParams(window.location.search);
	const queryTab = params.get("tab");
	if (queryTab && MANAGE_TABS.includes(queryTab as ManageTab)) {
		return queryTab as ManageTab;
	}

	// Payment providers may return status params. Default to billing tab in that flow.
	if (
		params.has("subscription_id") ||
		params.has("status") ||
		params.has("email")
	) {
		return "billing";
	}

	if (params.has("connected") && params.get("connected") === "true") {
		return "integrations";
	}

	return "workspace";
}

const ManagePage = () => {
	// Set document title
	useDocumentTitle("Manage Workspace");

	useSetWorkspaceTitle(<WorkspaceTitle icon={Settings} label="Manage" />);

	const workspaceId = useWorkspaceId();
	const [activeTab, setActiveTab] = useState<ManageTab>("workspace");

	useEffect(() => {
		const syncTabFromUrl = () => {
			setActiveTab(getTabFromLocation());
		};

		syncTabFromUrl();
		window.addEventListener("hashchange", syncTabFromUrl);

		return () => {
			window.removeEventListener("hashchange", syncTabFromUrl);
		};
	}, []);

	const handleTabChange = (value: string) => {
		const nextTab = value as ManageTab;
		if (!MANAGE_TABS.includes(nextTab)) return;

		setActiveTab(nextTab);
		if (typeof window !== "undefined") {
			window.history.replaceState(
				null,
				"",
				`${window.location.pathname}${window.location.search}#${nextTab}`
			);
		}
	};

	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});
	const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({
		id: workspaceId,
	});

	if (memberLoading || workspaceLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!workspaceId || !member || !workspace) {
		return (
			<div className="flex h-full flex-col items-center justify-center">
				<Shield className="size-12 text-muted-foreground mb-4" />
				<h2 className="text-2xl font-semibold tracking-tight">Access Denied</h2>
				<p className="text-muted-foreground">
					You don&apos;t have permission to access this page.
				</p>
			</div>
		);
	}

	return (
		<PageShell>
			{/* For members, show only Integrations */}
			{member.role === "member" ? (
				<div>
					<div className="mb-6">
						<h2 className="text-2xl font-semibold tracking-tight mb-2">
							My Integrations
						</h2>
						<p className="text-muted-foreground">
							Connect and manage your personal integrations with external
							services. These connections are unique to you and will be used
							when you interact with Proddy AI and other features.
						</p>
					</div>
					<div className="bg-card rounded-2xl p-6 shadow-sm border">
						<IntegrationsManagement
							currentMember={member}
							workspaceId={workspaceId}
						/>
					</div>
				</div>
			) : (
				/* For admins and owners, show all tabs */
				<Tabs
					className="w-full"
					onValueChange={handleTabChange}
					value={activeTab}
				>
					<TabsList className="grid w-full grid-cols-5 mb-8">
						<TabsTrigger value="workspace">
							<Settings className="size-4 mr-2" />
							Workspace
						</TabsTrigger>
						<TabsTrigger value="members">
							<Users className="size-4 mr-2" />
							Members
						</TabsTrigger>
						<TabsTrigger value="billing">
							<CreditCard className="size-4 mr-2" />
							Billing
						</TabsTrigger>
						<TabsTrigger value="integrations">
							<Plug className="size-4 mr-2" />
							AI Integrations
						</TabsTrigger>
						<TabsTrigger value="import">
							<Database className="size-4 mr-2" />
							Import Data
						</TabsTrigger>
					</TabsList>

					<TabsContent
						className="bg-card rounded-2xl p-6 shadow-sm border"
						value="workspace"
					>
						<WorkspaceManagement currentMember={member} workspace={workspace} />
					</TabsContent>

					<TabsContent
						className="bg-card rounded-2xl p-6 shadow-sm border"
						value="members"
					>
						<MembersManagement
							currentMember={member}
							workspaceId={workspaceId}
						/>
					</TabsContent>

					<TabsContent
						className="bg-card rounded-2xl p-6 shadow-sm border"
						value="billing"
					>
						<BillingSection currentMember={member} workspaceId={workspaceId} />
					</TabsContent>

					<TabsContent
						className="bg-card rounded-2xl p-6 shadow-sm border"
						value="integrations"
					>
						<IntegrationsManagement
							currentMember={member}
							workspaceId={workspaceId}
						/>
					</TabsContent>

					<TabsContent
						className="bg-card rounded-2xl p-6 shadow-sm border"
						value="import"
					>
						<ImportDataManagement
							currentMember={member}
							workspaceId={workspaceId}
						/>
					</TabsContent>
				</Tabs>
			)}
		</PageShell>
	);
};

export default ManagePage;
