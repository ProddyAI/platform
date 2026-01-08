import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { Id } from "@/../convex/_generated/dataModel";
import { ThreadReplyTemplate } from "@/features/email/components/thread-reply-template";
import { shouldSendEmailServer } from "@/lib/email-preferences-server";
import { generateUnsubscribeUrl } from "@/lib/email-unsubscribe";

const apiKey = process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

export async function POST(req: NextRequest) {
	try {
		console.log("Thread Reply Email API received request");
		const body = await req.json();
		console.log(
			"Thread Reply Email request body:",
			JSON.stringify(body, null, 2)
		);

		const {
			to,
			userId,
			firstName,
			replierName,
			originalMessagePreview,
			replyMessagePreview,
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

		// Check if user wants to receive thread reply emails
		const shouldSend = await shouldSendEmailServer(
			userId as Id<"users">,
			"threadReply"
		);
		if (!shouldSend) {
			console.log(
				"User has unsubscribed from thread reply emails, skipping send"
			);
			return NextResponse.json(
				{ success: true, message: "Email skipped - user has unsubscribed" },
				{ status: 200 }
			);
		}

		// Generate unsubscribe URL
		const unsubscribeUrl = generateUnsubscribeUrl(userId, "threadReply");

		// Set the subject for thread reply emails
		const subject = `${replierName} replied to your message in Proddy`;

		console.log("Preparing thread reply email template");

		// Create the thread reply email template
		const emailTemplate = ThreadReplyTemplate({
			firstName: firstName || "User",
			replierName: replierName || "Someone",
			originalMessagePreview: originalMessagePreview || "Your message",
			replyMessagePreview: replyMessagePreview || "A reply to your message",
			channelName: channelName || "a channel",
			workspaceUrl,
			workspaceName,
			unsubscribeUrl,
		});

		console.log("Sending thread reply email via Resend to:", to);
		console.log("Email subject:", subject);

		// Validate the from address
		// Use Resend's default domain as a fallback if your domain isn't verified
		const fromAddress = "Proddy <support@proddy.tech>";
		console.log("From address:", fromAddress);

		try {
			console.log("Attempting to send thread reply email with Resend...");
			const { data, error } = await resend.emails.send({
				from: fromAddress,
				to: [to],
				subject,
				react: emailTemplate,
			});

			if (error) {
				console.error("Thread reply email sending error from Resend:", error);

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
							"Fallback thread reply email also failed:",
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

					console.log("Fallback thread reply email sent successfully");
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
						"Fallback thread reply email failed with exception:",
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

			console.log("Thread reply email sent successfully:", data);
			return NextResponse.json(
				{
					success: true,
					data,
					message: "Thread reply email sent successfully",
				},
				{ status: 200 }
			);
		} catch (resendError) {
			console.error(
				"Resend API exception for thread reply email:",
				resendError
			);
			return NextResponse.json(
				{
					error: "Failed to send thread reply email",
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
		console.error("Thread Reply Email API error:", error);
		// Return a more detailed error response
		return NextResponse.json(
			{
				error: "Failed to send thread reply email",
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
