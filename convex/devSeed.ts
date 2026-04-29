import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";

const SEED_TAG = "dev-seed";

function richText(text: string) {
	return JSON.stringify({
		ops: [{ insert: text }],
	});
}

async function ensureChannel(
	ctx: MutationCtx,
	workspaceId: Id<"workspaces">,
	name: string
) {
	const normalizedName = name.trim().toLowerCase().replace(/\s+/g, "-");
	const channels = await ctx.db
		.query("channels")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	const existing = channels.find((channel) => channel.name === normalizedName);
	if (existing) {
		return { channel: existing, created: false };
	}

	const channelId = await ctx.db.insert("channels", {
		name: normalizedName,
		workspaceId,
		type: "chat",
	});

	const channel = await ctx.db.get(channelId);
	if (!channel) {
		throw new Error(`Failed to create channel ${normalizedName}`);
	}

	return { channel, created: true };
}

export const seedWorkspace = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.object({
		workspaceId: v.id("workspaces"),
		created: v.object({
			channels: v.number(),
			messages: v.number(),
			notes: v.number(),
			tasks: v.number(),
			lists: v.number(),
			cards: v.number(),
			events: v.number(),
		}),
		skipped: v.object({
			messages: v.number(),
			notes: v.number(),
			tasks: v.number(),
			lists: v.number(),
			cards: v.number(),
			events: v.number(),
		}),
	}),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const ownerMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", workspace.userId)
			)
			.unique();

		if (!ownerMember) {
			throw new Error("Workspace owner member not found");
		}

		const summary = {
			workspaceId: args.workspaceId,
			created: {
				channels: 0,
				messages: 0,
				notes: 0,
				tasks: 0,
				lists: 0,
				cards: 0,
				events: 0,
			},
			skipped: {
				messages: 0,
				notes: 0,
				tasks: 0,
				lists: 0,
				cards: 0,
				events: 0,
			},
		};

		const { channel: generalChannel, created: createdGeneral } =
			await ensureChannel(ctx, args.workspaceId, "general");
		const { channel: releaseChannel, created: createdRelease } =
			await ensureChannel(ctx, args.workspaceId, "release-planning");
		summary.created.channels += Number(createdGeneral) + Number(createdRelease);

		const categories = await ctx.db
			.query("categories")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();
		const workCategory =
			categories.find((category) => category.name === "Work") ?? categories[0];

		const existingMessages = await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();
		const existingNotes = await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();
		const existingTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();
		const existingLists = await ctx.db
			.query("lists")
			.withIndex("by_channel_id", (q) => q.eq("channelId", releaseChannel._id))
			.collect();

		const now = Date.now();
		const day = 24 * 60 * 60 * 1000;

		const seedMessages = [
			{
				channelId: generalChannel._id,
				body: richText(
					"Onboarding update: the workspace checklist is ready and new teammates should start with the onboarding note before asking in chat."
				),
				tag: "msg-onboarding-update",
			},
			{
				channelId: generalChannel._id,
				body: richText(
					"Release note: login bug is still blocking rollout, and release planning will continue in the release-planning channel this afternoon."
				),
				tag: "msg-release-blocker",
			},
			{
				channelId: generalChannel._id,
				body: richText(
					"Reminder: please review your seeded tasks today so the assistant can answer questions about priorities and due dates."
				),
				tag: "msg-task-reminder",
			},
			{
				channelId: releaseChannel._id,
				body: richText(
					"Release planning: ship candidate depends on fixing the login redirect issue and finalizing onboarding copy in the help center."
				),
				tag: "msg-release-planning",
			},
		];

		for (const seedMessage of seedMessages) {
			const exists = existingMessages.some(
				(message) =>
					message.channelId === seedMessage.channelId &&
					message.tags?.includes(SEED_TAG) &&
					message.tags?.includes(seedMessage.tag)
			);

			if (exists) {
				summary.skipped.messages += 1;
				continue;
			}

			const messageId = await ctx.db.insert("messages", {
				memberId: ownerMember._id,
				body: seedMessage.body,
				channelId: seedMessage.channelId,
				workspaceId: args.workspaceId,
				tags: [SEED_TAG, seedMessage.tag],
			});
			summary.created.messages += 1;

			await ctx.scheduler.runAfter(0, api.ragchat.autoIndexMessage, {
				messageId,
			});
		}

		const seedNotes = [
			{
				title: "Onboarding Checklist",
				content:
					"Complete account setup, read the onboarding note, review the release planning channel, and check your first tasks.",
				channelId: generalChannel._id,
				tags: [SEED_TAG, "onboarding", "checklist"],
			},
			{
				title: "Sprint Release Plan",
				content:
					"Current release blockers: login redirect bug, missing release notes, and final QA on onboarding content.",
				channelId: releaseChannel._id,
				tags: [SEED_TAG, "release", "sprint"],
			},
			{
				title: "Assistant Citation Test Note",
				content:
					"Use this note to test whether the assistant can cite notes when asked about onboarding, release blockers, or workspace tasks.",
				channelId: generalChannel._id,
				tags: [SEED_TAG, "assistant", "citation"],
			},
		];

		for (const seedNote of seedNotes) {
			const exists = existingNotes.some(
				(note) =>
					note.title === seedNote.title && note.tags?.includes(SEED_TAG)
			);

			if (exists) {
				summary.skipped.notes += 1;
				continue;
			}

			const noteId = await ctx.db.insert("notes", {
				title: seedNote.title,
				content: seedNote.content,
				workspaceId: args.workspaceId,
				channelId: seedNote.channelId,
				memberId: ownerMember._id,
				tags: seedNote.tags,
				createdAt: now,
				updatedAt: now,
			});
			summary.created.notes += 1;

			await ctx.scheduler.runAfter(0, api.ragchat.autoIndexNote, {
				noteId,
			});
		}

		const seedTasks = [
			{
				title: "Finish onboarding guide",
				description:
					"Expand the onboarding checklist and add the release-planning links for new teammates.",
				dueDate: now + day,
				priority: "high" as const,
				status: "in_progress" as const,
				tags: [SEED_TAG, "onboarding"],
			},
			{
				title: "Fix login redirect bug",
				description:
					"Investigate the post-login redirect issue that is blocking the release candidate.",
				dueDate: now + 2 * day,
				priority: "high" as const,
				status: "not_started" as const,
				tags: [SEED_TAG, "release", "bug"],
			},
			{
				title: "Prepare release notes",
				description:
					"Summarize resolved issues and document known blockers for the next internal release.",
				dueDate: now + 3 * day,
				priority: "medium" as const,
				status: "not_started" as const,
				tags: [SEED_TAG, "release"],
			},
			{
				title: "Review assistant source citations",
				description:
					"Ask the assistant about tasks, notes, and messages after seeding to verify citations render correctly.",
				dueDate: now + day,
				priority: "medium" as const,
				status: "not_started" as const,
				tags: [SEED_TAG, "assistant", "citation"],
			},
		];

		for (const seedTask of seedTasks) {
			const exists = existingTasks.some(
				(task) => task.title === seedTask.title && task.tags?.includes(SEED_TAG)
			);

			if (exists) {
				summary.skipped.tasks += 1;
				continue;
			}

			const taskId = await ctx.db.insert("tasks", {
				title: seedTask.title,
				description: seedTask.description,
				completed: false,
				status: seedTask.status,
				dueDate: seedTask.dueDate,
				priority: seedTask.priority,
				categoryId: workCategory?._id,
				tags: seedTask.tags,
				createdAt: now,
				updatedAt: now,
				userId: workspace.userId,
				workspaceId: args.workspaceId,
			});
			summary.created.tasks += 1;

			await ctx.scheduler.runAfter(0, api.ragchat.autoIndexTask, {
				taskId,
			});
		}

		const listDefinitions = [
			{ title: "Todo", order: 0 },
			{ title: "In Progress", order: 1 },
			{ title: "Done", order: 2 },
		];
		const listsByTitle = new Map<string, Doc<"lists">>();

		for (const definition of listDefinitions) {
			let list =
				existingLists.find((item) => item.title === definition.title) ?? null;
			if (!list) {
				const listId = await ctx.db.insert("lists", {
					channelId: releaseChannel._id,
					title: definition.title,
					order: definition.order,
				});
				list = await ctx.db.get(listId);
				summary.created.lists += 1;
			} else {
				summary.skipped.lists += 1;
			}

			if (!list) {
				throw new Error(`Failed to ensure list ${definition.title}`);
			}
			listsByTitle.set(definition.title, list);
		}

		const allLists = Array.from(listsByTitle.values());
		const cardsByListId = new Map<Id<"lists">, Doc<"cards">[]>();
		for (const list of allLists) {
			const cards = await ctx.db
				.query("cards")
				.withIndex("by_list_id", (q) => q.eq("listId", list._id))
				.collect();
			cardsByListId.set(list._id, cards);
		}

		const seedCards = [
			{
				listTitle: "Todo",
				title: "Release QA sweep",
				description:
					"Run the final regression checks before moving the release candidate forward.",
				priority: "high" as const,
				dueDate: now + 2 * day,
				labels: [SEED_TAG, "release"],
			},
			{
				listTitle: "In Progress",
				title: "Update onboarding help center",
				description:
					"Refresh onboarding copy so support and product have the same steps documented.",
				priority: "medium" as const,
				dueDate: now + 4 * day,
				labels: [SEED_TAG, "onboarding"],
			},
		];

		for (const seedCard of seedCards) {
			const list = listsByTitle.get(seedCard.listTitle);
			if (!list) continue;

			const existingCardsForList = cardsByListId.get(list._id) ?? [];
			const exists = existingCardsForList.some(
				(card) =>
					card.title === seedCard.title &&
					Array.isArray(card.labels) &&
					card.labels.includes(SEED_TAG)
			);

			if (exists) {
				summary.skipped.cards += 1;
				continue;
			}

			const cardId = await ctx.db.insert("cards", {
				listId: list._id,
				title: seedCard.title,
				description: seedCard.description,
				order: existingCardsForList.length,
				labels: seedCard.labels,
				priority: seedCard.priority,
				dueDate: seedCard.dueDate,
				assignees: [ownerMember._id],
			});
			summary.created.cards += 1;

			await ctx.scheduler.runAfter(0, api.ragchat.autoIndexCard, {
				cardId,
			});
		}

		const seededReleaseMessage = await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
			.filter((q) =>
				q.and(
					q.eq(q.field("channelId"), releaseChannel._id),
					q.eq(q.field("memberId"), ownerMember._id)
				)
			)
			.collect();
		const eventAnchorMessage = seededReleaseMessage.find((message) =>
			message.tags?.includes("msg-release-planning")
		);

		if (eventAnchorMessage) {
			const existingEvent = await ctx.db
				.query("events")
				.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
				.filter((q) => q.eq(q.field("messageId"), eventAnchorMessage._id))
				.first();

			if (existingEvent) {
				summary.skipped.events += 1;
			} else {
				const eventTime = now + 2 * day;
				await ctx.db.patch(eventAnchorMessage._id, {
					calendarEvent: {
						date: eventTime,
						time: "15:00",
					},
				});
				const eventId = await ctx.db.insert("events", {
					title: "Release Readiness Review",
					date: eventTime,
					time: "15:00",
					messageId: eventAnchorMessage._id,
					memberId: ownerMember._id,
					workspaceId: args.workspaceId,
				});
				summary.created.events += 1;

				await ctx.scheduler.runAfter(0, api.ragchat.autoIndexCalendarEvent, {
					eventId,
				});
			}
		}

		return summary;
	},
});
