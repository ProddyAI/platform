import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	EmailLayout,
	emailButton,
	emailButtonContainer,
	emailCalloutBox,
	emailCalloutLabel,
	emailFooter,
	emailHeading,
	emailMutedText,
	emailSection,
	emailText,
} from "./email-layout";

interface InviteMailTemplateProps {
	senderName: string;
	senderEmail: string;
	workspaceName: string;
	inviteLink: string;
	comment?: string;
}

// Styles specific to this template (not shared across other templates)
const noteText = {
	color: "#334155",
	fontSize: "15px",
	lineHeight: "1.5",
	margin: "0",
	whiteSpace: "pre-wrap" as const,
};

const warningText = {
	color: "#334155",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0",
};

// Helper component to create the email content
function InviteMailContent({
	senderName,
	senderEmail,
	workspaceName,
	inviteLink,
	comment,
}: InviteMailTemplateProps) {
	const invitationNote = comment?.trim();

	return (
		<>
			<Heading style={emailHeading}>
				You&apos;ve been invited to join a workspace
			</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>
					<strong>{senderName}</strong> ({senderEmail}) has invited you to join
					the workspace <strong>{workspaceName}</strong> on Proddy.
				</Text>

				{invitationNote ? (
					<Section style={emailCalloutBox}>
						<Text style={emailCalloutLabel}>Invitation note</Text>
						<Text style={noteText}>{invitationNote}</Text>
					</Section>
				) : null}

				<Section style={emailButtonContainer}>
					<Button href={inviteLink} style={emailButton}>
						Accept Invite
					</Button>
				</Section>

				<Text style={emailMutedText}>
					This invite will expire in <strong>48 hours</strong>.
				</Text>
			</Section>

			<Hr style={hr} />

			<Section style={emailCalloutBox}>
				<Text style={warningText}>
					<strong>Security notice:</strong> Only accept this invite if you trust
					the sender. Never share your login credentials with anyone.
				</Text>
			</Section>

			<Text style={emailFooter}>
				If you didn&apos;t expect this invitation, you can safely ignore this
				email.
			</Text>
		</>
	);
}

const hr = {
	borderColor: "#e5e7eb",
	margin: "30px 0",
};

export const InviteMailTemplate: React.FC<
	Readonly<InviteMailTemplateProps>
> = ({ senderName, senderEmail, workspaceName, inviteLink, comment }) => {
	const previewText = `You've been invited to join ${workspaceName}`;

	return (
		<EmailLayout previewText={previewText}>
			<InviteMailContent
				comment={comment}
				inviteLink={inviteLink}
				senderEmail={senderEmail}
				senderName={senderName}
				workspaceName={workspaceName}
			/>
		</EmailLayout>
	);
};
