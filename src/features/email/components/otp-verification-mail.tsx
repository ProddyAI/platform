import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

interface OTPVerificationMailProps {
	email: string;
	otp: string;
}

export const OTPVerificationMail: React.FC<
	Readonly<OTPVerificationMailProps>
> = ({ email, otp }) => {
	const previewText = `Your OTP verification code is ${otp}`;

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Img
						alt="Proddy"
						height="40"
						src="https://proddy.tech/logo-nobg.png"
						style={logo}
						width="40"
					/>
					<Heading style={heading}>Verify Your Email Address</Heading>
					<Section style={section}>
						<Text style={text}>
							Thank you for signing up for <strong>Proddy</strong>! To complete
							your registration, please use the verification code below:
						</Text>

						<Section style={otpContainer}>
							<Text style={otpCode}>{otp}</Text>
						</Section>

						<Text style={expiryText}>
							This code will expire in <strong>10 minutes</strong>.
						</Text>

						<Text style={text}>
							If you didn't request this code, you can safely ignore this email.
						</Text>
					</Section>

					<Hr style={hr} />

					<Section style={warningContainer}>
						<Text style={warningText}>
							<strong>🔒 Security Notice:</strong> Never share this verification
							code with anyone. Proddy staff will never ask for your
							verification code.
						</Text>
					</Section>

					<Text style={footer}>
						This verification email was sent to{" "}
						<strong style={{ color: "#0070f3" }}>{email}</strong>
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

// Styles (matching invite-mail.tsx pattern)
const main = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	padding: "40px 0",
};

const container = {
	backgroundColor: "#ffffff",
	border: "1px solid #eee",
	borderRadius: "5px",
	boxShadow: "0 5px 10px rgba(20, 50, 70, 0.05)",
	margin: "0 auto",
	maxWidth: "600px",
	padding: "20px",
};

const logo = {
	margin: "0 auto 20px",
	display: "block",
};

const heading = {
	color: "#0E1C36",
	fontSize: "24px",
	fontWeight: "600",
	lineHeight: "1.3",
	margin: "15px 0",
	textAlign: "center" as const,
};

const section = {
	padding: "0 10px",
};

const text = {
	color: "#4A5568",
	fontSize: "16px",
	lineHeight: "1.5",
	margin: "16px 0",
};

const otpContainer = {
	backgroundColor: "#f0f0f0",
	borderRadius: "8px",
	padding: "20px",
	margin: "30px 0",
	textAlign: "center" as const,
	border: "2px solid #e0e0e0",
};

const otpCode = {
	color: "#0070f3",
	fontSize: "36px",
	fontWeight: "700",
	letterSpacing: "8px",
	margin: "0",
	fontFamily: "monospace",
	textAlign: "center" as const,
};

const expiryText = {
	color: "#666",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "16px 0",
	textAlign: "center" as const,
};

const hr = {
	borderColor: "#e5e7eb",
	margin: "30px 0",
};

const warningContainer = {
	backgroundColor: "#fff3cd",
	borderLeft: "4px solid #ffc107",
	padding: "15px",
	margin: "20px 0",
	borderRadius: "4px",
};

const warningText = {
	color: "#856404",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0",
};

const footer = {
	color: "#999",
	fontSize: "12px",
	lineHeight: "1.5",
	textAlign: "center" as const,
	marginTop: "30px",
};
