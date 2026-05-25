"use client";

import { Loader } from "lucide-react";
import dynamic from "next/dynamic";

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
