import {
	Body,
	Button,
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

interface PasswordResetMailProps {
	email: string;
	resetLink: string;
}

export const PasswordResetMail: React.FC<
	Readonly<PasswordResetMailProps>
> = ({ email, resetLink }) => {
	const previewText = "Reset your Proddy password";

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={main}>
				<Container style={container}>
					<Img
						src="https://proddy.tech/logo-nobg.png"
						width="40"
						height="40"
						alt="Proddy"
						style={logo}
					/>
					<Heading style={heading}>Reset Your Password</Heading>
					<Section style={section}>
						<Text style={text}>
							You recently requested to reset your password for your{" "}
							<strong>Proddy</strong> account. Click the button below to reset
							it.
						</Text>

						<Button style={button} href={resetLink}>
							Reset Password
						</Button>

						<Text style={linkText}>
							Or copy and paste this link into your browser:
						</Text>
						<Text style={linkUrl}>{resetLink}</Text>

						<Text style={expiryText}>
							This password reset link will expire in <strong>1 hour</strong>.
						</Text>

						<Text style={text}>
							If you didn't request a password reset, you can safely ignore this
							email. Your password will remain unchanged.
						</Text>
					</Section>

					<Hr style={hr} />

					<Section style={warningContainer}>
						<Text style={warningText}>
							<strong>🔒 Security Notice:</strong> Never share this password
							reset link with anyone. Proddy staff will never ask for your
							password or reset link.
						</Text>
					</Section>

					<Text style={footer}>
						This password reset email was sent to{" "}
						<strong style={{ color: "#0070f3" }}>{email}</strong>
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

// Styles matching otp-verification-mail.tsx
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

const button = {
	backgroundColor: "#0070f3",
	borderRadius: "5px",
	color: "#fff",
	display: "block",
	fontSize: "16px",
	fontWeight: "600",
	textAlign: "center" as const,
	textDecoration: "none",
	padding: "12px 24px",
	margin: "30px auto",
	width: "fit-content",
};

const linkText = {
	color: "#666",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "16px 0 8px",
	textAlign: "center" as const,
};

const linkUrl = {
	color: "#0070f3",
	fontSize: "12px",
	lineHeight: "1.5",
	margin: "0 0 16px",
	textAlign: "center" as const,
	wordBreak: "break-all" as const,
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
