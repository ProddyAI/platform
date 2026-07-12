import { Button, Heading, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	type EmailDetailItem,
	EmailDetailList,
	EmailLayout,
	EmailUnsubscribeLine,
	emailButton,
	emailButtonContainer,
	emailCalloutBox,
	emailCalloutHeading,
	emailCalloutText,
	emailFooter,
	emailHeading,
	emailHr,
	emailSection,
	emailText,
	Hr,
} from "./email-layout";

interface IssueAssignmentTemplateProps {
	firstName: string;
	issueTitle: string;
	issueDescription?: string;
	dueDate?: string;
	priority?: string;
	statusName?: string;
	channelName?: string;
	assignedBy?: string;
	issueUrl?: string;
	workspaceUrl?: string;
	workspaceName?: string;
	unsubscribeUrl?: string;
}

export const IssueAssignmentTemplate: React.FC<
	Readonly<IssueAssignmentTemplateProps>
> = ({
	firstName,
	issueTitle,
	issueDescription,
	dueDate,
	priority,
	statusName,
	channelName,
	assignedBy = "A team member",
	issueUrl,
	workspaceUrl = process.env.NEXT_PUBLIC_APP_URL,
	workspaceName = "Proddy",
	unsubscribeUrl,
}) => {
	const previewText = `${assignedBy} assigned you "${issueTitle}"`;

	const details: EmailDetailItem[] = [];
	if (channelName) details.push({ label: "Channel", value: channelName });
	if (statusName) details.push({ label: "Status", value: statusName });
	if (priority) details.push({ label: "Priority", value: priority });
	if (dueDate) details.push({ label: "Due date", value: dueDate });

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>You were assigned an issue</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					<strong>{assignedBy}</strong> assigned you an issue in {workspaceName}
					.
				</Text>

				<Section style={emailCalloutBox}>
					<Text style={emailCalloutHeading}>{issueTitle}</Text>
					{issueDescription ? (
						<Text style={emailCalloutText}>{issueDescription}</Text>
					) : null}
				</Section>

				{details.length > 0 ? <EmailDetailList items={details} /> : null}

				<Section style={emailButtonContainer}>
					<Button href={issueUrl || workspaceUrl} style={emailButton}>
						View issue
					</Button>
				</Section>
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				You received this because you were assigned to an issue in{" "}
				{workspaceName}.
			</Text>

			<EmailUnsubscribeLine
				label="task assignment notifications"
				unsubscribeUrl={unsubscribeUrl}
			/>
		</EmailLayout>
	);
};

export default IssueAssignmentTemplate;
