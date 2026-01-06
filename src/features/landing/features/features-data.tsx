import {
	BarChart,
	Calendar,
	CheckSquare,
	FileText,
	LayoutDashboard,
	LayoutGrid,
	MessageSquare,
	PaintBucket,
} from "lucide-react";
import type { ReactNode } from "react";

export interface Feature {
	id: string;
	name: string;
	description: string;
	detailedDescription: string;
	icon: ReactNode;
	color: string;
	features: string[];
	benefits?: string[];
	useCases: string[];
	imageSrc?: string;
}

export const featureGroups = [
	{
		title: "Communication & Collaboration",
		description:
			"Tools that help your team communicate and work together effectively",
		features: ["messaging", "canvas"],
	},
	{
		title: "Task & Project Management",
		description: "Tools to organize, track, and visualize your team's work",
		features: ["tasks", "boards"],
	},
	{
		title: "Planning & Organization",
		description: "Tools to help your team plan and stay organized",
		features: ["notes", "calendar"],
	},
	{
		title: "Analytics & Intelligence",
		description: "Tools that provide insights and intelligent assistance",
		features: ["reports", "dashboard"],
	},
];

export const features: Feature[] = [
	{
		id: "messaging",
		name: "Messaging",
		description:
			"Real-time team communication with rich text formatting, threads, and AI-powered features.",
		detailedDescription:
			"Proddy Messaging transforms how your team communicates with a powerful, intuitive platform designed for modern collaboration. With rich text formatting, threaded conversations, and AI-powered features, your team can stay connected and productive no matter where they are.",
		icon: <MessageSquare className="size-6" />,
		color: "bg-blue-500",
		features: [
			"Rich text formatting and emoji reactions",
			"Threaded conversations for organized discussions",
			"AI-powered message summarization",
			"Searchable message history",
			"File sharing and previews",
			"Message pinning and bookmarks",
			"Calendar event sharing",
		],

		useCases: [
			"Daily team standups and check-ins",
			"Project-specific discussions and updates",
			"Cross-department collaboration",
			"Remote team communication",
			"Quick decision-making and feedback gathering",
		],
		imageSrc: "/messages.png",
	},
	{
		id: "tasks",
		name: "Tasks",
		description:
			"Organize and track work with customizable task lists, assignments, and due dates.",
		detailedDescription:
			"Proddy Tasks helps teams stay organized and accountable with a flexible task management system. Create, assign, and track tasks with customizable workflows that adapt to your team's unique processes. From simple to-do lists to complex project management, Tasks scales to meet your needs.",
		icon: <CheckSquare className="size-6" />,
		color: "bg-green-500",
		features: [
			"Task creation and assignment",
			"Due dates and reminders",
			"Priority levels and labels",
			"Progress tracking",
			"Calendar integration",
			"Subtasks and dependencies",
			"Custom fields and statuses",
			"Advanced filtering options",
			"Multiple view options",
			"Task categories and tags",
		],

		useCases: [
			"Sprint planning and agile development",
			"Marketing campaign management",
			"Customer onboarding processes",
			"Product roadmap execution",
			"Personal task management",
			"Team workload management",
		],
		imageSrc: "/tasks.png",
	},
	{
		id: "calendar",
		name: "Calendar",
		description:
			"Schedule and manage events, meetings, and deadlines with team-wide visibility.",
		detailedDescription:
			"Proddy Calendar brings clarity to your team's schedule with a powerful, collaborative calendar system. Coordinate meetings, track important dates, and manage availability all in one place. With AI-powered scheduling suggestions, finding the perfect meeting time has never been easier.",
		icon: <Calendar className="size-6" />,
		color: "bg-purple-500",
		features: [
			"Event scheduling and management",
			"Meeting coordination",
			"Availability sharing",
			"Recurring events",
			"Notifications and reminders",
			"Calendar integrations (Google, Outlook)",
			"Meeting agenda templates",
			"AI-powered scheduling suggestions",
		],

		useCases: [
			"Team meetings and one-on-ones",
			"Project milestone tracking",
			"Event planning and coordination",
			"Client meeting scheduling",
			"Company-wide announcements and events",
		],
		imageSrc: "/calender.png",
	},
	{
		id: "boards",
		name: "Boards",
		description:
			"Visual project management with customizable boards, lists, and cards.",
		detailedDescription:
			"Proddy Boards provides a visual approach to project management that helps teams see the big picture. With customizable boards, lists, and cards, you can create workflows that match exactly how your team works. Track progress visually and identify bottlenecks at a glance.",
		icon: <LayoutGrid className="size-6" />,
		color: "bg-pink-500",
		features: [
			"Kanban, table, and Gantt views",
			"Customizable workflows",
			"Card assignments and due dates",
			"Progress tracking",
			"Integration with Tasks and Calendar",
			"Custom fields and labels",
			"Drag-and-drop card management",
			"Filtering by labels and assignees",
			"Board activity tracking",
		],

		useCases: [
			"Agile development sprints",
			"Editorial calendars",
			"Sales pipeline management",
			"Hiring and recruitment processes",
			"Product development lifecycle",
			"Cross-functional project coordination",
		],
		imageSrc: "/boards.png",
	},
	{
		id: "canvas",
		name: "Canvas",
		description:
			"Collaborative whiteboarding for brainstorming, planning, and visual collaboration.",
		detailedDescription:
			"Proddy Canvas is your team's digital whiteboard for visual collaboration. Brainstorm ideas, create diagrams, plan projects, and collaborate in real-time with a flexible canvas that adapts to any creative process. With powerful drawing tools and templates, Canvas makes visual thinking accessible to everyone.",
		icon: <PaintBucket className="size-6" />,
		color: "bg-orange-500",
		features: [
			"Real-time collaborative drawing",
			"Shapes, text, and connectors",
			"Image uploads",
			"Presentation mode",
			"Templates for common diagrams",
			"Sticky notes and comments",
			"Integrated audio rooms",
			"Active participants list",
			"Real-time cursor tracking",
		],

		useCases: [
			"Brainstorming sessions",
			"User journey mapping",
			"System architecture diagrams",
			"Mind mapping",
			"Project planning and roadmapping",
			"Remote design workshops",
		],
		imageSrc: "/canvas.png",
	},
	{
		id: "notes",
		name: "Notes",
		description:
			"Document and share knowledge with rich text notes, wikis, and documentation.",
		detailedDescription:
			"Proddy Notes is your team's central knowledge base, making it easy to create, organize, and share information. With powerful rich text editing, version history, and collaborative features, Notes ensures that your team's knowledge is always accessible and up-to-date.",
		icon: <FileText className="size-6" />,
		color: "bg-yellow-500",
		features: [
			"Rich text editing with formatting",
			"Hierarchical organization",
			"Version history",
			"Collaborative editing",
			"AI-powered content suggestions",
			"Templates for common documents",
			"Search and tagging",
			"Embedding of media and files",
		],

		useCases: [
			"Internal documentation and wikis",
			"Meeting notes and summaries",
			"Project documentation",
			"Onboarding materials",
			"Process documentation",
		],
		imageSrc: "/notes.png",
	},
	{
		id: "reports",
		name: "Reports",
		description:
			"Analytics and insights to track team performance, project progress, and more.",
		detailedDescription:
			"Proddy Reports provides powerful analytics and insights that help you understand how your team is performing. With customizable dashboards, detailed metrics, and AI-powered predictions, Reports gives you the data you need to make informed decisions and continuously improve your team's effectiveness.",
		icon: <BarChart className="size-6" />,
		color: "bg-cyan-500",
		features: [
			"Export and sharing options",
			"Predictive analytics with AI",
			"Custom report creation",
			"Automated reporting schedules",
			"Integration with all Proddy modules",
			"User activity dashboard",
			"Channel activity dashboard",
			"Overview dashboard",
			"Content analysis dashboard",
		],

		useCases: [
			"Team performance reviews",
			"Project status reporting",
			"Resource utilization analysis",
			"Productivity tracking",
			"Executive dashboards",
			"Communication pattern analysis",
			"Content engagement metrics",
		],
		imageSrc: "/reports.png",
	},
	{
		id: "dashboard",
		name: "Dashboard",
		description:
			"Customizable command center that brings all your workspace information into one place.",
		detailedDescription:
			"The Proddy Dashboard is your team's central hub, providing a bird's-eye view of everything that matters. With customizable widgets and real-time updates, you can monitor activity, track progress, and access key information without switching between different modules.",
		icon: <LayoutDashboard className="size-6" />,
		color: "bg-indigo-500",
		features: [
			"Customizable widget layout",
			"Real-time activity feed",
			"Task and deadline tracking",
			"Calendar events overview",
			"Team mentions and replies",
			"Notes and canvas previews",
			"Board cards status",
			"Personalized workspace insights",
		],
		benefits: [
			"Get a complete overview of your workspace in one place",
			"Customize your view to focus on what matters most",
			"Stay updated on team activity in real-time",
			"Access key information without switching contexts",
			"Improve productivity with personalized insights",
		],
		useCases: [
			"Daily team status overview",
			"Project progress monitoring",
			"Personal task management",
			"Meeting and event tracking",
			"Cross-module information access",
		],
		imageSrc: "/dashboard.png",
	},
];
