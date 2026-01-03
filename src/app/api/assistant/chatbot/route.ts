import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from '@convex-dev/auth/nextjs/server';
import OpenAI from 'openai';
import {
	createComposioClient,
	getWorkspaceEntityId,
	getAnyConnectedApps,
	getAllToolsForApps,
	filterToolsForQuery,
	type AvailableApp,
} from '@/lib/composio-config';

export const dynamic = 'force-dynamic';

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required');
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

// Initialize OpenAI client
function createOpenAIClient(): OpenAI {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error('OPENAI_API_KEY environment variable is required');
	}
	return new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});
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

		const { message, workspaceContext, workspaceId, conversationHistory, memberId } =
			await req.json();

		if (!message || !workspaceId) {
			return NextResponse.json(
				{ error: 'Message and workspaceId are required' },
				{ status: 400 }
			);
		}

		console.log('[Chatbot Assistant] Processing message:', {
			workspaceId,
			memberId,
			messageLength: message.length,
		});

		// Check if Composio integration is available and relevant
		let useComposio = false;
		let connectedApps: AvailableApp[] = [];
		let composioTools: any[] = [];
		let composioClient: any = null; // Store composio client for reuse
		let userId: string = ''; // Composio uses userId as entity identifier
		
		// Detect if query needs external tools (Gmail, GitHub, Slack, Notion, or ClickUp)
		const queryLower = message.toLowerCase();
		const needsGmail = /\b(email|gmail|send|mail|inbox|draft)\b/i.test(queryLower);
		const needsGithub = /\b(github|repo|repository|issue|pull request|pr|commit|branch)\b/i.test(queryLower);
		const needsSlack = /\b(slack|channel|message|dm|conversation|workspace|team)\b/i.test(queryLower);
		const needsNotion = /\b(notion|page|database|block|note|doc|document)\b/i.test(queryLower);
		const needsClickup = /\b(clickup|task|project|list|folder|space|goal|time tracking|checklist)\b/i.test(queryLower);
		const needsExternalTools = needsGmail || needsGithub || needsSlack || needsNotion || needsClickup;

		console.log('[Chatbot Assistant] Query analysis:', {
			needsGmail,
			needsGithub,
			needsSlack,
			needsNotion,
			needsClickup,
			needsExternalTools,
		});

		// If external tools are needed and Composio is configured, try to use it
		if (needsExternalTools && process.env.COMPOSIO_API_KEY) {
			try {
				composioClient = createComposioClient();
				userId = memberId ? `member_${memberId}` : getWorkspaceEntityId(workspaceId);
				
				console.log('[Chatbot Assistant] Checking Composio connections for userId:', userId);
				
				// Get connected apps
				const apps = await getAnyConnectedApps(composioClient, workspaceId, userId);
				connectedApps = apps
					.filter((app) => app.connected)
					.map((app) => app.app);

				console.log('[Chatbot Assistant] Connected apps:', connectedApps);

				if (connectedApps.length > 0) {
					// Get all available tools
					const allTools = await getAllToolsForApps(composioClient, userId, connectedApps);
					
					console.log('[Chatbot Assistant] Total tools available:', allTools.length);

					// Filter tools based on query
					composioTools = filterToolsForQuery(allTools, message, {
						maxTools: 20, // Limit tools to avoid token overflow
						preferDashboard: true,
					});

					console.log('[Chatbot Assistant] Filtered tools for query:', composioTools.length);

					if (composioTools.length > 0) {
						useComposio = true;
					}
				}
			} catch (error) {
				console.warn('[Chatbot Assistant] Composio setup failed, falling back to Convex:', error);
			}
		}

		// If Composio should be used, handle with OpenAI + Composio tools
		if (useComposio && composioTools.length > 0 && composioClient) {
			try {
				console.log('[Chatbot Assistant] Using OpenAI with Composio tools');
				
				const openai = createOpenAIClient();
				// Reuse the composio client that already has userId context
				// userId is already set from the previous block

				// Build messages array
				const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
					{
						role: 'system',
						content: `You are Proddy AI, an intelligent workspace assistant with access to ${connectedApps.join(', ')} integrations. Help the user accomplish their tasks using these tools when appropriate. For workspace-related queries (messages, tasks, notes), acknowledge that you can help but may need to access workspace data. ${workspaceContext || ''}`,
					},
					// Add conversation history
					...(conversationHistory || []).map((msg: any) => ({
						role: msg.role as 'user' | 'assistant' | 'system',
						content: msg.content,
					})),
					{
						role: 'user',
						content: message,
					},
				];

				// Create completion with tools
				const completion = await openai.chat.completions.create({
					model: 'gpt-4o-mini',
					tools: composioTools,
					messages,
					temperature: 0.7,
					max_tokens: 1500,
				});

				let responseText = completion.choices[0]?.message?.content || 'No response generated';
				let toolResults: any[] = [];
				let sources: any[] = [];

				// Execute tool calls if any
				if (completion.choices[0]?.message?.tool_calls && completion.choices[0].message.tool_calls.length > 0) {
					console.log('[Chatbot Assistant] Executing tool calls:', completion.choices[0].message.tool_calls.length);
					console.log('[Chatbot Assistant] Using userId:', userId);

					try {
						// Use Composio's provider.handleToolCalls method (matches sample code pattern)
						const result = await composioClient.provider.handleToolCalls(userId, completion);
						
						console.log('[Chatbot Assistant] Tool execution result:', result);

						// Extract tool results for display
						toolResults = Array.isArray(result) ? result : [result];
						
						// Create source badges for executed tools
						const toolCalls = completion.choices[0].message.tool_calls as any[];
						sources = toolCalls.map((call, idx) => ({
							id: `tool-${idx}`,
							type: 'tool',
							text: `${call.function?.name || 'Tool'} executed`,
						}));

						// Get follow-up response with tool results
						const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
							...messages,
							completion.choices[0].message,
							...toolCalls.map((call, idx) => ({
								role: 'tool' as const,
								tool_call_id: call.id,
								content: JSON.stringify(toolResults[idx] || { success: true }),
							})),
						];

						const followUpCompletion = await openai.chat.completions.create({
							model: 'gpt-4o-mini',
							messages: followUpMessages,
							temperature: 0.7,
							max_tokens: 1500,
						});

						responseText = followUpCompletion.choices[0]?.message?.content || responseText;
					} catch (toolError) {
						console.error('[Chatbot Assistant] Tool execution failed:', toolError);
						responseText += '\n\nNote: Some operations could not be completed. Please try again or check your integration settings.';
					}
				}

				console.log('[Chatbot Assistant] Composio response generated');

				return NextResponse.json({
					success: true,
					response: responseText,
					sources,
					actions: [],
					toolResults,
					assistantType: 'openai-composio',
					composioToolsUsed: true,
					connectedApps,
				});
			} catch (error) {
				console.error('[Chatbot Assistant] OpenAI+Composio failed, falling back to Convex:', error);
				// Fall through to Convex assistant
			}
		}

		// Default: Use Convex assistant (Gemini-based)
		try {
			console.log('[Chatbot Assistant] Using Convex assistant (Gemini)');
			
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
