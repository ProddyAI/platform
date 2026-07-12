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

interface CardAssignmentTemplateProps {
	firstName: string;
	cardTitle: string;
	cardDescription?: string;
	dueDate?: string;
	priority?: string;
	listName?: string;
	channelName?: string;
	assignedBy?: string;
	cardUrl?: string;
	workspaceUrl?: string;
	workspaceName?: string;
	unsubscribeUrl?: string;
}

export const CardAssignmentTemplate: React.FC<
	Readonly<CardAssignmentTemplateProps>
> = ({
	firstName,
	cardTitle,
	cardDescription,
	dueDate,
	priority,
	listName,
	channelName,
	assignedBy = "A team member",
	cardUrl,
	workspaceUrl = process.env.NEXT_PUBLIC_APP_URL,
	workspaceName = "Proddy",
	unsubscribeUrl,
}) => {
	const previewText = `${assignedBy} assigned you "${cardTitle}"`;

	const details: EmailDetailItem[] = [];
	if (listName) details.push({ label: "List", value: listName });
	if (channelName) details.push({ label: "Channel", value: channelName });
	if (priority) details.push({ label: "Priority", value: priority });
	if (dueDate) details.push({ label: "Due date", value: dueDate });

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>You were assigned a card</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					<strong>{assignedBy}</strong> assigned you a card in {workspaceName}.
				</Text>

				<Section style={emailCalloutBox}>
					<Text style={emailCalloutHeading}>{cardTitle}</Text>
					{cardDescription ? (
						<Text style={emailCalloutText}>{cardDescription}</Text>
					) : null}
				</Section>

				{details.length > 0 ? <EmailDetailList items={details} /> : null}

				<Section style={emailButtonContainer}>
					<Button href={cardUrl || workspaceUrl} style={emailButton}>
						View card
					</Button>
				</Section>
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				You received this because you were assigned to a card in {workspaceName}
				.
			</Text>

			<EmailUnsubscribeLine
				label="task assignment notifications"
				unsubscribeUrl={unsubscribeUrl}
			/>
		</EmailLayout>
	);
};

export default CardAssignmentTemplate;
