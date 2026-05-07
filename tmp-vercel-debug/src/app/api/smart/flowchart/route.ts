import { openai } from "@ai-sdk/openai";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export async function POST(req: NextRequest) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			console.error("Missing OPENAI_API_KEY");
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		let requestData: {
			prompt?: string;
			workspaceId?: Id<"workspaces">;
		} | null = null;
		try {
			requestData = (await req.json()) as {
				prompt?: string;
				workspaceId?: Id<"workspaces">;
			};
		} catch (parseError) {
			console.error("Error parsing JSON:", parseError);
			return NextResponse.json(
				{ error: "Invalid JSON in request" },
				{ status: 400 }
			);
		}

		const prompt = requestData?.prompt;
		const workspaceId = requestData?.workspaceId;

		if (!prompt) {
			console.error("Missing prompt in request");
			return NextResponse.json(
				{ error: "Prompt is required" },
				{ status: 400 }
			);
		}

		// Prepare the flowchart generation prompt
		const systemPrompt = `You are an expert flowchart designer and Mermaid diagram specialist. Your task is to convert text descriptions into well-structured Mermaid flowchart diagrams.

Please create a Mermaid flowchart based on the user's description by following these guidelines:

1. **Mermaid Syntax:**
   - Use proper Mermaid flowchart syntax
   - Start with \`flowchart TD\` (Top Down) or \`flowchart LR\` (Left Right) based on what fits best
   - Use clear, descriptive node IDs and labels
   - Use appropriate arrow types and connections

2. **Node Types:**
   - Use rectangles for processes: \`A[Process Name]\`
   - Use diamonds for decisions: \`B{Decision?}\`
   - Use rounded rectangles for start/end: \`C([Start/End])\`
   - Use circles for connectors: \`D((Connector))\`

3. **Best Practices:**
   - Keep node labels concise but descriptive
   - Use logical flow from start to end
   - Include decision points where appropriate
   - Use consistent naming conventions
   - Ensure the diagram is readable and well-organized

4. **Output Requirements:**
   - Return ONLY the Mermaid diagram code
   - Do not include explanations or markdown code blocks
   - Do not include \`\`\`mermaid\` wrapper
   - Ensure the syntax is valid and will render correctly

5. **Example Format:**
\`\`\`
flowchart TD
    A([Start]) --> B[Process Step]
    B --> C{Decision?}
    C -->|Yes| D[Action 1]
    C -->|No| E[Action 2]
    D --> F([End])
    E --> F
\`\`\`

User's Description: ${prompt}

Generate the Mermaid flowchart code:`;

		try {
			const { text } = await generateText({
				model: openai("gpt-4o-mini"),
				prompt: systemPrompt,
				temperature: 0.3, // Lower temperature for more consistent diagram structure
			});

			// Clean up the response to ensure it's valid Mermaid code
			let mermaidCode = text.trim();

			// Remove any markdown code block wrappers if present
			mermaidCode = mermaidCode.replace(/^```mermaid\s*\n?/, "");
			mermaidCode = mermaidCode.replace(/^```\s*\n?/, "");
			mermaidCode = mermaidCode.replace(/\n?```\s*$/, "");

			// Ensure it starts with flowchart directive
			if (
				!mermaidCode.startsWith("flowchart") &&
				!mermaidCode.startsWith("graph")
			) {
				mermaidCode = `flowchart TD\n${mermaidCode}`;
			}

			// Track AI flowchart usage
			if (workspaceId) {
				try {
					const trackingConvex = createConvexClient();
					const trackingToken = convexAuthNextjsToken();
					if (trackingToken) trackingConvex.setAuth(trackingToken);
					await trackingConvex.mutation(
						api.usageTracking.recordAIRequestPublic,
						{
							workspaceId,
							featureType: "aiDiagram",
						}
					);
				} catch (trackErr) {
					console.warn(
						"[UsageTracking] Failed to record AI flowchart:",
						trackErr
					);
				}
			}

			return NextResponse.json({
				mermaidCode: mermaidCode.trim(),
				originalPrompt: prompt,
			});
		} catch (aiError) {
			console.error("[Smart Flowchart] AI generation failed:", aiError);

			// Return a fallback response with a simple flowchart
			const fallbackMermaid = `flowchart TD
    A([Start]) --> B[${prompt.substring(0, 30)}...]
    B --> C{Continue?}
    C -->|Yes| D[Next Step]
    C -->|No| E([End])
    D --> E`;

			return NextResponse.json(
				{
					mermaidCode: fallbackMermaid,
					originalPrompt: prompt,
					error: "AI generation failed, using fallback diagram",
					fallback: true,
				},
				{ status: 503 }
			);
		}
	} catch (error) {
		console.error("[Smart Flowchart] Unexpected error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
