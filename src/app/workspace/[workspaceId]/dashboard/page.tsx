"use client";

import dynamic from "next/dynamic";
import { Loader } from "lucide-react";

const DashboardContent = dynamic(() => import("./dashboard-content"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center">
			<Loader className="size-6 animate-spin text-muted-foreground" />
		</div>
	),
});

export default function DashboardPage() {
	return <DashboardContent />;
}
