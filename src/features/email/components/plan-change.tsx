import { Button, Heading, Section, Text } from "@react-email/components";
import type * as React from "react";
import {
	type EmailDetailItem,
	EmailDetailList,
	EmailLayout,
	emailButton,
	emailButtonContainer,
	emailFooter,
	emailHeading,
	emailHr,
	emailMutedText,
	emailSection,
	emailText,
	Hr,
	MUTED,
} from "./email-layout";

interface PlanChangeTemplateProps {
	recipientName: string;
	workspaceName: string;
	actionText: string; // "upgraded" | "downgraded"
	previousPlanLabel: string;
	newPlanLabel: string;
	changeType: "upgrade" | "downgrade";
	summaryRows: Array<[string, string]>;
	billingUrl?: string;
	invoiceUrl?: string;
}

const secondaryButton = {
	...emailButton,
	backgroundColor: "#ffffff",
	border: "1px solid #E5E3EC",
	color: "#171226",
	marginLeft: "10px",
};

export const PlanChangeTemplate: React.FC<
	Readonly<PlanChangeTemplateProps>
> = ({
	recipientName,
	workspaceName,
	actionText,
	previousPlanLabel,
	newPlanLabel,
	changeType,
	summaryRows,
	billingUrl,
	invoiceUrl,
}) => {
	const previewText = `${workspaceName} plan ${actionText} to ${newPlanLabel}`;

	const planRow: EmailDetailItem = {
		label: "Plan",
		value: `${previousPlanLabel} → ${newPlanLabel}`,
	};
	const details: EmailDetailItem[] = [
		planRow,
		...summaryRows.map(([label, value]) => ({ label, value })),
	];

	return (
		<EmailLayout previewText={previewText}>
			<Heading style={emailHeading}>Workspace plan {actionText}</Heading>
			<Section style={emailSection}>
				<Text style={emailText}>Hi {recipientName},</Text>
				<Text style={emailText}>
					The <strong>{workspaceName}</strong> workspace was {actionText} from{" "}
					<strong>{previousPlanLabel}</strong> to{" "}
					<strong>{newPlanLabel}</strong>.
				</Text>

				<EmailDetailList items={details} />

				{summaryRows.length > 0 ? (
					<Text style={{ ...emailMutedText, textAlign: "left" as const }}>
						{changeType === "downgrade"
							? "These amounts come from the payment and refund records for this plan change."
							: "These amounts come from the invoice for this plan change."}
					</Text>
				) : null}

				{billingUrl || invoiceUrl ? (
					<Section style={emailButtonContainer}>
						{billingUrl ? (
							<Button href={billingUrl} style={emailButton}>
								View billing
							</Button>
						) : null}
						{invoiceUrl ? (
							<Button href={invoiceUrl} style={secondaryButton}>
								View invoice
							</Button>
						) : null}
					</Section>
				) : null}
			</Section>

			<Hr style={emailHr} />

			<Text style={emailFooter}>
				<span style={{ color: MUTED }}>
					You received this because you&apos;re an owner or admin of{" "}
					{workspaceName}.
				</span>
			</Text>
		</EmailLayout>
	);
};

export default PlanChangeTemplate;
