import {
	Button,
	Column,
	Heading,
	Hr,
	Link,
	Row,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";
import {
	EmailLayout,
	emailButton,
	emailHeading,
	emailHr,
	emailLink,
	emailSection,
	emailSubHeading,
	emailText,
} from "./email-layout";

interface WorkspaceDigest {
	workspaceName: string;
	workspaceUrl: string;
	stats: {
		totalMessages: number;
		totalTasks: number;
		completedTasks: number;
		activeUsers: number;
	};
	topChannels: Array<{
		name: string;
		messageCount: number;
	}>;
	recentTasks: Array<{
		title: string;
		status: string;
		dueDate?: string;
	}>;
}

interface WeeklyDigestTemplateProps {
	firstName: string;
	weekRange: string; // e.g., "Dec 16 - Dec 22, 2024"
	workspaces: WorkspaceDigest[];
	totalStats: {
		totalMessages: number;
		totalTasks: number;
		totalWorkspaces: number;
	};
	userId?: string;
	email?: string;
	unsubscribeUrl?: string;
}

export const WeeklyDigestTemplate: React.FC<
	Readonly<WeeklyDigestTemplateProps>
> = ({ firstName, weekRange, workspaces, totalStats, unsubscribeUrl }) => {
	const previewText = `Your weekly Proddy digest for ${weekRange}`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>Your Weekly Digest</Heading>

			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					Here&apos;s your weekly summary for <strong>{weekRange}</strong>{" "}
					across all your Proddy workspaces.
				</Text>

				{/* Overall Stats */}
				<Section style={statsContainer}>
					<Heading style={emailSubHeading}>Week at a Glance</Heading>
					<Row>
						<Column align="center" style={statItem}>
							<Text style={statNumber}>{totalStats.totalMessages}</Text>
							<Text style={statLabel}>Messages</Text>
						</Column>
						<Column align="center" style={statItem}>
							<Text style={statNumber}>{totalStats.totalTasks}</Text>
							<Text style={statLabel}>Tasks</Text>
						</Column>
						<Column align="center" style={statItem}>
							<Text style={statNumber}>{totalStats.totalWorkspaces}</Text>
							<Text style={statLabel}>Workspaces</Text>
						</Column>
					</Row>
				</Section>

				<Hr style={emailHr} />

				{/* Workspace Details */}
				{workspaces.map((workspace, index) => (
					<Section key={workspace.workspaceUrl} style={workspaceSection}>
						<Heading style={workspaceHeading}>
							{workspace.workspaceName}
						</Heading>

						{/* Workspace Stats */}
						<Section style={workspaceStats}>
							<Text style={workspaceStatText}>
								<strong>{workspace.stats.totalMessages}</strong> messages •{" "}
								<strong>
									{workspace.stats.completedTasks}/{workspace.stats.totalTasks}
								</strong>{" "}
								tasks completed • <strong>{workspace.stats.activeUsers}</strong>{" "}
								active users
							</Text>
						</Section>

						{/* Top Channels */}
						{workspace.topChannels.length > 0 && (
							<Section style={channelSection}>
								<Text style={sectionTitle}>Most Active Channels</Text>
								{workspace.topChannels.slice(0, 3).map((channel, index) => (
									<Text
										key={`${channel.name}-${channel.messageCount}-${index}`}
										style={channelItem}
									>
										#{channel.name} - {channel.messageCount} messages
									</Text>
								))}
							</Section>
						)}

						{/* Recent Tasks */}
						{workspace.recentTasks.length > 0 && (
							<Section style={taskSection}>
								<Text style={sectionTitle}>Recent Tasks</Text>
								{workspace.recentTasks.slice(0, 3).map((task, taskIndex) => (
									<Text
										key={`${workspace.workspaceUrl}-${task.title}-${task.dueDate || "no-due"}-${taskIndex}`}
										style={taskItem}
									>
										{task.status === "completed" ? "Done" : "Pending"}:{" "}
										{task.title}
										{task.dueDate && ` (Due: ${task.dueDate})`}
									</Text>
								))}
							</Section>
						)}

						<Section style={buttonContainer}>
							<Button href={workspace.workspaceUrl} style={emailButton}>
								View {workspace.workspaceName}
							</Button>
						</Section>

						{index < workspaces.length - 1 && <Hr style={emailHr} />}
					</Section>
				))}

				<Hr style={emailHr} />

				{/* Footer */}
				<Section style={footer}>
					<Text style={footerText}>
						This digest was sent because you have weekly digest notifications
						enabled. You can change your notification preferences in your
						account settings.
					</Text>
					<Text style={footerText}>
						<Link
							href={`${process.env.NEXT_PUBLIC_APP_URL}/workspace`}
							style={emailLink}
						>
							Visit Proddy Dashboard
						</Link>
						{" • "}
						<Link href={unsubscribeUrl} style={emailLink}>
							Unsubscribe
						</Link>
					</Text>
				</Section>
			</Section>
		</EmailLayout>
	);
};

// Styles specific to this template (not shared across other templates)
const statsContainer = {
	backgroundColor: "#f9fafb",
	borderRadius: "8px",
	padding: "20px",
	margin: "20px 0",
};

const statItem = {
	textAlign: "center" as const,
	width: "33%",
};

const statNumber = {
	fontSize: "24px",
	fontWeight: "700",
	color: "#1f2937",
	margin: "0",
	lineHeight: "1.2",
};

const statLabel = {
	fontSize: "12px",
	color: "#6b7280",
	margin: "4px 0 0",
	lineHeight: "1.2",
};

const workspaceSection = {
	margin: "20px 0",
};

const workspaceHeading = {
	fontSize: "16px",
	lineHeight: "1.4",
	fontWeight: "600",
	color: "#1f2937",
	margin: "0 0 10px",
};

const workspaceStats = {
	backgroundColor: "#f3f4f6",
	borderRadius: "6px",
	padding: "12px",
	margin: "10px 0",
};

const workspaceStatText = {
	fontSize: "13px",
	color: "#374151",
	margin: "0",
	lineHeight: "1.4",
};

const channelSection = {
	margin: "15px 0",
};

const taskSection = {
	margin: "15px 0",
};

const sectionTitle = {
	fontSize: "13px",
	fontWeight: "600",
	color: "#1f2937",
	margin: "0 0 8px",
};

const channelItem = {
	fontSize: "12px",
	color: "#6b7280",
	margin: "4px 0",
	paddingLeft: "10px",
};

const taskItem = {
	fontSize: "12px",
	color: "#6b7280",
	margin: "4px 0",
	paddingLeft: "10px",
};

const buttonContainer = {
	textAlign: "center" as const,
	margin: "20px 0",
};

const footer = {
	textAlign: "center" as const,
	margin: "30px 0 0",
};

const footerText = {
	fontSize: "12px",
	color: "#6b7280",
	lineHeight: "1.4",
	margin: "8px 0",
};

export default WeeklyDigestTemplate;
