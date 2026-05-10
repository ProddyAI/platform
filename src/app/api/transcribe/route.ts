import { GoogleGenerativeAI } from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
	try {
		const formData = await req.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		console.log(`Transcribing file: ${file.name} (${file.type}, ${file.size} bytes)`);

		// Limit to 100MB for inline processing
		if (file.size > 100 * 1024 * 1024) {
			return NextResponse.json({ error: "File too large. Maximum size is 100MB." }, { status: 400 });
		}

		const fileBytes = await file.arrayBuffer();
		const base64Data = Buffer.from(fileBytes).toString("base64");

		// Determine mimetype
		let mimeType = file.type;
		if (!mimeType || mimeType === "application/octet-stream") {
			mimeType = file.name.endsWith(".wav") ? "audio/wav" : 
					   file.name.endsWith(".webm") ? "audio/webm" : "audio/mp3";
		}

		// Use Gemini 1.5 Pro for audio transcription
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
		
		const prompt = "You are a professional transcriber. Listen to the following audio and provide a highly accurate, verbatim transcript. Do NOT summarize. Do NOT add any conversational filler like 'Here is the transcript'. Just output the raw transcribed text exactly as spoken in the audio.";

		const result = await model.generateContent([
			{
				inlineData: {
					mimeType,
					data: base64Data,
				},
			},
			prompt,
		]);

		const transcript = result.response.text();
		
		return NextResponse.json({ transcript });
	} catch (error) {
		console.error("Transcription error:", error);
		return NextResponse.json(
			{ error: "Failed to transcribe audio", details: String(error) },
			{ status: 500 }
		);
	}
}
