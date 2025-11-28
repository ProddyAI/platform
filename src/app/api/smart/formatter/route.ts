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

		const { content, title } = requestData;

		if (!content) {
			console.error('Missing content in request');
			return NextResponse.json(
				{ error: 'Content is required' },
				{ status: 400 }
			);
		}

		console.log(
			'[Smart Formatter] Processing formatting request for content length:',
			content.length
		);

		// Create the Gemini model
		const model = google('gemini-1.5-flash');

		// Prepare the formatting prompt
		const prompt = `You are an expert document formatter and editor. Your task is to improve the formatting, structure, and readability of the provided document while preserving all the original content and meaning.

Please format the following document by:

1. **Structure & Organization:**
   - Add clear headings and subheadings where appropriate
   - Organize content into logical sections
   - Use proper hierarchy (H1, H2, H3, etc.)
   - Add bullet points or numbered lists where suitable

2. **Content Enhancement:**
   - Fix grammar, spelling, and punctuation errors
   - Improve sentence structure and flow
   - Ensure consistent tone and style
   - Add emphasis (bold, italic) where appropriate

3. **Formatting Guidelines:**
   - Use markdown formatting
   - Maintain all original information
   - Don't add new content or change the meaning
   - Keep the same language as the original
   - Preserve any existing links, images, or special formatting

4. **Output Requirements:**
   - Return only the formatted content in markdown format
   - Do not include explanations or meta-commentary
   - Ensure the output is ready to be inserted directly into a document editor

${title ? `Document Title: ${title}\n\n` : ''}Original Content:
${content}

Formatted Content:`;

		try {
			const { text } = await generateText({
				model,
				prompt,
				maxTokens: 4000,
				temperature: 0.3, // Lower temperature for more consistent formatting
			});

			console.log('[Smart Formatter] Successfully formatted content');

			return NextResponse.json({
				formattedContent: text.trim(),
				originalLength: content.length,
				formattedLength: text.trim().length,
			});
		} catch (aiError) {
			console.error('[Smart Formatter] AI formatting failed:', aiError);

			// Return a fallback response
			return NextResponse.json(
				{
					error: 'Formatting failed',
					message:
						'AI formatting service is temporarily unavailable. Please try again later.',
					fallback: true,
				},
				{ status: 503 }
			);
		}
	} catch (error) {
		console.error('[Smart Formatter] Unexpected error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
