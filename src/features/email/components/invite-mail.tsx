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

interface InviteMailTemplateProps {
	senderName: string;
	senderEmail: string;
	workspaceName: string;
	inviteLink: string;
}

export const InviteMailTemplate: React.FC<Readonly<InviteMailTemplateProps>> = ({
	senderName,
	senderEmail,
	workspaceName,
	inviteLink,
}) => {
	const previewText = `You've been invited to join ${workspaceName}`;

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
					<Heading style={heading}>You've been invited to join a workspace</Heading>
					<Section style={section}>
						<Text style={text}>
							<strong>{senderName}</strong> ({senderEmail}) has invited you to
							join the workspace <strong>{workspaceName}</strong> on Proddy.
						</Text>

						<Section style={buttonContainer}>
							<Button
								style={{
									...button,
									paddingLeft: "24px",
									paddingRight: "24px",
									paddingTop: "12px",
									paddingBottom: "12px",
								}}
								href={inviteLink}
							>
								Accept Invite
							</Button>
						</Section>

						<Text style={expiryText}>
							This invite will expire in <strong>48 hours</strong>.
						</Text>
					</Section>

					<Hr style={hr} />

					<Section style={warningContainer}>
						<Text style={warningText}>
							<strong>⚠️ Security Notice:</strong> Only accept this invite if
							you trust the sender. Never share your login credentials with
							anyone.
						</Text>
					</Section>

					<Text style={footer}>
						If you didn't expect this invitation, you can safely ignore this
						email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

// Styles
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

const buttonContainer = {
	margin: "30px 0",
	textAlign: "center" as const,
};

const button = {
	backgroundColor: "#0070f3",
	borderRadius: "5px",
	color: "#fff",
	display: "inline-block",
	fontSize: "14px",
	fontWeight: "600",
	textDecoration: "none",
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

export default InviteMailTemplate;
