import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	EmailLayout,
	EmailUnsubscribeLine,
	emailButton,
	emailButtonContainer,
	emailCalloutBox,
	emailFooter,
	emailHeading,
	emailHr,
	emailSection,
	emailText,
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
	const previewText = `${assignedBy} assigned you to "${cardTitle}"`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>{assignedBy} assigned you a card</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					{assignedBy} has assigned you to a card in {workspaceName}.
				</Text>

				<Section style={emailCalloutBox}>
					<Text style={cardTitleStyle}>{cardTitle}</Text>

					{cardDescription && (
						<Text style={cardDescriptionStyle}>{cardDescription}</Text>
					)}

					<Section style={metadataContainer}>
						{listName && (
							<Text style={metadataItem}>
								<strong>List:</strong> {listName}
							</Text>
						)}

						{channelName && (
							<Text style={metadataItem}>
								<strong>Channel:</strong> {channelName}
							</Text>
						)}

						{priority && (
							<Text style={metadataItem}>
								<strong>Priority:</strong> {priority}
							</Text>
						)}

						{dueDate && (
							<Text style={metadataItem}>
								<strong>Due Date:</strong> {dueDate}
							</Text>
						)}
					</Section>
				</Section>

				<Section style={emailButtonContainer}>
					<Button href={cardUrl || workspaceUrl} style={emailButton}>
						View Card
					</Button>
				</Section>
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				This email was sent from {workspaceName}, your team collaboration
				platform. If you didn&apos;t expect this email, you can safely ignore
				it.
			</Text>

			<EmailUnsubscribeLine
				label="task assignment notifications"
				unsubscribeUrl={unsubscribeUrl}
			/>
		</EmailLayout>
	);
};

// Styles specific to this template (not shared across other templates)
const cardTitleStyle = {
	color: "#0E1C36",
	fontSize: "18px",
	fontWeight: "600",
	margin: "0 0 10px",
};

const cardDescriptionStyle = {
	color: "#4A5568",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "10px 0",
};

const metadataContainer = {
	marginTop: "15px",
};

const metadataItem = {
	color: "#4A5568",
	fontSize: "14px",
	margin: "5px 0",
};

export default CardAssignmentTemplate;
