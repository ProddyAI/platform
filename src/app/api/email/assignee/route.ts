import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { Id } from "@/../convex/_generated/dataModel";
import { CardAssignmentTemplate } from "@/features/email/components/card-assignment";
import { shouldSendEmailServer } from "@/lib/email-preferences-server";
import { generateUnsubscribeUrl } from "@/lib/email-unsubscribe";

// Log the API key (masked for security)
const apiKey = process.env.RESEND_API_KEY;
if (apiKey) {
	const _maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

const resend = new Resend(apiKey);

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		const {
			to,
			userId,
			firstName,
			cardTitle,
			cardDescription,
			dueDate,
			priority,
			listName,
			channelName,
			assignedBy,
			workspaceUrl,
			workspaceName,
		} = body;

		// Validate required fields
		if (!to || !userId) {
			console.error("Missing required fields: to (email address) and userId");
			return NextResponse.json(
				{ error: "Missing required fields: to (email address) and userId" },
				{ status: 400 }
			);
		}

		// Check if user wants to receive assignee emails
		const shouldSend = await shouldSendEmailServer(
			userId as Id<"users">,
			"assignee"
		);
		if (!shouldSend) {
			return NextResponse.json(
				{ success: true, message: "Email skipped - user has unsubscribed" },
				{ status: 200 }
			);
		}

		// Generate unsubscribe URL
		const unsubscribeUrl = generateUnsubscribeUrl(userId, "assignee");

		// Set the subject for card assignment emails
		const subject = `Card Assignment: ${cardTitle}`;

		// Create the card assignment email template
		const emailTemplate = CardAssignmentTemplate({
			firstName: firstName || "User",
			cardTitle: cardTitle || "Task",
			cardDescription,
			dueDate: dueDate ? new Date(dueDate).toLocaleDateString() : undefined,
			priority,
			listName,
			channelName,
			assignedBy,
			workspaceUrl,
			workspaceName,
			unsubscribeUrl,
		});

		// Validate the from address
		// Use Resend's default domain as a fallback if your domain isn't verified
		const fromAddress =
			process.env.RESEND_FROM_EMAIL || "Proddy <support@proddy.tech>";
		const replyToAddress =
			process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@proddy.tech";

		try {
			const { data, error } = await resend.emails.send({
				from: fromAddress,
				to: [to],
				subject,
				react: emailTemplate,
				replyTo: replyToAddress,
			});

			if (error) {
				console.error("Email sending error from Resend:", error);

				// Try with the test email as a fallback
				try {
					const fallbackResult = await resend.emails.send({
						from: fromAddress,
						to: ["delivered@resend.dev"],
						subject: `[TEST] ${subject}`,
						react: emailTemplate,
					});

					if (fallbackResult.error) {
						console.error("Fallback email also failed:", fallbackResult.error);
						return NextResponse.json(
							{
								error: "Email sending failed on both attempts",
								details: error,
								fallbackError: fallbackResult.error,
							},
							{ status: 400 }
						);
					}

					return NextResponse.json(
						{
							success: true,
							warning:
								"Used fallback email address instead of the actual recipient",
							data: fallbackResult.data,
						},
						{ status: 200 }
					);
				} catch (fallbackError) {
					console.error("Fallback email failed with exception:", fallbackError);
					return NextResponse.json(
						{
							error: "Email sending failed on both attempts",
							details: error,
							exception:
								fallbackError instanceof Error
									? fallbackError.message
									: String(fallbackError),
						},
						{ status: 400 }
					);
				}
			}

			return NextResponse.json(
				{
					success: true,
					data,
					message: "Email sent successfully",
				},
				{ status: 200 }
			);
		} catch (resendError) {
			console.error("Resend API exception:", resendError);
			return NextResponse.json(
				{
					error: "Failed to send email",
					message:
						resendError instanceof Error
							? resendError.message
							: "Unknown error",
					stack:
						process.env.NODE_ENV === "development"
							? resendError instanceof Error
								? resendError.stack
								: undefined
							: undefined,
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Email API error:", error);
		// Return a more detailed error response
		return NextResponse.json(
			{
				error: "Failed to send email",
				message: error instanceof Error ? error.message : "Unknown error",
				stack:
					process.env.NODE_ENV === "development"
						? error instanceof Error
							? error.stack
							: undefined
						: undefined,
			},
			{ status: 500 }
		);
	}
}
