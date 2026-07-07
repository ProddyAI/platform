import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	EmailLayout,
	EmailUnsubscribeLine,
	emailButton,
	emailButtonContainer,
	emailCalloutBox,
	emailCalloutText,
	emailFooter,
	emailHeading,
	emailHr,
	emailSection,
	emailText,
} from "./email-layout";

interface DirectMessageTemplateProps {
	firstName: string;
	senderName: string;
	messagePreview: string;
	workspaceUrl?: string;
	workspaceName?: string;
	unsubscribeUrl?: string;
}

export const DirectMessageTemplate: React.FC<
	Readonly<DirectMessageTemplateProps>
> = ({
	firstName,
	senderName,
	messagePreview,
	workspaceUrl = process.env.NEXT_PUBLIC_APP_URL,
	workspaceName = "Proddy",
	unsubscribeUrl,
}) => {
	const previewText = `New direct message from ${senderName}`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>New Direct Message</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					You have received a new direct message from{" "}
					<strong>{senderName}</strong> in {workspaceName}.
				</Text>

				<Section style={emailCalloutBox}>
					<Text style={emailCalloutText}>&quot;{messagePreview}&quot;</Text>
				</Section>

				<Section style={emailButtonContainer}>
					<Button href={workspaceUrl} style={emailButton}>
						View Message
					</Button>
				</Section>
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				This email was sent by Proddy. If you didn&apos;t expect this email, you
				can safely ignore it.
			</Text>

			<EmailUnsubscribeLine
				label="direct message notifications"
				unsubscribeUrl={unsubscribeUrl}
			/>
		</EmailLayout>
	);
};

export default DirectMessageTemplate;
