import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	BRAND_PURPLE,
	EmailLayout,
	emailButton,
	emailButtonContainer,
	emailCalloutBox,
	emailFooter,
	emailHeading,
	emailMutedText,
	emailSection,
	emailText,
} from "./email-layout";

interface PasswordResetMailProps {
	email: string;
	resetLink: string;
}

export const PasswordResetMail: React.FC<Readonly<PasswordResetMailProps>> = ({
	email,
	resetLink,
}) => {
	const previewText = "Reset your Proddy password";

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>Reset Your Password</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>
					You recently requested to reset your password for your{" "}
					<strong>Proddy</strong> account. Click the button below to reset it.
				</Text>

				<Section style={emailButtonContainer}>
					<Button href={resetLink} style={emailButton}>
						Reset Password
					</Button>
				</Section>

				<Text style={emailMutedText}>
					Or copy and paste this link into your browser:
				</Text>
				<Text style={linkUrl}>{resetLink}</Text>

				<Text style={emailMutedText}>
					This password reset link will expire in <strong>1 hour</strong>.
				</Text>

				<Text style={emailText}>
					If you didn&apos;t request a password reset, you can safely ignore
					this email. Your password will remain unchanged.
				</Text>
			</Section>

			<Hr style={hr} />

			<Section style={emailCalloutBox}>
				<Text style={warningText}>
					<strong>Security notice:</strong> Never share this password reset link
					with anyone. Proddy staff will never ask for your password or reset
					link.
				</Text>
			</Section>

			<Text style={emailFooter}>
				This password reset email was sent to{" "}
				<strong style={{ color: BRAND_PURPLE }}>{email}</strong>
			</Text>
		</EmailLayout>
	);
};

// Styles specific to this template (not shared across other templates)
const linkUrl = {
	color: BRAND_PURPLE,
	fontSize: "12px",
	lineHeight: "1.5",
	margin: "0 0 16px",
	textAlign: "center" as const,
	wordBreak: "break-all" as const,
};

const hr = {
	borderColor: "#e5e7eb",
	margin: "30px 0",
};

const warningText = {
	color: "#334155",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0",
};
