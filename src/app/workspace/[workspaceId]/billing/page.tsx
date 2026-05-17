"use client";

import { ArrowLeft, CreditCard, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BillingSection } from "@/features/billing/components/BillingSection";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export default function BillingPage() {
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
		return null;
	}

	return (
		<div className="flex h-full flex-col bg-slate-50/50 dark:bg-transparent">
			{/* Premium Header */}
			<div className="flex items-center justify-between border-b bg-white dark:bg-slate-900/50 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
				<div className="flex items-center gap-4">
					<Button
						className="rounded-full"
						onClick={() => router.back()}
						size="icon"
						variant="ghost"
					>
						<ArrowLeft className="size-5" />
					</Button>
					<div className="flex items-center gap-3">
						<div className="p-2 bg-primary/10 rounded-lg">
							<CreditCard className="size-5 text-primary" />
						</div>
						<div>
							<h1 className="text-xl font-bold tracking-tight">
								Billing Management
							</h1>
							<p className="text-xs text-muted-foreground">
								Manage your subscription and seats
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-6 py-8">
				<div className="mx-auto max-w-5xl space-y-8">
					<BillingSection
						currentMember={member}
						showBillingSummary={false}
						workspaceId={workspaceId}
					/>
				</div>
			</div>
		</div>
	);
}
