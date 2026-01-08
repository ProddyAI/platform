import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { Id } from "@/../convex/_generated/dataModel";
import { MentionTemplate } from "@/features/email/components/mention-template";
import { shouldSendEmailServer } from "@/lib/email-preferences-server";
import { generateUnsubscribeUrl } from "@/lib/email-unsubscribe";

const apiKey = process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

export async function POST(req: NextRequest) {
	try {
		console.log("Mention Email API received request");
		const body = await req.json();
		console.log("Mention Email request body:", JSON.stringify(body, null, 2));

		const {
			to,
			userId,
			firstName,
			mentionerName,
			messagePreview,
			channelName,
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

		// Check if user wants to receive mention emails
		const shouldSend = await shouldSendEmailServer(
			userId as Id<"users">,
			"mentions"
		);
		if (!shouldSend) {
			console.log("User has unsubscribed from mention emails, skipping send");
			return NextResponse.json(
				{ success: true, message: "Email skipped - user has unsubscribed" },
				{ status: 200 }
			);
		}

		// Generate unsubscribe URL
		const unsubscribeUrl = generateUnsubscribeUrl(userId, "mentions");

		// Set the subject for mention emails
		const subject = "You were mentioned in Proddy";

		console.log("Preparing mention email template");

		// Create the mention email template
		const emailTemplate = MentionTemplate({
			firstName: firstName || "User",
			mentionerName: mentionerName || "Someone",
			messagePreview: messagePreview || "You were mentioned in a message",
			channelName: channelName || "a channel",
			workspaceUrl,
			workspaceName,
			unsubscribeUrl,
		});

		console.log("Sending mention email via Resend to:", to);
		console.log("Email subject:", subject);

		// Validate the from address
		// Use Resend's default domain as a fallback if your domain isn't verified
		const fromAddress = "Proddy <support@proddy.tech>";
		console.log("From address:", fromAddress);

		try {
			console.log("Attempting to send mention email with Resend...");
			const { data, error } = await resend.emails.send({
				from: fromAddress,
				to: [to],
				subject,
				react: emailTemplate,
			});

			if (error) {
				console.error("Mention email sending error from Resend:", error);

				// Try with the test email as a fallback
				console.log("Trying with test email as fallback...");
				try {
					const fallbackResult = await resend.emails.send({
						from: fromAddress,
						to: ["delivered@resend.dev"],
						subject: `[TEST] ${subject}`,
						react: emailTemplate,
					});

					if (fallbackResult.error) {
						console.error(
							"Fallback mention email also failed:",
							fallbackResult.error
						);
						return NextResponse.json(
							{
								error: "Email sending failed on both attempts",
								details: error,
								fallbackError: fallbackResult.error,
							},
							{ status: 400 }
						);
					}

					console.log("Fallback mention email sent successfully");
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
					console.error(
						"Fallback mention email failed with exception:",
						fallbackError
					);
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

			console.log("Mention email sent successfully:", data);
			return NextResponse.json(
				{
					success: true,
					data,
					message: "Mention email sent successfully",
				},
				{ status: 200 }
			);
		} catch (resendError) {
			console.error("Resend API exception for mention email:", resendError);
			return NextResponse.json(
				{
					error: "Failed to send mention email",
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
		console.error("Mention Email API error:", error);
		// Return a more detailed error response
		return NextResponse.json(
			{
				error: "Failed to send mention email",
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
