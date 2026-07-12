import { Button, Heading, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	BRAND_PURPLE,
	EmailLayout,
	emailButton,
	emailButtonContainer,
	emailCalloutBox,
	emailFooter,
	emailHeading,
	emailHr,
	emailSection,
	emailText,
	Hr,
} from "./email-layout";

interface AutoInviteTemplateProps {
	firstName: string;
	workspaceName: string;
	platformName: string;
	email: string;
	workspaceUrl: string;
}

const noteText = {
	color: "#334155",
	fontSize: "14px",
	lineHeight: "1.6",
	margin: "0",
};

export const AutoInviteTemplate: React.FC<
	Readonly<AutoInviteTemplateProps>
> = ({ firstName, workspaceName, platformName, email, workspaceUrl }) => {
	const previewText = `You've been added to ${workspaceName} on Proddy`;

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>
				You&apos;ve been added to {workspaceName}
			</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {firstName},</Text>
				<Text style={emailText}>
					Your {platformName} account was linked to the{" "}
					<strong>{workspaceName}</strong> workspace on Proddy during a{" "}
					{platformName} import. Anything assigned to you has been brought over
					already.
				</Text>

				<Section style={emailButtonContainer}>
					<Button href={workspaceUrl} style={emailButton}>
						Open workspace
					</Button>
				</Section>

				<Section style={emailCalloutBox}>
					<Text style={noteText}>
						No account yet? Sign up with{" "}
						<strong style={{ color: BRAND_PURPLE }}>{email}</strong> and
						you&apos;ll get access automatically.
					</Text>
				</Section>
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				You received this because your {platformName} account was imported into{" "}
				{workspaceName} on Proddy.
			</Text>
		</EmailLayout>
	);
};

export default AutoInviteTemplate;
