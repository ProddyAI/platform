"use client";

import { CreditCard, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { BillingSection } from "@/features/billing/components/billing-section";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

export default function BillingPage() {
	useSetWorkspaceTitle(<WorkspaceTitle icon={CreditCard} label="Billing" />);

	const workspaceId = useWorkspaceId();
	const router = useRouter();
	const { data: member, isLoading } = useCurrentMember({ workspaceId });

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!member) {
		return (
			<div className="flex h-full items-center justify-center px-6">
				<div className="max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
					<h1 className="text-xl font-bold tracking-tight">Access denied</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						You need to be a workspace member to view billing.
					</p>
					<Button
						className="mt-4"
						onClick={() => router.push(`/workspace/${workspaceId}`)}
					>
						Back to workspace
					</Button>
				</div>
			</div>
		);
	}

	if (!workspaceId) {
		return null;
	}

	return (
		<PageShell className="max-w-5xl">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">
					Billing Management
				</h2>
				<p className="text-sm text-muted-foreground">
					Manage your subscription and seats
				</p>
			</div>
			<BillingSection
				currentMember={member}
				showBillingSummary={false}
				workspaceId={workspaceId}
			/>
		</PageShell>
	);
}
