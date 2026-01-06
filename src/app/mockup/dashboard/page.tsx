"use client";

import { LayoutDashboard } from "lucide-react";
import { TestDashboardChatbot } from "@/app/mockup/components/test-dashboard-chatbot";
import { TestDashboardWidgets } from "@/app/mockup/components/test-dashboard-widgets";
import {
	TestLiveCursors,
	useTestLiveCursors,
} from "@/app/mockup/components/test-live-cursors";
import { TestNavigation } from "@/app/mockup/components/test-navigation";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

const TestDashboardPage = () => {
	useDocumentTitle("Dashboard");
	const { showCursors } = useTestLiveCursors(true);

	return (
		<div className="flex h-full flex-col relative">
			<div className="border-b bg-primary p-4">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
						size="sm"
					>
						<LayoutDashboard className="mr-2 size-5" />
						<span className="truncate">Dashboard</span>
					</Button>

					<TestNavigation />
				</div>
			</div>
			<div className="flex flex-1 overflow-hidden">
				<div className="flex w-full flex-col space-y-6 md:flex-row md:space-x-6 md:space-y-0 p-4 md:p-6">
					{/* Chatbot section - 40% width on desktop, fixed height */}
					<div className="w-full md:w-[40%] flex flex-col">
						<TestDashboardChatbot />
					</div>

					{/* Widgets section - 60% width on desktop, scrollable */}
					<div className="w-full md:w-[60%] flex flex-col overflow-auto">
						<TestDashboardWidgets />
					</div>
				</div>
			</div>

			{/* Live Cursors */}
			<TestLiveCursors enabled={showCursors} maxCursors={3} />
		</div>
	);
};

export default TestDashboardPage;
