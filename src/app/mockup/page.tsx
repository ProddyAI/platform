"use client";

import {
	Calendar,
	Clock,
	ExternalLink,
	FileText,
	Kanban,
	LayoutDashboard,
	MessageSquare,
	Palette,
	Search,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDocumentTitle } from "@/hooks/use-document-title";

interface TestPage {
	id: string;
	title: string;
	description: string;
	icon: React.ReactNode;
	route: string;
	status: "live" | "beta" | "new";
	features: string[];
	color: string;
	gradient: string;
}

const MockupPage = () => {
	useDocumentTitle("Proddy Mockups");
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");

	const testPages: TestPage[] = [
		{
			id: "dashboard",
			title: "AI Dashboard",
			description:
				"Intelligent workspace overview with AI-powered insights and team collaboration tools.",
			icon: <LayoutDashboard className="h-6 w-6" />,
			route: "/mockup/dashboard",
			status: "live",
			features: [
				"AI Chatbot",
				"Team Status",
				"Smart Widgets",
				"Real-time Updates",
			],
			color: "text-blue-600",
			gradient: "from-blue-500 to-cyan-500",
		},
		{
			id: "calendar",
			title: "Smart Calendar",
			description:
				"Advanced calendar with event management, team scheduling, and intelligent notifications.",
			icon: <Calendar className="h-6 w-6" />,
			route: "/mockup/calendar",
			status: "live",
			features: [
				"Event Management",
				"Team Scheduling",
				"Smart Filters",
				"Board Integration",
			],
			color: "text-green-600",
			gradient: "from-green-500 to-emerald-500",
		},
		{
			id: "board",
			title: "Project Boards",
			description:
				"Kanban-style project management with drag-and-drop functionality and team collaboration.",
			icon: <Kanban className="h-6 w-6" />,
			route: "/mockup/board",
			status: "live",
			features: [
				"Kanban Boards",
				"Drag & Drop",
				"Card Management",
				"Team Collaboration",
			],
			color: "text-purple-600",
			gradient: "from-purple-500 to-pink-500",
		},
		{
			id: "notes",
			title: "Collaborative Notes",
			description:
				"Rich text editor with live collaboration, hierarchical organization, and visual brainstorming.",
			icon: <FileText className="h-6 w-6" />,
			route: "/mockup/notes",
			status: "beta",
			features: [
				"Rich Text Editor",
				"Live Collaboration",
				"Visual Links",
				"Hierarchical Structure",
			],
			color: "text-orange-600",
			gradient: "from-orange-500 to-red-500",
		},
		{
			id: "canvas",
			title: "Visual Canvas",
			description:
				"Interactive whiteboard with real-time collaboration, audio rooms, and integrated chat.",
			icon: <Palette className="h-6 w-6" />,
			route: "/mockup/canvas",
			status: "new",
			features: [
				"Interactive Whiteboard",
				"Audio Rooms",
				"Live Chat",
				"Real-time Collaboration",
			],
			color: "text-pink-600",
			gradient: "from-pink-500 to-rose-500",
		},
		{
			id: "chats",
			title: "Team Communication",
			description:
				"Advanced messaging system with smart replies, file sharing, and conversation management.",
			icon: <MessageSquare className="h-6 w-6" />,
			route: "/mockup/chats",
			status: "live",
			features: [
				"Smart Replies",
				"File Sharing",
				"Thread Management",
				"Real-time Messaging",
			],
			color: "text-indigo-600",
			gradient: "from-indigo-500 to-blue-500",
		},
	];

	const filteredPages = testPages.filter(
		(page) =>
			page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			page.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
			page.features.some((feature) =>
				feature.toLowerCase().includes(searchQuery.toLowerCase())
			)
	);

	const handlePageClick = (route: string) => {
		router.push(route);
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "live":
				return (
					<Badge className="bg-green-100 text-green-700 hover:bg-green-100">
						Live
					</Badge>
				);
			case "beta":
				return (
					<Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
						Beta
					</Badge>
				);
			case "new":
				return (
					<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
						New
					</Badge>
				);
			default:
				return null;
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 sticky top-0 z-10">
				<div className="max-w-7xl mx-auto px-6 py-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
								<Sparkles className="h-6 w-6 text-white" />
							</div>
							<div>
								<h1 className="text-2xl font-bold text-gray-900">
									Proddy Mockups
								</h1>
								<p className="text-sm text-gray-600">
									Interactive prototypes and test environments
								</p>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
								<Input
									className="pl-10 w-64"
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search mockups..."
									value={searchQuery}
								/>
							</div>
							<Badge className="flex items-center gap-1" variant="outline">
								<Users className="h-3 w-3" />
								{testPages.length} Mockups
							</Badge>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="max-w-7xl mx-auto px-6 py-8">
				{/* Stats */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<div className="bg-white rounded-lg border border-gray-200 p-6">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
								<Zap className="h-5 w-5 text-green-600" />
							</div>
							<div>
								<p className="text-2xl font-bold text-gray-900">
									{testPages.filter((p) => p.status === "live").length}
								</p>
								<p className="text-sm text-gray-600">Live Mockups</p>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-lg border border-gray-200 p-6">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
								<Clock className="h-5 w-5 text-blue-600" />
							</div>
							<div>
								<p className="text-2xl font-bold text-gray-900">
									{testPages.filter((p) => p.status === "beta").length}
								</p>
								<p className="text-sm text-gray-600">In Development</p>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-lg border border-gray-200 p-6">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
								<Sparkles className="h-5 w-5 text-purple-600" />
							</div>
							<div>
								<p className="text-2xl font-bold text-gray-900">
									{testPages.filter((p) => p.status === "new").length}
								</p>
								<p className="text-sm text-gray-600">New Features</p>
							</div>
						</div>
					</div>
				</div>

				{/* Mockup Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredPages.map((page) => (
						<Card
							className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md hover:scale-105 overflow-hidden"
							key={page.id}
							onClick={() => handlePageClick(page.route)}
						>
							{/* Gradient Header */}
							<div
								className={`h-32 bg-gradient-to-br ${page.gradient} relative overflow-hidden`}
							>
								<div className="absolute inset-0 bg-black/10" />
								<div className="absolute top-4 left-4 text-white">
									{page.icon}
								</div>
								<div className="absolute top-4 right-4">
									{getStatusBadge(page.status)}
								</div>
								<div className="absolute bottom-4 left-4 text-white">
									<h3 className="text-lg font-semibold">{page.title}</h3>
								</div>
							</div>

							<CardContent className="p-6">
								<CardDescription className="text-gray-600 mb-4 line-clamp-2">
									{page.description}
								</CardDescription>

								{/* Features */}
								<div className="space-y-3 mb-6">
									<p className="text-sm font-medium text-gray-900">
										Key Features:
									</p>
									<div className="flex flex-wrap gap-2">
										{page.features.map((feature, index) => (
											<Badge
												className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-100"
												key={index}
												variant="secondary"
											>
												{feature}
											</Badge>
										))}
									</div>
								</div>

								{/* Action Button */}
								<Button
									className="w-full group-hover:bg-primary group-hover:text-white transition-colors"
									variant="outline"
								>
									<ExternalLink className="h-4 w-4 mr-2" />
									View Mockup
								</Button>
							</CardContent>
						</Card>
					))}
				</div>

				{/* No Results */}
				{filteredPages.length === 0 && (
					<div className="text-center py-12">
						<div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
							<Search className="h-8 w-8 text-gray-400" />
						</div>
						<h3 className="text-lg font-medium text-gray-900 mb-2">
							No mockups found
						</h3>
						<p className="text-gray-600">
							Try adjusting your search terms or browse all available mockups.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default MockupPage;
