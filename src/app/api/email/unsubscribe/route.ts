import { type NextRequest, NextResponse } from "next/server";
import type { Id } from "@/../convex/_generated/dataModel";
import { updateNotificationPreferencesServer } from "@/lib/email-preferences-server";
import {
	type EmailType,
	getEmailTypeName,
	verifyUnsubscribeSignature,
} from "@/lib/email-unsubscribe";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get("userId");
		const emailType = searchParams.get("emailType") as EmailType;
		const timestamp = searchParams.get("timestamp");
		const signature = searchParams.get("signature");

		// Validate required parameters
		if (!userId || !emailType || !timestamp || !signature) {
			return new NextResponse(
				generateErrorPage(
					"Invalid unsubscribe link. Missing required parameters."
				),
				{
					status: 400,
					headers: { "Content-Type": "text/html" },
				}
			);
		}

		// Verify the signature
		const verification = verifyUnsubscribeSignature(
			userId,
			emailType,
			timestamp,
			signature
		);
		if (!verification.valid) {
			return new NextResponse(
				generateErrorPage(verification.error || "Invalid unsubscribe link."),
				{
					status: 400,
					headers: { "Content-Type": "text/html" },
				}
			);
		}

		// Update the notification preference using the server-side utility
		const success = await updateNotificationPreferencesServer(
			userId as Id<"users">,
			emailType,
			false
		);

		if (!success) {
			return new NextResponse(
				generateErrorPage(
					"Failed to update your email preferences. Please try again."
				),
				{
					status: 500,
					headers: { "Content-Type": "text/html" },
				}
			);
		}

		// Return success page
		const emailTypeName = getEmailTypeName(emailType);
		return new NextResponse(generateSuccessPage(emailTypeName), {
			status: 200,
			headers: { "Content-Type": "text/html" },
		});
	} catch (error) {
		console.error("Unsubscribe error:", error);
		return new NextResponse(
			generateErrorPage(
				"An error occurred while processing your unsubscribe request."
			),
			{
				status: 500,
				headers: { "Content-Type": "text/html" },
			}
		);
	}
}

function generateSuccessPage(emailTypeName: string): string {
	return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribed Successfully - Proddy</title>
      <style>
        body {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f6f9fc;
          margin: 0;
          padding: 40px 20px;
          color: #4A5568;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 5px 10px rgba(20, 50, 70, 0.05);
          padding: 40px;
          text-align: center;
        }
        .logo {
          width: 60px;
          height: 60px;
          margin: 0 auto 20px;
          background: #4F46E5;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        h1 {
          color: #0E1C36;
          font-size: 28px;
          margin: 20px 0;
          font-weight: 600;
        }
        p {
          font-size: 16px;
          line-height: 1.6;
          margin: 16px 0;
        }
        .success-icon {
          color: #10B981;
          font-size: 48px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: #4F46E5;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin: 20px 10px;
          transition: background-color 0.2s;
        }
        .button:hover {
          background: #4338CA;
        }
        .button-secondary {
          background: #6B7280;
        }
        .button-secondary:hover {
          background: #4B5563;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
          font-size: 14px;
          color: #6B7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">P</div>
        <div class="success-icon">✓</div>
        <h1>Successfully Unsubscribed</h1>
        <p>You have been unsubscribed from <strong>${emailTypeName}</strong>.</p>
        <p>You will no longer receive these types of email notifications from Proddy.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://proddy.tech"}" class="button">
            Return to Proddy
          </a>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://proddy.tech"}/settings/notifications" class="button button-secondary">
            Manage Email Preferences
          </a>
        </div>
        
        <div class="footer">
          <p>If you change your mind, you can re-enable these notifications in your account settings.</p>
          <p>© ${new Date().getFullYear()} Proddy. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateErrorPage(errorMessage: string): string {
	return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribe Error - Proddy</title>
      <style>
        body {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f6f9fc;
          margin: 0;
          padding: 40px 20px;
          color: #4A5568;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 5px 10px rgba(20, 50, 70, 0.05);
          padding: 40px;
          text-align: center;
        }
        .logo {
          width: 60px;
          height: 60px;
          margin: 0 auto 20px;
          background: #4F46E5;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        h1 {
          color: #DC2626;
          font-size: 28px;
          margin: 20px 0;
          font-weight: 600;
        }
        p {
          font-size: 16px;
          line-height: 1.6;
          margin: 16px 0;
        }
        .error-icon {
          color: #DC2626;
          font-size: 48px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background: #4F46E5;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin: 20px 10px;
          transition: background-color 0.2s;
        }
        .button:hover {
          background: #4338CA;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">P</div>
        <div class="error-icon">✗</div>
        <h1>Unsubscribe Failed</h1>
        <p>${errorMessage}</p>
        <p>Please contact support if you continue to experience issues.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://proddy.tech"}" class="button">
            Return to Proddy
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}
