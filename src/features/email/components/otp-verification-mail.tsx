import { Heading, Hr, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	BRAND_PURPLE,
	EmailLayout,
	emailCalloutBox,
	emailFooter,
	emailHeading,
	emailHr,
	emailMutedText,
	emailSection,
	emailText,
} from "./email-layout";

interface OTPVerificationMailProps {
	email: string;
	otp: string;
}

export const OTPVerificationMail: React.FC<
	Readonly<OTPVerificationMailProps>
> = ({ email, otp }) => {
	const previewText = `Your OTP verification code is ${otp}`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>Verify Your Email Address</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>
					Thank you for signing up for <strong>Proddy</strong>! To complete your
					registration, please use the verification code below:
				</Text>

				<Section style={otpContainer}>
					<Text style={otpCode}>{otp}</Text>
				</Section>

				<Text style={emailMutedText}>
					This code will expire in <strong>10 minutes</strong>.
				</Text>

				<Text style={emailText}>
					If you didn&apos;t request this code, you can safely ignore this
					email.
				</Text>
			</Section>

			<Hr style={emailHr} />

			<Section style={emailCalloutBox}>
				<Text style={warningText}>
					<strong>Security notice:</strong> Never share this verification code
					with anyone. Proddy staff will never ask for your verification code.
				</Text>
			</Section>

			<Text style={emailFooter}>
				This verification email was sent to{" "}
				<strong style={{ color: BRAND_PURPLE }}>{email}</strong>
			</Text>
		</EmailLayout>
	);
};

// Styles specific to this template (not shared across other templates)
const otpContainer = {
	backgroundColor: "#f0f0f0",
	borderRadius: "8px",
	padding: "20px",
	margin: "30px 0",
	textAlign: "center" as const,
	border: "2px solid #e0e0e0",
};

const otpCode = {
	color: BRAND_PURPLE,
	fontSize: "36px",
	fontWeight: "700",
	letterSpacing: "8px",
	margin: "0",
	fontFamily: "monospace",
	textAlign: "center" as const,
};

const warningText = {
	color: "#334155",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0",
};
