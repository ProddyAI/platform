import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { Id } from "@/../convex/_generated/dataModel";
import { WeeklyDigestTemplate } from "@/features/email/components/weekly-digest-template";
import { shouldSendEmailServer } from "@/lib/email-preferences-server";
import { generateUnsubscribeUrl } from "@/lib/email-unsubscribe";

// Log the API key (masked for security)
const apiKey = process.env.RESEND_API_KEY;
console.log("Weekly Digest Email API - Resend API Key exists:", !!apiKey);
if (apiKey) {
	const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
	console.log("Weekly Digest Email API - Masked API Key:", maskedKey);
}

const resend = new Resend(apiKey);

export async function POST(req: NextRequest) {
	try {
		console.log("Weekly Digest Email API received request");
		const body = await req.json();
		console.log(
			"Weekly Digest Email request body:",
			JSON.stringify(body, null, 2)
		);

		const { to, userId, firstName, weekRange, workspaces, totalStats } = body;

		// Validate required fields
		if (!to || !userId) {
			console.error("Missing required fields: to (email address) and userId");
			return NextResponse.json(
				{ error: "Missing required fields: to (email address) and userId" },
				{ status: 400 }
			);
		}

		if (!workspaces || !Array.isArray(workspaces)) {
			console.error("Missing or invalid workspaces data");
			return NextResponse.json(
				{ error: "Missing or invalid workspaces data" },
				{ status: 400 }
			);
		}

		// Check if user wants to receive weekly digest emails
		const shouldSend = await shouldSendEmailServer(
			userId as Id<"users">,
			"weeklyDigest"
		);
		if (!shouldSend) {
			console.log(
				"User has unsubscribed from weekly digest emails, skipping send"
			);
			return NextResponse.json(
				{ success: true, message: "Email skipped - user has unsubscribed" },
				{ status: 200 }
			);
		}

		// Generate unsubscribe URL
		const unsubscribeUrl = generateUnsubscribeUrl(userId, "weeklyDigest");

		// Set the subject for weekly digest emails
		const subject = `Your Proddy Weekly Digest - ${weekRange}`;

		console.log("Preparing weekly digest email template");

		// Create the weekly digest email template
		const emailTemplate = WeeklyDigestTemplate({
			firstName: firstName || "User",
			weekRange: weekRange || "This Week",
			workspaces: workspaces || [],
			totalStats: totalStats || {
				totalMessages: 0,
				totalTasks: 0,
				totalWorkspaces: 0,
			},
			userId,
			email: to,
			unsubscribeUrl,
		});

		console.log("Sending weekly digest email via Resend to:", to);
		console.log("Email subject:", subject);

		// Validate the from address
		// Use Resend's default domain as a fallback if your domain isn't verified
		const fromAddress = "Proddy <support@proddy.tech>";
		console.log("From address:", fromAddress);

		try {
			console.log("Attempting to send weekly digest email with Resend...");
			const { data, error } = await resend.emails.send({
				from: fromAddress,
				to: [to],
				subject,
				react: emailTemplate,
			});

			if (error) {
				console.error("Weekly digest email sending error from Resend:", error);

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
							"Fallback weekly digest email also failed:",
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

					console.log("Fallback weekly digest email sent successfully");
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
						"Fallback weekly digest email failed with exception:",
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

			console.log("Weekly digest email sent successfully:", data);
			return NextResponse.json(
				{
					success: true,
					data,
					message: "Weekly digest email sent successfully",
				},
				{ status: 200 }
			);
		} catch (resendError) {
			console.error(
				"Resend API exception for weekly digest email:",
				resendError
			);
			return NextResponse.json(
				{
					error: "Failed to send weekly digest email",
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
		console.error("Weekly Digest Email API error:", error);
		// Return a more detailed error response
		return NextResponse.json(
			{
				error: "Failed to send weekly digest email",
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
