import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import * as dotenv from "dotenv";
import { type NextRequest, NextResponse } from "next/server";

dotenv.config();

export async function POST(req: NextRequest) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		const body = await req.json().catch(() => null);
		const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

		if (!prompt) {
			return NextResponse.json(
				{ error: "Prompt is required" },
				{ status: 400 }
			);
		}

		const systemPrompt = `You are a diagram generator.

Given a natural-language description, output ONLY a valid Mermaid diagram definition.

Rules:
- Output Mermaid ONLY. No markdown fences. No explanations.
- Prefer flowcharts unless the user asks for sequence/state specifically.
- Keep diagrams readable: use short node labels, clear success/failure paths.
- Use Mermaid v10+ compatible syntax.

Examples of valid outputs:
flowchart TD
  A([Start]) --> B[Enter credentials]
  B --> C{Valid?}
  C -->|Yes| D[Dashboard]
  C -->|No| E[Error / Retry]

sequenceDiagram
  participant U as User
  participant S as Server
  U->>S: Login request
  S-->>U: Success/Failure
`;

		const fullPrompt = `${systemPrompt}

User request:
${prompt}

Mermaid:`;

		const { text } = await generateText({
			model: openai("gpt-4o-mini"),
			prompt: fullPrompt,
			temperature: 0.2,
			maxOutputTokens: 1200,
		});

		const mermaid = (text || "").trim();

		if (!mermaid) {
			return NextResponse.json(
				{ error: "Empty Mermaid response" },
				{ status: 502 }
			);
		}

		return NextResponse.json({ mermaid });
	} catch (error) {
		console.error("[Smart Diagram] Unexpected error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
