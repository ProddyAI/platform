import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

// Load environment variables
dotenv.config();

export async function POST(req: NextRequest) {
	try {
		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
			return NextResponse.json(
				{ error: 'API key not configured' },
				{ status: 500 }
			);
		}

		let requestData;
		try {
			requestData = await req.json();
		} catch (parseError) {
			console.error('Error parsing JSON:', parseError);
			return NextResponse.json(
				{ error: 'Invalid JSON in request' },
				{ status: 400 }
			);
		}

		const { prompt } = requestData;

		if (!prompt) {
			console.error('Missing prompt in request');
			return NextResponse.json(
				{ error: 'Prompt is required' },
				{ status: 400 }
			);
		}

		console.log(
			'[Smart Flowchart] Processing flowchart request for prompt:',
			prompt
		);

		// Create the Gemini model
		const model = google('gemini-2.5-flash');

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
				model,
				prompt: systemPrompt,
				maxTokens: 2000,
				temperature: 0.3, // Lower temperature for more consistent diagram structure
			});

			console.log('[Smart Flowchart] Successfully generated flowchart');

			// Clean up the response to ensure it's valid Mermaid code
			let mermaidCode = text.trim();

			// Remove any markdown code block wrappers if present
			mermaidCode = mermaidCode.replace(/^```mermaid\s*\n?/, '');
			mermaidCode = mermaidCode.replace(/^```\s*\n?/, '');
			mermaidCode = mermaidCode.replace(/\n?```\s*$/, '');

			// Ensure it starts with flowchart directive
			if (
				!mermaidCode.startsWith('flowchart') &&
				!mermaidCode.startsWith('graph')
			) {
				mermaidCode = 'flowchart TD\n' + mermaidCode;
			}

			return NextResponse.json({
				mermaidCode: mermaidCode.trim(),
				originalPrompt: prompt,
			});
		} catch (aiError) {
			console.error('[Smart Flowchart] AI generation failed:', aiError);

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
					error: 'AI generation failed, using fallback diagram',
					fallback: true,
				},
				{ status: 503 }
			);
		}
	} catch (error) {
		console.error('[Smart Flowchart] Unexpected error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
