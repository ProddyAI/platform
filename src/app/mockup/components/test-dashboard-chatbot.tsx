"use client";

import { Bot, Calendar, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
	id: string;
	content: string;
	sender: "user" | "assistant";
	timestamp: Date;
	hasActions?: boolean;
	actions?: Array<{
		label: string;
		action: () => void;
		icon?: React.ReactNode;
	}>;
}

const HARDCODED_RESPONSES: Record<string, string> = {
	"how's my day looking?": `Good morning! Here's your day ahead:

📅 3 meetings - Sprint planning at 10am (high priority)
📧 12 unread emails - 2 urgent from stakeholders
🚨 1 P1 incident - Database performance issue (assigned to Sarah)
📊 Projects: Payment API (on track), Mobile App (2 days behind)`,

	"what's the context for the 10am sprint planning?": `Sprint Planning - Q2 Feature Development

Agenda:
• Review completed stories from last sprint
• Plan capacity for upcoming sprint
• Discuss mobile app delays

Attendees: Your team + Product Manager Lisa
Prep needed: Review velocity metrics and blocker analysis`,

	"what are my tasks for today?": `Today's Tasks:

🔴 High Priority:
• Fix database performance issue (P1 incident)
• Review mobile app delay impact

🟡 Medium Priority:
• Prepare for sprint planning meeting
• Review stakeholder emails
• Update project status reports

🟢 Low Priority:
• Team sync follow-up
• Documentation updates`,

	"show me my calendar": `Today's Calendar:

🕘 9:00 AM - Team standup (15 min)
🕙 10:00 AM - Sprint Planning (2 hours) - High Priority
🕐 1:00 PM - Lunch break
🕑 2:30 PM - Stakeholder review (1 hour)
🕓 4:00 PM - 1:1 with Sarah (30 min)

Tomorrow:
🕘 9:00 AM - Architecture review
🕙 10:30 AM - Client demo prep`,

	"what's my team status?": `Team Status Overview:

👥 Online: 8/12 team members
🟢 Available: Alex, Jordan, Sam, Maya
🟡 In Meeting: Lisa, David
🔴 Busy: Sarah (P1 incident), Mike (client call)
⚫ Offline: Tom, Emma, Chris, Riley

Current Focus:
• 3 people on Payment API
• 2 people on Mobile App
• 1 person on incident response`,

	"tell me about the p1 incident": `P1 Incident - Database Performance Issue

🚨 Status: Active (4 hours)
👤 Assigned: Sarah Johnson
📊 Impact: 15% of users experiencing slow queries

Details:
• Started at 6:00 AM
• Affecting user authentication
• Database CPU at 95%
• Estimated fix time: 2-3 hours

Actions taken:
• Scaled read replicas
• Identified slow queries
• Working on index optimization`,

	"what emails need my attention?": `Urgent Emails (2):

📧 From: Client Success Team
Subject: "Payment API - Client concerns"
Received: 2 hours ago

📧 From: Product Manager Lisa
Subject: "Sprint planning prep - URGENT"
Received: 1 hour ago

Other emails (10):
• Weekly reports (3)
• Team updates (4)
• Meeting invites (3)`,

	"show me project status": `Project Status Dashboard:

💳 Payment API Integration
Status: ✅ On Track (85% complete)
Team: Alex, Jordan, Sam
Next milestone: Testing phase (Friday)

📱 Mobile App Redesign
Status: ⚠️ Behind Schedule (60% complete)
Team: Maya, David, Tom
Issue: 2 days behind due to design changes
Next milestone: UI review (Monday)

🔐 User Authentication
Status: ✅ On Track (40% complete)
Team: Sarah, Mike
Next milestone: Security review (Next week)`,

	"what meetings do i have today?": `Today's Meetings:

🕘 9:00 AM - Daily Standup
Duration: 15 minutes
Attendees: Full dev team
Location: Conference Room B

🕙 10:00 AM - Sprint Planning (HIGH PRIORITY)
Duration: 2 hours
Attendees: Dev team + Lisa (PM)
Location: Conference Room A

🕑 2:30 PM - Stakeholder Review
Duration: 1 hour
Attendees: You + Client team
Location: Zoom call

🕓 4:00 PM - 1:1 with Sarah
Duration: 30 minutes
Topic: P1 incident & career development
Location: Office`,
};

export const TestDashboardChatbot = () => {
	const router = useRouter();
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "1",
			content: `Hello! I'm your Proddy AI assistant. How can I help you today?`,
			sender: "assistant",
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = useState("");
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		if (scrollAreaRef.current) {
			const scrollContainer = scrollAreaRef.current.querySelector(
				"[data-radix-scroll-area-viewport]"
			);
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}
	};

	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			content: input,
			sender: "user",
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);

		// Get response based on input
		const normalizedInput = input.toLowerCase().trim();
		const response =
			HARDCODED_RESPONSES[normalizedInput] ||
			"I don't have information about that. Try asking about your day, sprint planning context, tasks, calendar, or team status.";

		setTimeout(() => {
			const assistantMessage: Message = {
				id: (Date.now() + 1).toString(),
				content: response,
				sender: "assistant",
				timestamp: new Date(),
				hasActions:
					normalizedInput.includes("calendar") ||
					normalizedInput.includes("day looking") ||
					normalizedInput.includes("meetings"),
				actions:
					normalizedInput.includes("calendar") ||
					normalizedInput.includes("day looking") ||
					normalizedInput.includes("meetings")
						? [
								{
									label: "View Calendar",
									action: () => router.push("/mockup/calendar"),
									icon: <Calendar className="h-4 w-4" />,
								},
							]
						: undefined,
			};
			setMessages((prev) => [...prev, assistantMessage]);
		}, 500);

		setInput("");
	};

	const clearConversation = () => {
		setMessages([
			{
				id: "1",
				content: `Hello! I'm your Proddy AI assistant. How can I help you today?`,
				sender: "assistant",
				timestamp: new Date(),
			},
		]);
	};

	return (
		<Card className="flex flex-col h-full shadow-md overflow-hidden">
			<CardHeader className="pb-2 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Avatar className="h-8 w-8 bg-primary/10">
							<AvatarFallback>
								<Bot className="h-5 w-5" />
							</AvatarFallback>
						</Avatar>
						<div>
							<CardTitle className="text-lg">Proddy AI</CardTitle>
						</div>
					</div>
					<Button
						className="text-xs text-muted-foreground hover:text-destructive border border-gray-300"
						onClick={clearConversation}
						size="sm"
						variant="ghost"
					>
						<Trash2 className="h-3.5 w-3.5 mr-1.5" />
						Clear chat
					</Button>
				</div>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden p-0">
				<ScrollArea className="h-[calc(100vh-240px)] px-4" ref={scrollAreaRef}>
					<div className="space-y-4 py-4">
						{messages.map((message) => (
							<div
								className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
								key={message.id}
							>
								<div
									className={`max-w-[80%] rounded-lg px-3 py-2 ${
										message.sender === "user"
											? "bg-primary text-primary-foreground"
											: "bg-muted"
									}`}
								>
									<div className="whitespace-pre-wrap text-sm">
										{message.content}
									</div>

									{/* Action buttons for assistant messages */}
									{message.sender === "assistant" &&
										message.hasActions &&
										message.actions && (
											<div className="mt-3 flex flex-wrap gap-2">
												{message.actions.map((action, index) => (
													<Button
														className="flex items-center gap-2 text-xs"
														key={index}
														onClick={action.action}
														size="sm"
														variant="outline"
													>
														{action.icon}
														{action.label}
													</Button>
												))}
											</div>
										)}

									<div className="mt-1 text-xs opacity-70">
										{message.timestamp.toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</div>
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</CardContent>
			<div className="border-t p-4">
				<form className="flex gap-2" onSubmit={handleSubmit}>
					<Input
						className="flex-1"
						onChange={(e) => setInput(e.target.value)}
						placeholder="Ask me about your day, tasks, or meetings..."
						value={input}
					/>
					<Button disabled={!input.trim()} size="sm" type="submit">
						<Send className="h-4 w-4" />
					</Button>
				</form>
			</div>
		</Card>
	);
};
