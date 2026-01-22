"use client";

import {
	AlertTriangle,
	Calendar,
	CheckSquare,
	Circle,
	CircleCheck,
	Clock,
	ExternalLink,
	FileText,
	Mail,
	MessageSquare,
	Palette,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export const TestDashboardWidgets = () => {
	const router = useRouter();

	const handleViewAllEvents = () => {
		router.push("/mockup/calendar");
	};

	const handleViewBoard = () => {
		router.push("/mockup/board");
	};

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{/* Calendar Widget */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Calendar className="h-5 w-5 text-primary" />
							<CardTitle className="text-lg">Upcoming Events</CardTitle>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={handleViewAllEvents}
							className="flex items-center gap-2"
						>
							<ExternalLink className="h-4 w-4" />
							View Calendar
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[200px]">
						<div className="space-y-3">
							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<div className="flex flex-col items-center text-center min-w-[50px]">
									<div className="text-xs text-muted-foreground">DEC</div>
									<div className="text-lg font-bold">20</div>
									<div className="text-xs text-muted-foreground">10:00</div>
								</div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										Sprint Planning - Q2 Feature Development
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Conference Room A
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="default" className="text-xs">
											High Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Meeting
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<div className="flex flex-col items-center text-center min-w-[50px]">
									<div className="text-xs text-muted-foreground">DEC</div>
									<div className="text-lg font-bold">20</div>
									<div className="text-xs text-muted-foreground">14:30</div>
								</div>
								<div className="flex-1">
									<div className="font-medium text-sm">Stakeholder Review</div>
									<div className="text-xs text-muted-foreground mt-1">
										Zoom Call
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="default" className="text-xs">
											High Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Meeting
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<div className="flex flex-col items-center text-center min-w-[50px]">
									<div className="text-xs text-muted-foreground">DEC</div>
									<div className="text-lg font-bold">21</div>
									<div className="text-xs text-muted-foreground">17:00</div>
								</div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										Payment API Testing Deadline
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Remote
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="destructive" className="text-xs">
											High Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Deadline
										</Badge>
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Mentions Widget */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5 text-primary" />
						<CardTitle className="text-lg">Recent Mentions</CardTitle>
						<Badge variant="destructive">2</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[200px]">
						<div className="space-y-3">
							<div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
								<Avatar className="h-8 w-8">
									<AvatarFallback>LC</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">Lisa Chen</span>
										<span className="text-xs text-muted-foreground">
											2 hours ago
										</span>
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										@you Can you review the sprint planning agenda before
										tomorrow's meeting?
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										#sprint-planning
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
								<Avatar className="h-8 w-8">
									<AvatarFallback>SJ</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">Sarah Johnson</span>
										<span className="text-xs text-muted-foreground">
											4 hours ago
										</span>
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										@you Need your input on the database performance issue. Can
										you join the incident call?
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										#incident-response
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<Avatar className="h-8 w-8">
									<AvatarFallback>AR</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">Alex Rodriguez</span>
										<span className="text-xs text-muted-foreground">
											1 day ago
										</span>
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										@you Great work on the API documentation! Ready for review.
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										#development
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Thread Replies Widget */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center gap-2">
						<Mail className="h-5 w-5 text-primary" />
						<CardTitle className="text-lg">Thread Replies</CardTitle>
						<Badge variant="secondary">5</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[200px]">
						<div className="space-y-3">
							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<Avatar className="h-8 w-8">
									<AvatarFallback>MP</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">Maya Patel</span>
										<span className="text-xs text-muted-foreground">
											1 hour ago
										</span>
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Replied to: "Mobile app wireframes feedback"
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										#design-review
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<Avatar className="h-8 w-8">
									<AvatarFallback>DK</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">David Kim</span>
										<span className="text-xs text-muted-foreground">
											3 hours ago
										</span>
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Replied to: "Client demo preparation checklist"
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										#client-demo
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<Avatar className="h-8 w-8">
									<AvatarFallback>JS</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm">Jordan Smith</span>
										<span className="text-xs text-muted-foreground">
											5 hours ago
										</span>
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										Replied to: "Payment API integration status"
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										#payment-api
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Tasks Widget */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center gap-2">
						<CheckSquare className="h-5 w-5 text-primary" />
						<CardTitle className="text-lg">My Tasks</CardTitle>
						<Badge variant="secondary">7</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[200px]">
						<div className="space-y-3">
							<div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
								<AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
								<div className="flex-1">
									<div className="font-medium text-sm">
										Fix database performance issue
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Due: Today
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="destructive" className="text-xs">
											P1 Incident
										</Badge>
										<Badge variant="outline" className="text-xs">
											Backend
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
								<Clock className="h-4 w-4 text-orange-600 mt-0.5" />
								<div className="flex-1">
									<div className="font-medium text-sm">
										Review mobile app delay impact
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Due: Tomorrow
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="default" className="text-xs">
											High Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Review
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div className="flex-1">
									<div className="font-medium text-sm">
										Prepare sprint planning meeting
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Due: Tomorrow
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="secondary" className="text-xs">
											Medium Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Planning
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<CircleCheck className="h-4 w-4 text-green-600 mt-0.5" />
								<div className="flex-1">
									<div className="font-medium text-sm line-through text-muted-foreground">
										Update project status reports
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Completed yesterday
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="outline" className="text-xs">
											Completed
										</Badge>
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>


			{/* Assigned Cards Widget */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-primary" />
							<CardTitle className="text-lg">Assigned Cards</CardTitle>
							<Badge variant="secondary">3</Badge>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={handleViewBoard}
							className="flex items-center gap-2"
						>
							<ExternalLink className="h-4 w-4" />
							View Board
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[200px]">
						<div className="space-y-3">
							<div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
								<div className="w-3 h-3 rounded-full bg-red-500 mt-1.5"></div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										Implement Payment API Integration
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Due in 3 days • To Do
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="destructive" className="text-xs">
											Highest Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Backend
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
								<div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5"></div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										User Authentication System
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Due in 2 days • In Progress
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="default" className="text-xs">
											High Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Security
										</Badge>
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
								<div className="w-3 h-3 rounded-full bg-red-500 mt-1.5"></div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										Security Audit Report
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Due tomorrow • Review
									</div>
									<div className="flex items-center gap-2 mt-2">
										<Badge variant="destructive" className="text-xs">
											Highest Priority
										</Badge>
										<Badge variant="outline" className="text-xs">
											Security
										</Badge>
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Recent Notes Widget */}
			<Card className="h-full">
				<CardHeader className="pb-3">
					<div className="flex items-center gap-2">
						<Palette className="h-5 w-5 text-primary" />
						<CardTitle className="text-lg">Recent Notes</CardTitle>
						<Badge variant="secondary">4</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[200px]">
						<div className="space-y-3">
							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5"></div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										Sprint Planning Notes
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Updated 2 hours ago
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Key discussion points for tomorrow's sprint planning
										meeting...
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<div className="w-3 h-3 rounded-full bg-green-500 mt-1.5"></div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										API Integration Checklist
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Updated 4 hours ago
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Step-by-step guide for payment API integration...
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border">
								<div className="w-3 h-3 rounded-full bg-purple-500 mt-1.5"></div>
								<div className="flex-1">
									<div className="font-medium text-sm">
										Incident Response Playbook
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Updated 1 day ago
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Updated procedures for handling P1 incidents...
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Team Status Widget - Full Width */}
			<Card className="md:col-span-2">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Users className="h-5 w-5 text-primary" />
							<CardTitle className="text-lg">Team Status</CardTitle>
							<Badge variant="secondary">6 members</Badge>
						</div>
						<div className="flex items-center gap-4 text-sm text-muted-foreground">
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full bg-green-500"></div>
								<span>2 Online</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full bg-yellow-500"></div>
								<span>2 Away</span>
							</div>
							<div className="flex items-center gap-1">
								<div className="w-2 h-2 rounded-full bg-gray-400"></div>
								<span>2 Offline</span>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[300px]">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{/* Online Members */}
							<div className="space-y-3">
								<h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-green-500"></div>
									Online (2)
								</h4>

								<div className="space-y-3">
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/50">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-green-100 text-green-700">
												AR
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<div className="font-medium text-sm">Alex Rodriguez</div>
											<div className="text-xs text-muted-foreground">
												Lead Developer
											</div>
											<div className="text-xs text-green-600">Active now</div>
										</div>
										<div className="text-xs text-muted-foreground">
											<div>Working on</div>
											<div className="font-medium">Payment API</div>
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50/50">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-green-100 text-green-700">
												SJ
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<div className="font-medium text-sm">Sarah Johnson</div>
											<div className="text-xs text-muted-foreground">
												Database Specialist
											</div>
											<div className="text-xs text-green-600">
												Active 2 min ago
											</div>
										</div>
										<div className="text-xs text-muted-foreground">
											<div>Working on</div>
											<div className="font-medium">DB Optimization</div>
										</div>
									</div>
								</div>
							</div>

							{/* Away/Busy Members */}
							<div className="space-y-3">
								<h4 className="text-sm font-medium text-yellow-600 flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-yellow-500"></div>
									Away (2)
								</h4>

								<div className="space-y-3">
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-yellow-50/50">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-yellow-100 text-yellow-700">
												LC
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<div className="font-medium text-sm">Lisa Chen</div>
											<div className="text-xs text-muted-foreground">
												Project Manager
											</div>
											<div className="text-xs text-yellow-600">In meeting</div>
										</div>
										<div className="text-xs text-muted-foreground">
											<div>Last seen</div>
											<div className="font-medium">30 min ago</div>
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg border bg-yellow-50/50">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-yellow-100 text-yellow-700">
												JS
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<div className="font-medium text-sm">Jordan Smith</div>
											<div className="text-xs text-muted-foreground">
												DevOps Engineer
											</div>
											<div className="text-xs text-yellow-600">
												Do not disturb
											</div>
										</div>
										<div className="text-xs text-muted-foreground">
											<div>Last seen</div>
											<div className="font-medium">1 hour ago</div>
										</div>
									</div>
								</div>
							</div>

							{/* Offline Members */}
							<div className="space-y-3">
								<h4 className="text-sm font-medium text-gray-600 flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-gray-400"></div>
									Offline (2)
								</h4>

								<div className="space-y-3">
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50/50">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-gray-100 text-gray-700">
												MP
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<div className="font-medium text-sm">Maya Patel</div>
											<div className="text-xs text-muted-foreground">
												UI/UX Designer
											</div>
											<div className="text-xs text-gray-600">Offline</div>
										</div>
										<div className="text-xs text-muted-foreground">
											<div>Last seen</div>
											<div className="font-medium">Yesterday 6:30 PM</div>
										</div>
									</div>

									<div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50/50">
										<Avatar className="h-10 w-10">
											<AvatarFallback className="bg-gray-100 text-gray-700">
												DK
											</AvatarFallback>
										</Avatar>
										<div className="flex-1">
											<div className="font-medium text-sm">David Kim</div>
											<div className="text-xs text-muted-foreground">
												Security Engineer
											</div>
											<div className="text-xs text-gray-600">Offline</div>
										</div>
										<div className="text-xs text-muted-foreground">
											<div>Last seen</div>
											<div className="font-medium">2 days ago</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
};
