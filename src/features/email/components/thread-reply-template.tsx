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

interface ThreadReplyTemplateProps {
	firstName: string;
	replierName: string;
	originalMessagePreview: string;
	replyMessagePreview: string;
	channelName?: string;
	threadUrl?: string;
	workspaceUrl?: string;
	workspaceName?: string;
	unsubscribeUrl?: string;
}

export const ThreadReplyTemplate: React.FC<
	Readonly<ThreadReplyTemplateProps>
> = ({
	firstName,
	replierName,
	originalMessagePreview,
	replyMessagePreview,
	channelName = "a channel",
	threadUrl,
	workspaceUrl = process.env.NEXT_PUBLIC_APP_URL,
	workspaceName = "Proddy",
	unsubscribeUrl,
}) => {
	const previewText = `${replierName} replied to your message in ${channelName}`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>New Reply to Your Message</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					<strong>{replierName}</strong> replied to your message in{" "}
					{channelName}.
				</Text>

				<Section style={emailCalloutBox}>
					<Section style={originalQuoteBlock}>
						<Text style={originalMessageText}>
							<strong>Your message:</strong>
						</Text>
						<Text style={originalQuoteText}>
							&quot;{originalMessagePreview}&quot;
						</Text>
					</Section>

					<Hr style={messageDivider} />

					<Text style={replyMessageText}>
						<strong>Reply from {replierName}:</strong>
					</Text>
					<Text style={messageText}>&quot;{replyMessagePreview}&quot;</Text>
				</Section>

				<Section style={emailButtonContainer}>
					<Button href={threadUrl || workspaceUrl} style={emailButton}>
						View Thread
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
				label="thread reply notifications"
				unsubscribeUrl={unsubscribeUrl}
			/>
		</EmailLayout>
	);
};

// Styles specific to this template (not shared across other templates)
const originalQuoteBlock = {
	borderLeft: "3px solid #e5e7eb",
	margin: "0 0 12px 0",
	paddingLeft: "12px",
};

const originalMessageText = {
	color: "#6b7280",
	fontSize: "14px",
	fontWeight: "600",
	lineHeight: "1.5",
	margin: "0 0 8px 0",
};

const replyMessageText = {
	color: "#4A5568",
	fontSize: "14px",
	fontWeight: "600",
	lineHeight: "1.5",
	margin: "8px 0",
};

const originalQuoteText = {
	color: "#6b7280",
	fontSize: "16px",
	fontStyle: "italic",
	lineHeight: "1.5",
	margin: "0 0 8px 0",
};

const messageText = {
	color: "#4A5568",
	fontSize: "16px",
	fontStyle: "italic",
	lineHeight: "1.5",
	margin: "0 0 8px 0",
};

const messageDivider = {
	borderColor: "#e5e7eb",
	margin: "12px 0",
};

export default ThreadReplyTemplate;
