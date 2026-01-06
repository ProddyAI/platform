"use client";

import {
	Calendar,
	CheckCircle,
	Clock,
	MessageSquare,
	TrendingUp,
	Users,
	X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TestDailyRecapProps {
	onClose: () => void;
}

export const TestDailyRecap = ({ onClose }: TestDailyRecapProps) => {
	const today = new Date();
	const todayStr = today.toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const recapData = {
		totalMessages: 47,
		activeChats: 6,
		newContacts: 2,
		responseTime: "2.3 min",
		productivity: 85,
		highlights: [
			{
				type: "achievement",
				title: "Payment API Integration Complete",
				description:
					"Successfully completed Stripe webhook setup with Alex Rodriguez",
				time: "2:30 PM",
				participants: ["Alex Rodriguez"],
			},
			{
				type: "collaboration",
				title: "Team Sprint Planning",
				description: "Coordinated next sprint goals with development team",
				time: "11:45 AM",
				participants: ["Sarah Johnson", "Maya Patel", "David Kim"],
			},
			{
				type: "milestone",
				title: "Database Optimization Results",
				description: "40% performance improvement confirmed by Sarah",
				time: "9:15 AM",
				participants: ["Sarah Johnson"],
			},
		],
		topContacts: [
			{ name: "Alex Rodriguez", messages: 12, avatar: null },
			{ name: "Development Team", messages: 8, avatar: null },
			{ name: "Sarah Johnson", messages: 6, avatar: null },
			{ name: "Maya Patel", messages: 4, avatar: null },
		],
		upcomingTasks: [
			{
				task: "Demo payment integration",
				time: "Tomorrow 9:00 AM",
				priority: "high",
			},
			{
				task: "Review mobile wireframes",
				time: "Tomorrow 2:00 PM",
				priority: "medium",
			},
			{
				task: "Security audit follow-up",
				time: "Friday 10:00 AM",
				priority: "low",
			},
		],
	};

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase();
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "bg-red-100 text-red-800";
			case "medium":
				return "bg-yellow-100 text-yellow-800";
			case "low":
				return "bg-green-100 text-green-800";
			default:
				return "bg-gray-100 text-gray-800";
		}
	};

	const getHighlightIcon = (type: string) => {
		switch (type) {
			case "achievement":
				return <CheckCircle className="h-4 w-4 text-green-600" />;
			case "collaboration":
				return <Users className="h-4 w-4 text-blue-600" />;
			case "milestone":
				return <TrendingUp className="h-4 w-4 text-purple-600" />;
			default:
				return <MessageSquare className="h-4 w-4 text-gray-600" />;
		}
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b">
					<div className="flex items-center gap-3">
						<Calendar className="h-6 w-6 text-primary" />
						<div>
							<h2 className="text-xl font-semibold">Daily Recap</h2>
							<p className="text-sm text-muted-foreground">{todayStr}</p>
						</div>
					</div>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<ScrollArea className="flex-1">
					<div className="p-6 space-y-6">
						{/* Overview Stats */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<Card>
								<CardContent className="p-4 text-center">
									<MessageSquare className="h-8 w-8 text-primary mx-auto mb-2" />
									<div className="text-2xl font-bold">
										{recapData.totalMessages}
									</div>
									<div className="text-xs text-muted-foreground">
										Messages Sent
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="p-4 text-center">
									<Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
									<div className="text-2xl font-bold">
										{recapData.activeChats}
									</div>
									<div className="text-xs text-muted-foreground">
										Active Chats
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="p-4 text-center">
									<Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
									<div className="text-2xl font-bold">
										{recapData.responseTime}
									</div>
									<div className="text-xs text-muted-foreground">
										Avg Response
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="p-4 text-center">
									<TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
									<div className="text-2xl font-bold">
										{recapData.productivity}%
									</div>
									<div className="text-xs text-muted-foreground">
										Productivity
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Productivity Score */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Today's Productivity</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span>Communication Efficiency</span>
										<span>{recapData.productivity}%</span>
									</div>
									<Progress value={recapData.productivity} className="h-2" />
									<p className="text-xs text-muted-foreground">
										Great job! You responded quickly and maintained active
										conversations.
									</p>
								</div>
							</CardContent>
						</Card>

						<div className="grid md:grid-cols-2 gap-6">
							{/* Daily Highlights */}
							<Card>
								<CardHeader>
									<CardTitle className="text-lg">Daily Highlights</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{recapData.highlights.map((highlight, index) => (
											<div key={index} className="flex gap-3">
												<div className="flex-shrink-0 mt-1">
													{getHighlightIcon(highlight.type)}
												</div>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-sm">
														{highlight.title}
													</div>
													<div className="text-xs text-muted-foreground mb-2">
														{highlight.description}
													</div>
													<div className="flex items-center gap-2">
														<span className="text-xs text-muted-foreground">
															{highlight.time}
														</span>
														<div className="flex gap-1">
															{highlight.participants.map(
																(participant, pIndex) => (
																	<Badge
																		key={pIndex}
																		variant="secondary"
																		className="text-xs"
																	>
																		{participant}
																	</Badge>
																)
															)}
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>

							{/* Top Contacts */}
							<Card>
								<CardHeader>
									<CardTitle className="text-lg">
										Most Active Contacts
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{recapData.topContacts.map((contact, index) => (
											<div key={index} className="flex items-center gap-3">
												<Avatar className="h-8 w-8">
													<AvatarFallback className="text-xs">
														{getInitials(contact.name)}
													</AvatarFallback>
												</Avatar>
												<div className="flex-1">
													<div className="font-medium text-sm">
														{contact.name}
													</div>
													<div className="text-xs text-muted-foreground">
														{contact.messages} messages
													</div>
												</div>
												<Badge variant="outline" className="text-xs">
													#{index + 1}
												</Badge>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Upcoming Tasks */}
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Upcoming Tasks</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{recapData.upcomingTasks.map((task, index) => (
										<div
											key={index}
											className="flex items-center justify-between p-3 border rounded-lg"
										>
											<div className="flex-1">
												<div className="font-medium text-sm">{task.task}</div>
												<div className="text-xs text-muted-foreground">
													{task.time}
												</div>
											</div>
											<Badge className={getPriorityColor(task.priority)}>
												{task.priority}
											</Badge>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					</div>
				</ScrollArea>

				{/* Footer */}
				<div className="p-6 border-t bg-muted/30">
					<div className="flex items-center justify-between">
						<div className="text-sm text-muted-foreground">
							Recap generated at {new Date().toLocaleTimeString()}
						</div>
						<div className="flex gap-2">
							<Button variant="outline" size="sm">
								Export Report
							</Button>
							<Button onClick={onClose} size="sm">
								Close
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
