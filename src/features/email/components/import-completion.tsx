import { Button, Heading, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	type EmailDetailItem,
	EmailDetailList,
	EmailLayout,
	EmailStatusBadge,
	emailButton,
	emailButtonContainer,
	emailFooter,
	emailHeading,
	emailHr,
	emailSection,
	emailText,
	Hr,
} from "./email-layout";

type ImportStatus = "completed" | "failed" | "cancelled";

interface ImportCompletionTemplateProps {
	userName: string;
	platformName: string;
	status: ImportStatus;
	channelsImported: number;
	messagesImported: number;
	workspaceUrl: string;
	workspaceName?: string;
}

const copy: Record<
	ImportStatus,
	{
		badge: string;
		tone: "success" | "danger" | "warning";
		heading: string;
		cta: string;
		href: (workspaceUrl: string) => string;
	}
> = {
	completed: {
		badge: "Import complete",
		tone: "success",
		heading: "Your import is complete",
		cta: "Open workspace",
		href: (u) => u,
	},
	failed: {
		badge: "Import failed",
		tone: "danger",
		heading: "Your import didn't finish",
		cta: "Try again",
		href: (u) => `${u}/manage?tab=import`,
	},
	cancelled: {
		badge: "Import cancelled",
		tone: "warning",
		heading: "Your import was cancelled",
		cta: "Start a new import",
		href: (u) => `${u}/manage?tab=import`,
	},
};

export const ImportCompletionTemplate: React.FC<
	Readonly<ImportCompletionTemplateProps>
> = ({
	userName,
	platformName,
	status,
	channelsImported,
	messagesImported,
	workspaceUrl,
	workspaceName = "Proddy",
}) => {
	const c = copy[status];
	const previewText = `${platformName} import ${status}`;

	const details: EmailDetailItem[] = [
		{ label: "Platform", value: platformName },
		{ label: "Channels imported", value: channelsImported.toLocaleString() },
		{ label: "Messages imported", value: messagesImported.toLocaleString() },
	];

	return (
		<EmailLayout previewText={previewText}>
			<EmailStatusBadge label={c.badge} tone={c.tone} />
			<Heading style={emailHeading}>{c.heading}</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {userName},</Text>

				{status === "completed" ? (
					<>
						<Text style={emailText}>
							Your {platformName} data has been imported into {workspaceName}.
							Everything below is ready for your team.
						</Text>
						<EmailDetailList items={details} />
						<Text style={emailText}>
							Your channels, conversations, and messages are now in your
							workspace — you can pick up right where you left off.
						</Text>
					</>
				) : null}

				{status === "failed" ? (
					<Text style={emailText}>
						We hit an error while importing your {platformName} data, so it
						couldn&apos;t be completed. You can retry the import below — if it
						keeps failing, reply to this email and we&apos;ll help.
					</Text>
				) : null}

				{status === "cancelled" ? (
					<Text style={emailText}>
						Your {platformName} import was cancelled. Nothing was changed in
						your workspace. You can start a new import whenever you&apos;re
						ready.
					</Text>
				) : null}

				<Section style={emailButtonContainer}>
					<Button href={c.href(workspaceUrl)} style={emailButton}>
						{c.cta}
					</Button>
				</Section>
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				You received this because you started a {platformName} import in{" "}
				{workspaceName}.
			</Text>
		</EmailLayout>
	);
};

export default ImportCompletionTemplate;
