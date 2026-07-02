import { openai } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe } from "ai";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "AI service is not configured. Missing OPENAI_API_KEY." },
				{ status: 500 }
			);
		}

		const formData = await req.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		// Limit to 25MB (Whisper's per-request cap)
		if (file.size > 25 * 1024 * 1024) {
			return NextResponse.json(
				{ error: "File too large. Maximum size is 25MB." },
				{ status: 400 }
			);
		}

		const fileBytes = await file.arrayBuffer();

		const result = await transcribe({
			model: openai.transcription("whisper-1"),
			audio: new Uint8Array(fileBytes),
		});

		return NextResponse.json({ transcript: result.text });
	} catch (error) {
		console.error("Transcription error:", error);
		return NextResponse.json(
			{ error: "Failed to transcribe audio", details: String(error) },
			{ status: 500 }
		);
	}
}
