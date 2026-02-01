import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

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
> = ({
	firstName,
	weekRange,
	workspaces,
	totalStats,
	userId,
	email,
	unsubscribeUrl,
}) => {
	const previewText = `Your weekly Proddy digest for ${weekRange}`;

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Img
						alt="Proddy"
						height="40"
						src="https://proddy.tech/logo-nobg.png"
						style={logo}
						width="40"
					/>
					<Heading style={heading}>Your Weekly Digest</Heading>

					<Section style={section}>
						<Text style={text}>Hi {firstName},</Text>
						<Text style={text}>
							Here's your weekly summary for <strong>{weekRange}</strong> across
							all your Proddy workspaces.
						</Text>

						{/* Overall Stats */}
						<Section style={statsContainer}>
							<Heading style={subHeading}>Week at a Glance</Heading>
							<div style={statsGrid}>
								<div style={statItem}>
									<Text style={statNumber}>{totalStats.totalMessages}</Text>
									<Text style={statLabel}>Messages</Text>
								</div>
								<div style={statItem}>
									<Text style={statNumber}>{totalStats.totalTasks}</Text>
									<Text style={statLabel}>Tasks</Text>
								</div>
								<div style={statItem}>
									<Text style={statNumber}>{totalStats.totalWorkspaces}</Text>
									<Text style={statLabel}>Workspaces</Text>
								</div>
							</div>
						</Section>

						<Hr style={hr} />

						{/* Workspace Details */}
						{workspaces.map((workspace, index) => (
							<Section key={index} style={workspaceSection}>
								<Heading style={workspaceHeading}>
									{workspace.workspaceName}
								</Heading>

								{/* Workspace Stats */}
								<div style={workspaceStats}>
									<Text style={workspaceStatText}>
										📊 <strong>{workspace.stats.totalMessages}</strong> messages
										• ✅{" "}
										<strong>
											{workspace.stats.completedTasks}/
											{workspace.stats.totalTasks}
										</strong>{" "}
										tasks completed • 👥{" "}
										<strong>{workspace.stats.activeUsers}</strong> active users
									</Text>
								</div>

								{/* Top Channels */}
								{workspace.topChannels.length > 0 && (
									<div style={channelSection}>
										<Text style={sectionTitle}>🔥 Most Active Channels</Text>
										{workspace.topChannels.slice(0, 3).map((channel, idx) => (
											<Text key={idx} style={channelItem}>
												#{channel.name} - {channel.messageCount} messages
											</Text>
										))}
									</div>
								)}

								{/* Recent Tasks */}
								{workspace.recentTasks.length > 0 && (
									<div style={taskSection}>
										<Text style={sectionTitle}>📋 Recent Tasks</Text>
										{workspace.recentTasks.slice(0, 3).map((task, idx) => (
											<Text key={idx} style={taskItem}>
												{task.status === "completed" ? "✅" : "⏳"} {task.title}
												{task.dueDate && ` (Due: ${task.dueDate})`}
											</Text>
										))}
									</div>
								)}

								<Section style={buttonContainer}>
									<Button href={workspace.workspaceUrl} style={button}>
										View {workspace.workspaceName}
									</Button>
								</Section>

								{index < workspaces.length - 1 && <Hr style={hr} />}
							</Section>
						))}

						<Hr style={hr} />

						{/* Footer */}
						<Section style={footer}>
							<Text style={footerText}>
								This digest was sent because you have weekly digest
								notifications enabled. You can change your notification
								preferences in your account settings.
							</Text>
							<Text style={footerText}>
								<Link href="https://proddy.tech" style={link}>
									Visit Proddy
								</Link>
								{" • "}
								<Link href={unsubscribeUrl} style={link}>
									Unsubscribe
								</Link>
							</Text>
						</Section>
					</Section>
				</Container>
			</Body>
		</Html>
	);
};

// Styles
const main = {
	backgroundColor: "#ffffff",
	fontFamily:
		'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
};

const container = {
	margin: "0 auto",
	padding: "20px 0 48px",
	maxWidth: "600px",
};

const logo = {
	margin: "0 auto",
	display: "block",
};

const heading = {
	fontSize: "24px",
	lineHeight: "1.3",
	fontWeight: "700",
	color: "#1f2937",
	textAlign: "center" as const,
	margin: "30px 0",
};

const subHeading = {
	fontSize: "18px",
	lineHeight: "1.4",
	fontWeight: "600",
	color: "#1f2937",
	margin: "20px 0 10px",
};

const workspaceHeading = {
	fontSize: "16px",
	lineHeight: "1.4",
	fontWeight: "600",
	color: "#1f2937",
	margin: "0 0 10px",
};

const section = {
	padding: "0 24px",
};

const text = {
	fontSize: "14px",
	lineHeight: "1.6",
	color: "#374151",
	margin: "16px 0",
};

const statsContainer = {
	backgroundColor: "#f9fafb",
	borderRadius: "8px",
	padding: "20px",
	margin: "20px 0",
};

const statsGrid = {
	display: "flex",
	justifyContent: "space-around",
	textAlign: "center" as const,
};

const statItem = {
	flex: 1,
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

const button = {
	backgroundColor: "#3b82f6",
	borderRadius: "6px",
	color: "#ffffff",
	fontSize: "14px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "inline-block",
	padding: "12px 20px",
};

const hr = {
	borderColor: "#e5e7eb",
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

const link = {
	color: "#3b82f6",
	textDecoration: "underline",
};
