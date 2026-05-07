"use client";

import { CreditCard } from "lucide-react";
import { BillingSection } from "@/features/billing/components/BillingSection";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export default function BillingPage() {
	const workspaceId = useWorkspaceId();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-3 border-b px-6 py-4">
				<CreditCard className="size-6 text-primary" />
				<h1 className="text-xl font-semibold">Billing</h1>
			</div>
			<div className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto max-w-4xl">
					<BillingSection workspaceId={workspaceId} />
				</div>
			</div>
		</div>
	);
}
