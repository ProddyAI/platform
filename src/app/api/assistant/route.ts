import { type NextRequest, NextResponse } from "next/server";

// Redirect to the chatbot endpoint
export async function POST(req: NextRequest) {
	try {
		// Get the request body
		const body = await req.json();

		// Forward auth context (cookies/authorization) so the downstream route can
		// derive the Convex auth token and run authenticated queries.
		const cookie = req.headers.get("cookie");
		const authorization = req.headers.get("authorization");

		// Forward the request to the chatbot endpoint
		const chatbotResponse = await fetch(
			`${req.nextUrl.origin}/api/assistant/chatbot`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(cookie ? { Cookie: cookie } : {}),
					...(authorization ? { Authorization: authorization } : {}),
				},
				body: JSON.stringify(body),
				cache: "no-store",
			}
		);

		// Return the response from the chatbot endpoint
		const result = await chatbotResponse.json();
		return NextResponse.json(result, { status: chatbotResponse.status });
	} catch (error) {
		console.error("[Assistant Router] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to process request",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
