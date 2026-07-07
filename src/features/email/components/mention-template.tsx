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

interface MentionTemplateProps {
	firstName: string;
	mentionerName: string;
	messagePreview: string;
	channelName?: string;
	messageUrl?: string;
	workspaceUrl?: string;
	workspaceName?: string;
	unsubscribeUrl?: string;
}

export const MentionTemplate: React.FC<Readonly<MentionTemplateProps>> = ({
	firstName,
	mentionerName,
	messagePreview,
	channelName = "a channel",
	messageUrl,
	workspaceUrl = process.env.NEXT_PUBLIC_APP_URL,
	workspaceName = "Proddy",
	unsubscribeUrl,
}) => {
	const previewText = `${mentionerName} mentioned you in ${channelName}`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>You were mentioned</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					<strong>{mentionerName}</strong> mentioned you in {channelName}.
				</Text>

				<Section style={emailCalloutBox}>
					<Text style={emailCalloutText}>&quot;{messagePreview}&quot;</Text>
				</Section>

				<Section style={emailButtonContainer}>
					<Button href={messageUrl || workspaceUrl} style={emailButton}>
						View Message
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
				label="mention notifications"
				unsubscribeUrl={unsubscribeUrl}
			/>
		</EmailLayout>
	);
};

export default MentionTemplate;
