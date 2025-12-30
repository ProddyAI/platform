import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from '@convex-dev/auth/nextjs/server';

export const dynamic = 'force-dynamic';

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required');
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export async function POST(req: NextRequest) {
	try {
		const convex = createConvexClient();

		// Pass auth through to Convex so membership/tasks/channels work.
		// We attempt token retrieval even if isAuthenticatedNextjs() is false, because
		// auth state can depend on request cookies and runtime environment.
		try {
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			} else if (isAuthenticatedNextjs()) {
				console.warn(
					'[Chatbot Assistant] Authenticated session but no Convex token found'
				);
			}
		} catch (err) {
			if (isAuthenticatedNextjs()) {
				console.warn(
					'[Chatbot Assistant] Failed to read Convex auth token from request',
					err
				);
			}
		}

		const { message, workspaceContext, workspaceId, conversationHistory } =
			await req.json();

		if (!message || !workspaceId) {
			return NextResponse.json(
				{ error: 'Message and workspaceId are required' },
				{ status: 400 }
			);
		}

		// Gemini-only mode: always route to Convex assistant (which uses Gemini 1.5 Flash).
		// This avoids OpenAI entirely while keeping the dashboard response shape stable.
		try {
			const result = await convex.action(api.chatbot.askAssistant, {
				query: message,
				workspaceId: workspaceId as Id<'workspaces'>,
			});

			const responseText = result?.answer || 'No response generated';
			const sources = (result?.sources ?? []).map((s: string, idx: number) => ({
				id: `source-${idx}`,
				type: 'source',
				text: s,
			}));

			const actions = Array.isArray((result as any)?.actions)
				? (result as any).actions
				: [];

			return NextResponse.json({
				success: true,
				response: responseText,
				sources,
				actions,
				toolResults: [],
				assistantType: 'convex',
				composioToolsUsed: false,
			});
		} catch (error) {
			console.error('[Chatbot Assistant] Convex assistant failed:', error);
			return NextResponse.json(
				{
					success: false,
					error:
						error instanceof Error
							? error.message
							: 'Failed to generate assistant response',
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('[Chatbot Assistant] Error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
