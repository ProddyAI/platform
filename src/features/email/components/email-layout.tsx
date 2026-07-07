import {
	Body,
	Container,
	Head,
	Html,
	Img,
	Link,
	Preview,
	Text,
} from "@react-email/components";
import type * as React from "react";

/**
 * Shared layout building blocks for transactional email templates.
 *
 * Brand purple is derived from `--primary: 280 77% 23%` in src/app/globals.css,
 * converted to hex since email clients don't support CSS custom properties.
 */
export const BRAND_PURPLE = "#4A0D68";
export const BRAND_HEADING = "#0E1C36";

export const emailMain = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	padding: "40px 0",
};

export const emailContainer = {
	backgroundColor: "#ffffff",
	border: "1px solid #eee",
	borderRadius: "5px",
	boxShadow: "0 5px 10px rgba(20, 50, 70, 0.05)",
	margin: "0 auto",
	maxWidth: "600px",
	padding: "20px",
};

export const emailLogo = {
	margin: "0 auto 20px",
	display: "block",
};

export const emailHeading = {
	color: BRAND_HEADING,
	fontSize: "24px",
	fontWeight: "600",
	lineHeight: "1.3",
	margin: "15px 0",
	textAlign: "center" as const,
};

export const emailSubHeading = {
	color: BRAND_HEADING,
	fontSize: "18px",
	fontWeight: "600",
	lineHeight: "1.4",
	margin: "20px 0 10px",
};

export const emailSection = {
	padding: "0 10px",
};

export const emailText = {
	color: "#4A5568",
	fontSize: "16px",
	lineHeight: "1.5",
	margin: "16px 0",
};

export const emailMutedText = {
	color: "#666",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "16px 0",
	textAlign: "center" as const,
};

export const emailButtonContainer = {
	margin: "24px 0",
	textAlign: "center" as const,
};

export const emailButton = {
	backgroundColor: BRAND_PURPLE,
	borderRadius: "5px",
	color: "#fff",
	display: "inline-block",
	fontSize: "14px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
	paddingLeft: "20px",
	paddingRight: "20px",
	paddingTop: "12px",
	paddingBottom: "12px",
};

export const emailHr = {
	borderColor: "#e5e7eb",
	margin: "20px 0",
};

export const emailFooter = {
	color: "#8898aa",
	fontSize: "12px",
	lineHeight: "1.5",
	textAlign: "center" as const,
};

export const emailUnsubscribeText = {
	color: "#8898aa",
	fontSize: "11px",
	lineHeight: "1.4",
	textAlign: "center" as const,
	marginTop: "20px",
};

export const emailUnsubscribeLink = {
	color: BRAND_PURPLE,
	textDecoration: "underline",
};

export const emailLink = {
	color: BRAND_PURPLE,
	textDecoration: "underline",
};

// Message-quote / callout box: quoted message previews, invitation notes, and
// security notices all share this treatment instead of each template
// inventing its own background/border/radius combination.
export const emailCalloutBox = {
	backgroundColor: "#f9fafb",
	border: "1px solid #e5e7eb",
	borderRadius: "5px",
	padding: "15px",
	margin: "24px 0",
};

export const emailCalloutText = {
	color: "#4A5568",
	fontSize: "16px",
	fontStyle: "italic",
	lineHeight: "1.5",
	margin: "0",
};

export const emailCalloutLabel = {
	color: "#64748b",
	fontSize: "12px",
	fontWeight: "600",
	letterSpacing: "0.04em",
	lineHeight: "1.4",
	margin: "0 0 6px",
	textTransform: "uppercase" as const,
};

interface EmailLayoutProps {
	previewText: string;
	children: React.ReactNode;
}

/**
 * Wraps the Html/Head/Preview/Body/Container/logo shell shared by every
 * template, so individual templates only need to render their own content.
 */
export const EmailLayout: React.FC<Readonly<EmailLayoutProps>> = ({
	previewText,
	children,
}) => {
	const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;

	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body style={emailMain}>
				<Container style={emailContainer}>
					{logoUrl ? (
						<Img
							alt="Proddy"
							height="40"
							src={logoUrl}
							style={emailLogo}
							width="40"
						/>
					) : null}
					{children}
				</Container>
			</Body>
		</Html>
	);
};

interface EmailUnsubscribeLineProps {
	unsubscribeUrl?: string;
	label: string;
}

/**
 * The standard "Don't want to receive X notifications? Unsubscribe" line
 * shown under the footer note, when an unsubscribe URL is available.
 */
export const EmailUnsubscribeLine: React.FC<
	Readonly<EmailUnsubscribeLineProps>
> = ({ unsubscribeUrl, label }) => {
	if (!unsubscribeUrl) {
		return null;
	}

	return (
		<Text style={emailUnsubscribeText}>
			Don&apos;t want to receive {label}?{" "}
			<Link href={unsubscribeUrl} style={emailUnsubscribeLink}>
				Unsubscribe from these emails
			</Link>
		</Text>
	);
};
