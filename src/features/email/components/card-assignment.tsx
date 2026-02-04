import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

interface CardAssignmentTemplateProps {
	firstName: string;
	cardTitle: string;
	cardDescription?: string;
	dueDate?: string;
	priority?: string;
	listName?: string;
	channelName?: string;
	assignedBy?: string;
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
	workspaceUrl = process.env.NEXT_PUBLIC_APP_URL,
	workspaceName = "Proddy",
	unsubscribeUrl,
}) => {
	const previewText = `${assignedBy} assigned you to "${cardTitle}"`;

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
					<Heading style={heading}>Card Assignment</Heading>
					<Section style={section}>
						<Text style={text}>Hi {firstName},</Text>
						<Text style={text}>
							{assignedBy} has assigned you to a card in {workspaceName}.
						</Text>

						<Section style={cardContainer}>
							<Text style={cardTitle ? cardTitleStyle : {}}>{cardTitle}</Text>

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

						<Section style={buttonContainer}>
							<Button
								href={workspaceUrl}
								style={{
									...button,
									paddingLeft: "20px",
									paddingRight: "20px",
									paddingTop: "12px",
									paddingBottom: "12px",
								}}
							>
								View Card
							</Button>
						</Section>
					</Section>

					<Hr style={hr} />

					<Text style={footer}>
						This email was sent from Proddy, your team collaboration platform.
						If you didn't expect this email, you can safely ignore it.
					</Text>

					{unsubscribeUrl && (
						<Text style={unsubscribeText}>
							Don't want to receive task assignment notifications?{" "}
							<Link href={unsubscribeUrl} style={unsubscribeLink}>
								Unsubscribe from these emails
							</Link>
						</Text>
					)}
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

const cardContainer = {
	backgroundColor: "#f9fafb",
	border: "1px solid #e5e7eb",
	borderRadius: "5px",
	padding: "15px",
	margin: "24px 0",
};

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

const buttonContainer = {
	margin: "24px 0",
	textAlign: "center" as const,
};

const button = {
	backgroundColor: "#4F46E5",
	borderRadius: "5px",
	color: "#fff",
	display: "inline-block",
	fontSize: "14px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
};

const hr = {
	borderColor: "#e5e7eb",
	margin: "20px 0",
};

const footer = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "1.5",
	textAlign: "center" as const,
};

const unsubscribeText = {
	color: "#8898aa",
	fontSize: "11px",
	lineHeight: "1.4",
	textAlign: "center" as const,
	marginTop: "20px",
};

const unsubscribeLink = {
	color: "#4F46E5",
	textDecoration: "underline",
};

export default CardAssignmentTemplate;
