import {
	Body,
	Column,
	Container,
	Font,
	Head,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Row,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

/**
 * Shared design system for Proddy transactional email.
 *
 * Email clients don't support CSS custom properties, so the brand tokens from
 * `src/app/globals.css` are hand-converted to hex here and reused everywhere.
 * Every template renders through <EmailLayout>, so the branded header, page
 * frame, and legal footer stay identical across the whole suite.
 *
 * Brand purple: `--primary: 280 77% 23%` → #4A0D68 (LOCKED in globals.css).
 */

// --- Brand + neutral tokens -------------------------------------------------

export const BRAND_PURPLE = "#4A0D68";
export const BRAND_PURPLE_DARK = "#38094F";

/** Near-black with a whisper of the brand hue — headings. */
export const INK = "#171226";
/** Body copy. ~9:1 on white. */
export const BODY = "#454154";
/** Secondary / metadata. ~5.4:1 on white — safe at 14px+. */
export const MUTED = "#6B6779";
/** Page background behind the card. */
export const PAGE_BG = "#F1F0F5";
/** Callout / detail surface — brand-tinted neutral. */
export const SURFACE = "#F7F6FA";
export const BORDER = "#E5E3EC";
export const BORDER_SUBTLE = "#EEEDF3";

// Semantic status colors (import result, etc.)
export const SUCCESS = "#1A7F4B";
export const SUCCESS_BG = "#E7F5EE";
export const DANGER = "#B42318";
export const DANGER_BG = "#FDECEA";
export const WARNING = "#8A5A00";
export const WARNING_BG = "#FBF1DD";

/** Kept for backward compatibility with templates that import it directly. */
export const BRAND_HEADING = INK;

const FONT_STACK =
	'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL ??
	process.env.SITE_URL ??
	"https://proddyai.app";

// --- Shared inline style objects -------------------------------------------

export const emailMain = {
	backgroundColor: PAGE_BG,
	fontFamily: FONT_STACK,
	margin: "0",
	padding: "32px 16px",
	WebkitFontSmoothing: "antialiased" as const,
};

/** The white card. Header/body/footer regions live inside. */
export const emailContainer = {
	backgroundColor: "#ffffff",
	border: `1px solid ${BORDER}`,
	borderRadius: "16px",
	margin: "0 auto",
	maxWidth: "600px",
	overflow: "hidden" as const,
	width: "100%",
};

const emailHeader = {
	borderBottom: `1px solid ${BORDER_SUBTLE}`,
	padding: "22px 32px",
};

const emailHeaderLogo = {
	borderRadius: "7px",
	display: "block",
};

const emailWordmark = {
	color: INK,
	fontSize: "17px",
	fontWeight: "700",
	letterSpacing: "-0.01em",
	lineHeight: "28px",
	margin: "0",
};

const emailBody = {
	padding: "32px 32px 12px",
};

// Retained export: older templates reference `emailLogo` / `emailSection`.
export const emailLogo = {
	display: "block",
	margin: "0",
};

export const emailSection = {
	padding: "0",
};

export const emailHeading = {
	color: INK,
	fontSize: "22px",
	fontWeight: "700",
	letterSpacing: "-0.02em",
	lineHeight: "1.3",
	margin: "0 0 18px",
	textAlign: "left" as const,
};

export const emailSubHeading = {
	color: INK,
	fontSize: "16px",
	fontWeight: "600",
	lineHeight: "1.4",
	margin: "24px 0 10px",
};

export const emailText = {
	color: BODY,
	fontSize: "15px",
	lineHeight: "1.65",
	margin: "0 0 16px",
};

export const emailMutedText = {
	color: MUTED,
	fontSize: "13px",
	lineHeight: "1.6",
	margin: "16px 0",
	textAlign: "center" as const,
};

export const emailButtonContainer = {
	margin: "28px 0 4px",
	textAlign: "left" as const,
};

export const emailButton = {
	backgroundColor: BRAND_PURPLE,
	borderRadius: "9px",
	color: "#ffffff",
	display: "inline-block",
	fontSize: "15px",
	fontWeight: "600",
	lineHeight: "1",
	padding: "14px 28px",
	textAlign: "center" as const,
	textDecoration: "none",
};

export const emailHr = {
	borderColor: BORDER_SUBTLE,
	borderStyle: "solid",
	borderWidth: "1px 0 0",
	margin: "28px 0",
};

export const emailFooter = {
	color: MUTED,
	fontSize: "13px",
	lineHeight: "1.6",
	margin: "0",
	textAlign: "left" as const,
};

export const emailLink = {
	color: BRAND_PURPLE,
	textDecoration: "underline",
};

// --- Callout box (quoted message / invitation note / security notice) ------

export const emailCalloutBox = {
	backgroundColor: SURFACE,
	border: `1px solid ${BORDER}`,
	borderRadius: "12px",
	margin: "20px 0",
	padding: "18px 20px",
};

export const emailCalloutText = {
	color: BODY,
	fontSize: "15px",
	fontStyle: "italic",
	lineHeight: "1.6",
	margin: "0",
};

export const emailCalloutLabel = {
	color: MUTED,
	fontSize: "11px",
	fontWeight: "700",
	letterSpacing: "0.06em",
	lineHeight: "1.4",
	margin: "0 0 8px",
	textTransform: "uppercase" as const,
};

export const emailCalloutHeading = {
	color: INK,
	fontSize: "17px",
	fontWeight: "600",
	lineHeight: "1.4",
	margin: "0 0 6px",
};

// --- Key / value detail list (card + issue + billing details) --------------

const detailListBox = {
	border: `1px solid ${BORDER}`,
	borderRadius: "12px",
	margin: "20px 0",
	overflow: "hidden" as const,
};

const detailLabelCol = {
	padding: "12px 16px",
	verticalAlign: "top" as const,
	width: "42%",
};

const detailValueCol = {
	padding: "12px 16px",
	textAlign: "right" as const,
	verticalAlign: "top" as const,
};

const detailLabel = {
	color: MUTED,
	fontSize: "13px",
	fontWeight: "500",
	lineHeight: "1.4",
	margin: "0",
};

const detailValue = {
	color: INK,
	fontSize: "14px",
	fontWeight: "600",
	lineHeight: "1.4",
	margin: "0",
};

export interface EmailDetailItem {
	label: string;
	value: React.ReactNode;
}

/**
 * A bordered key/value table. Uses <Row>/<Column> (which render as a real
 * table) so alignment survives Gmail, Outlook, and Apple Mail — flexbox and
 * `justify-content` do not.
 */
export const EmailDetailList: React.FC<
	Readonly<{ items: EmailDetailItem[]; strong?: boolean }>
> = ({ items }) => (
	<Section style={detailListBox}>
		{items.map((item, index) => (
			<Row
				key={item.label}
				style={{
					backgroundColor: index % 2 === 0 ? "#ffffff" : SURFACE,
					borderTop: index === 0 ? "none" : `1px solid ${BORDER_SUBTLE}`,
				}}
			>
				<Column style={detailLabelCol}>
					<Text style={detailLabel}>{item.label}</Text>
				</Column>
				<Column style={detailValueCol}>
					<Text style={detailValue}>{item.value}</Text>
				</Column>
			</Row>
		))}
	</Section>
);

// --- Status badge (import result) ------------------------------------------

const badgeTone: Record<
	"success" | "danger" | "warning" | "neutral",
	{ bg: string; fg: string }
> = {
	success: { bg: SUCCESS_BG, fg: SUCCESS },
	danger: { bg: DANGER_BG, fg: DANGER },
	warning: { bg: WARNING_BG, fg: WARNING },
	neutral: { bg: SURFACE, fg: MUTED },
};

export const EmailStatusBadge: React.FC<
	Readonly<{ tone: keyof typeof badgeTone; label: string }>
> = ({ tone, label }) => {
	const { bg, fg } = badgeTone[tone];
	return (
		<Text
			style={{
				backgroundColor: bg,
				borderRadius: "999px",
				color: fg,
				display: "inline-block",
				fontSize: "12px",
				fontWeight: "700",
				letterSpacing: "0.05em",
				lineHeight: "1",
				margin: "0 0 18px",
				padding: "7px 13px",
				textTransform: "uppercase" as const,
			}}
		>
			{label}
		</Text>
	);
};

// --- Layout shell -----------------------------------------------------------

// Footer style objects
const footerWrap = {
	margin: "0 auto",
	maxWidth: "600px",
	padding: "24px 16px 8px",
	textAlign: "center" as const,
	width: "100%",
};

const footerBrand = {
	color: INK,
	fontSize: "13px",
	fontWeight: "700",
	letterSpacing: "-0.01em",
	margin: "0 0 4px",
};

const footerTagline = {
	color: MUTED,
	fontSize: "12px",
	lineHeight: "1.5",
	margin: "0 0 12px",
};

const footerLinks = {
	color: MUTED,
	fontSize: "12px",
	lineHeight: "1.5",
	margin: "0 0 12px",
};

const footerLink = {
	color: BRAND_PURPLE,
	textDecoration: "none",
	fontWeight: "500",
};

const footerLegal = {
	color: MUTED,
	fontSize: "11px",
	lineHeight: "1.5",
	margin: "0",
};

interface EmailLayoutProps {
	previewText: string;
	children: React.ReactNode;
}

/**
 * Wraps every template in the shared Html/Head/Body frame: brand header with
 * logo + wordmark, the white content card, and the legal footer.
 */
export const EmailLayout: React.FC<Readonly<EmailLayoutProps>> = ({
	previewText,
	children,
}) => {
	const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;
	const year = new Date().getFullYear();

	return (
		<Html lang="en">
			<Head>
				<meta content="light" name="color-scheme" />
				<meta content="light" name="supported-color-schemes" />
				<Font
					fallbackFontFamily="Helvetica"
					fontFamily="Poppins"
					fontStyle="normal"
					fontWeight={400}
					webFont={{
						url: "https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecnFHGPc.woff2",
						format: "woff2",
					}}
				/>
			</Head>
			<Preview>{previewText}</Preview>
			<Body style={emailMain}>
				<Container style={emailContainer}>
					<Section style={emailHeader}>
						<Row>
							{logoUrl ? (
								<Column style={{ width: "34px", verticalAlign: "middle" }}>
									<Img
										alt="Proddy"
										height="26"
										src={logoUrl}
										style={emailHeaderLogo}
										width="26"
									/>
								</Column>
							) : null}
							<Column style={{ verticalAlign: "middle" }}>
								<Text style={emailWordmark}>Proddy</Text>
							</Column>
						</Row>
					</Section>

					<Section style={emailBody}>{children}</Section>
				</Container>

				<Section style={footerWrap}>
					<Text style={footerBrand}>Proddy</Text>
					<Text style={footerTagline}>
						Turn conversation into shipped work — in one workspace.
					</Text>
					<Text style={footerLinks}>
						<Link href={APP_URL} style={footerLink}>
							Open Proddy
						</Link>
						{"  ·  "}
						<Link href={`${APP_URL}/workspace`} style={footerLink}>
							Notification settings
						</Link>
					</Text>
					<Text style={footerLegal}>© {year} Proddy. All rights reserved.</Text>
				</Section>
			</Body>
		</Html>
	);
};

// --- Unsubscribe line -------------------------------------------------------

const emailUnsubscribeText = {
	color: MUTED,
	fontSize: "12px",
	lineHeight: "1.5",
	margin: "16px 0 0",
	textAlign: "left" as const,
};

export const emailUnsubscribeLink = {
	color: BRAND_PURPLE,
	textDecoration: "underline",
};

interface EmailUnsubscribeLineProps {
	unsubscribeUrl?: string;
	label: string;
}

/**
 * "Don't want to receive X notifications? Unsubscribe" — shown under the
 * contextual footer note when an unsubscribe URL is available.
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
				Unsubscribe
			</Link>
		</Text>
	);
};

// `Hr` re-exported so templates can keep a single import site if desired.
export { Hr };
