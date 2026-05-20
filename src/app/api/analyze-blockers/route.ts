import { openai } from "@ai-sdk/openai";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const dynamic = "force-dynamic";

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

type AnalyzeBlockersRequest = {
	channelId?: Id<"channels">;
	projectId?: Id<"projects">;
};

type LlmDependency = {
	blockerId: string;
	blockedId: string;
	reasoning: string;
	stepByStepResolution: string[] | string;
};

type ApplyDependenciesResult = {
	applied?: number;
	skipped?: Array<{
		blockerId: Id<"issues">;
		blockedId: Id<"issues">;
		reason: string;
	}>;
};

function dependencyApplySummary(result: ApplyDependenciesResult | null | undefined) {
	return {
		applied: result?.applied ?? 0,
		skipped: result?.skipped ?? [],
	};
}

function safeJsonParse(text: string): unknown | null {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function normalizeSteps(
	steps: LlmDependency["stepByStepResolution"]
): string[] {
	if (Array.isArray(steps)) {
		return steps
			.map((s) => String(s).trim())
			.filter(Boolean)
			.slice(0, 12);
	}
	const s = String(steps ?? "").trim();
	if (!s) return [];
	return s
		.split(/\r?\n|•|\u2022|-\s+/g)
		.map((x) => x.trim())
		.filter(Boolean)
		.slice(0, 12);
}

export async function POST(req: NextRequest) {
	try {
		const convex = createConvexClient();

		// Pass auth through to Convex so membership checks work.
		try {
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			} else if (isAuthenticatedNextjs()) {
				console.warn(
					"[Analyze Blockers] Authenticated session but no Convex token found"
				);
			}
		} catch (err) {
			if (isAuthenticatedNextjs()) {
				console.warn(
					"[Analyze Blockers] Failed to read Convex auth token from request",
					err
				);
			}
		}

		const body = (await req.json()) as AnalyzeBlockersRequest;
		let channelId = body.channelId;

		if (!channelId && body.projectId) {
			const project = await convex.query(api.projects.getById, {
				id: body.projectId,
			});
			channelId = project?.boardChannelId as Id<"channels"> | undefined;
		}

		if (!channelId) {
			return NextResponse.json(
				{ error: "channelId (or projectId) is required" },
				{ status: 400 }
			);
		}

		const [issues, statuses] = await Promise.all([
			convex.query(api.board.getAllIssuesForBlocking, { channelId }),
			convex.query(api.board.getStatuses, { channelId }),
		]);

		const statusNameById = new Map<string, string>();
		for (const s of statuses as Array<{ _id: Id<"statuses">; name: string }>) {
			statusNameById.set(String(s._id), String(s.name));
		}

		const issuesPayload = (
			issues as Array<{
				_id: Id<"issues">;
				title: string;
				description?: string;
				statusId: Id<"statuses">;
			}>
		).map((i) => ({
			id: i._id,
			title: i.title,
			description: i.description ?? "",
			status: statusNameById.get(String(i.statusId)) ?? "",
		}));

		const issuesForHeuristic = issuesPayload.map((i) => ({
			issueId: i.id as Id<"issues">,
			title: i.title,
			description: i.description || undefined,
			statusName: i.status || undefined,
		}));

		if (issuesPayload.length < 2) {
			return NextResponse.json({
				ok: true,
				applied: 0,
				skipped: [],
				dependencies: [],
				message: "Not enough tasks to analyze",
			});
		}

		// If OpenAI isn't configured, fall back to heuristic analysis.
		if (!process.env.OPENAI_API_KEY) {
			const suggestions = await convex.action(
				(api as any).boardDependency.analyzeIssueDependencies,
				{
					issues: issuesForHeuristic,
				}
			);

			const result = await convex.mutation(
				api.board.applyDetectedIssueDependencies,
				{
					channelId,
					dependencies: suggestions,
				}
			);

			return NextResponse.json({
				ok: true,
				...dependencyApplySummary(result as ApplyDependenciesResult),
				dependencies: suggestions,
				fallback: "heuristic_no_openai_key",
			});
		}

		// LLM analysis (strict JSON output).
		const prompt = `You are an expert project manager.

Given a list of tasks on a Kanban board, find which tasks are BLOCKED BY other tasks.
Return ONLY a JSON array (no markdown, no prose) with items:
[{ "blockerId": string, "blockedId": string, "reasoning": string, "stepByStepResolution": string[] }]

Rules:
- Use only provided ids.
- blockerId !== blockedId.
- Avoid cycles; if unclear, omit.
- Prefer dependencies that are logically necessary (prerequisites).
- stepByStepResolution must be 3-7 short actionable steps.

Tasks:
${JSON.stringify(issuesPayload)}`;

		let dependencies: LlmDependency[] = [];
		try {
			const { text } = await generateText({
				model: openai("gpt-4o-mini"),
				prompt,
				temperature: 0.2,
			});

			const parsed = safeJsonParse(text);
			if (Array.isArray(parsed)) {
				dependencies = parsed as LlmDependency[];
			} else {
				// Fallback: heuristic analyzer if model output isn't strict JSON.
				const suggestions = await convex.action(
					(api as any).boardDependency.analyzeIssueDependencies,
					{
						issues: issuesForHeuristic,
					}
				);

				const result = await convex.mutation(
					api.board.applyDetectedIssueDependencies,
					{
						channelId,
						dependencies: suggestions,
					}
				);

				return NextResponse.json({
					ok: true,
					...dependencyApplySummary(result as ApplyDependenciesResult),
					dependencies: suggestions,
					fallback: "heuristic_invalid_llm_json",
				});
			}
		} catch (err) {
			// Fallback: heuristic analyzer if model call fails.
			console.error("[Analyze Blockers] LLM call failed:", err);
			const suggestions = await convex.action(
				(api as any).boardDependency.analyzeIssueDependencies,
				{
					issues: issuesForHeuristic,
				}
			);

			const result = await convex.mutation(
				api.board.applyDetectedIssueDependencies,
				{
					channelId,
					dependencies: suggestions,
				}
			);

			return NextResponse.json({
				ok: true,
				...dependencyApplySummary(result as ApplyDependenciesResult),
				dependencies: suggestions,
				fallback: "heuristic_llm_error",
			});
		}

		// Validate dependencies against known issue ids.
		const validIds = new Set(issuesPayload.map((t) => String(t.id)));
		const normalized = dependencies
			.filter(
				(d) =>
					d &&
					typeof d.blockerId === "string" &&
					typeof d.blockedId === "string" &&
					typeof d.reasoning === "string" &&
					d.blockerId !== d.blockedId &&
					validIds.has(d.blockerId) &&
					validIds.has(d.blockedId)
			)
			.slice(0, 200)
			.map((d) => ({
				blockerId: d.blockerId as Id<"issues">,
				blockedId: d.blockedId as Id<"issues">,
				reasoning: d.reasoning.trim().slice(0, 500),
				resolutionSteps: normalizeSteps(d.stepByStepResolution),
			}))
			.filter((d) => d.resolutionSteps.length > 0);

		const result = await convex.mutation(
			api.board.applyDetectedIssueDependencies,
			{
				channelId,
				dependencies: normalized,
			}
		);

		return NextResponse.json({
			ok: true,
			...dependencyApplySummary(result as ApplyDependenciesResult),
			dependencies: normalized,
		});
	} catch (error) {
		console.error("[Analyze Blockers] Route error:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
