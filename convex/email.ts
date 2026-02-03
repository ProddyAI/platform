import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	type ActionCtx,
	action,
	internalMutation,
	type QueryCtx,
	query,
} from "./_generated/server";

// Get weekly digest data for a user across all their workspaces
export const getUserWeeklyDigest = query({
	args: {
		userId: v.id("users"),
		startDate: v.number(),
		endDate: v.number(),
	},
	handler: async (ctx, args): Promise<any> => {
		// Get all workspaces the user is a member of
		const memberships = await ctx.db
			.query("members")
			.withIndex("by_user_id", (q) => q.eq("userId", args.userId))
			.collect();

		const workspaceDigests = [];
		let totalMessages = 0;
		let totalTasks = 0;

		for (const membership of memberships) {
			const workspace = await ctx.db.get(membership.workspaceId);
			if (!workspace) continue;

			// Get workspace stats for the week
			const workspaceStats = await getWorkspaceWeeklyStats(ctx, {
				workspaceId: membership.workspaceId,
				startDate: args.startDate,
				endDate: args.endDate,
			});

			if (workspaceStats) {
				workspaceDigests.push({
					workspaceName: workspace.name,
					workspaceUrl: `${process.env.SITE_URL}/workspace/${workspace._id}`,
					stats: workspaceStats.stats,
					topChannels: workspaceStats.topChannels,
					recentTasks: workspaceStats.recentTasks,
				});

				totalMessages += workspaceStats.stats.totalMessages;
				totalTasks += workspaceStats.stats.totalTasks;
			}
		}

		return {
			workspaces: workspaceDigests,
			totalStats: {
				totalMessages,
				totalTasks,
				totalWorkspaces: workspaceDigests.length,
			},
		};
	},
});

// Get weekly stats for a specific workspace
async function getWorkspaceWeeklyStats(
	ctx: QueryCtx,
	args: {
		workspaceId: any;
		startDate: number;
		endDate: number;
	}
) {
	// Get messages count
	const messages = await ctx.db
		.query("messages")
		.withIndex("by_workspace_id", (q: any) =>
			q.eq("workspaceId", args.workspaceId)
		)
		.filter((q: any) =>
			q.and(
				q.gte(q.field("_creationTime"), args.startDate),
				q.lte(q.field("_creationTime"), args.endDate)
			)
		)
		.collect();

	// Get tasks count
	const tasks = await ctx.db
		.query("tasks")
		.withIndex("by_workspace_id", (q: any) =>
			q.eq("workspaceId", args.workspaceId)
		)
		.filter((q: any) =>
			q.and(
				q.gte(q.field("createdAt"), args.startDate),
				q.lte(q.field("createdAt"), args.endDate)
			)
		)
		.collect();

	const completedTasks = tasks.filter(
		(task: any) => task.completed || task.status === "completed"
	);

	// Get active users (users who sent messages)
	const activeUserIds = new Set(messages.map((msg: any) => msg.memberId));

	// Get top channels by message count
	const channelMessageCounts: { [key: string]: number } = {};
	for (const message of messages) {
		if (message.channelId) {
			channelMessageCounts[message.channelId] =
				(channelMessageCounts[message.channelId] || 0) + 1;
		}
	}

	const topChannels = [];
	for (const channelId in channelMessageCounts) {
		const count = channelMessageCounts[channelId];
		const channel = await ctx.db.get(channelId as any);
		if (channel && "name" in channel && count) {
			topChannels.push({
				name: channel.name,
				messageCount: count,
			});
		}
	}

	// Sort by message count and take top 5
	topChannels.sort((a, b) => b.messageCount - a.messageCount);

	// Get recent tasks (created or updated this week)
	const recentTasks = tasks.slice(0, 5).map((task: any) => ({
		title: task.title,
		status: task.completed ? "completed" : task.status || "not_started",
		dueDate: task.dueDate
			? new Date(task.dueDate).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				})
			: undefined,
	}));

	return {
		stats: {
			totalMessages: messages.length,
			totalTasks: tasks.length,
			completedTasks: completedTasks.length,
			activeUsers: activeUserIds.size,
		},
		topChannels: topChannels.slice(0, 3),
		recentTasks,
	};
}

// Get all users who have weekly digest enabled for a specific day
export const getUsersForWeeklyDigest = query({
	args: {
		dayOfWeek: v.union(
			v.literal("monday"),
			v.literal("tuesday"),
			v.literal("wednesday"),
			v.literal("thursday"),
			v.literal("friday"),
			v.literal("saturday"),
			v.literal("sunday")
		),
	},
	handler: async (ctx, args): Promise<any> => {
		// Get all user preferences where weekly digest is enabled for the specified day
		const preferences = await ctx.db
			.query("preferences")
			.filter((q) =>
				q.and(
					q.eq(q.field("settings.notifications.weeklyDigest"), true),
					q.eq(
						q.field("settings.notifications.weeklyDigestDay"),
						args.dayOfWeek
					)
				)
			)
			.collect();

		const users = [];
		for (const pref of preferences) {
			const user = await ctx.db.get(pref.userId);
			if (user?.email) {
				users.push({
					userId: pref.userId,
					email: user.email,
					name: user.name || "User",
				});
			}
		}

		return users;
	},
});

// Helper function to get a member by workspace and user ID (removed - using runQuery instead)

// Common email notification result type
type EmailNotificationResult = {
	success: boolean;
	error?: string;
	skipped?: boolean;
};

// Helper function to extract message preview from body
const extractMessagePreview = (
	body: string | undefined,
	defaultText: string
): string => {
	if (!body) return defaultText;

	try {
		// Try to parse as JSON (Quill Delta format)
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
				.join("")
				.trim();
		}
	} catch (_e) {
		// Not JSON, use as is (might contain HTML)
		return body
			.replace(/<[^>]*>/g, "") // Remove HTML tags
			.trim();
	}

	return defaultText;
};

// Action to send email notification for direct messages
export const sendDirectMessageEmail = action({
	args: {
		messageId: v.id("messages"),
	},
	handler: async (ctx, args): Promise<EmailNotificationResult> => {
		try {
			// Get the message using the existing query
			const message = await ctx.runQuery(api.messages._getMessageById, {
				messageId: args.messageId,
			});
			if (!message) {
				console.error("Message not found:", args.messageId);
				return { success: false, error: "Message not found" };
			}

			// Only process direct messages (messages with conversationId)
			if (!message.conversationId) {
				return { success: true, skipped: true };
			}

			// Get the conversation using the existing query
			const conversation = await ctx.runQuery(
				api.conversations._getConversationById,
				{
					conversationId: message.conversationId,
				}
			);
			if (!conversation) {
				console.error("Conversation not found:", message.conversationId);
				return { success: false, error: "Conversation not found" };
			}

			// Get the sender using the existing query
			const sender = await ctx.runQuery(api.members._getMemberById, {
				memberId: message.memberId,
			});
			if (!sender || !sender.user) {
				console.error("Sender not found:", message.memberId);
				return { success: false, error: "Sender not found" };
			}

			// Find the recipient (the other member in the conversation)
			const recipientMemberId =
				conversation.memberOneId === message.memberId
					? conversation.memberTwoId
					: conversation.memberOneId;

			const recipient = await ctx.runQuery(api.members._getMemberById, {
				memberId: recipientMemberId,
			});
			if (!recipient || !recipient.user || !recipient.user.email) {
				return { success: true, skipped: true };
			}

			// Don't send email to the sender
			if (sender.userId === recipient.userId) {
				return { success: true, skipped: true };
			}

			// Extract message preview
			const messagePreview = extractMessagePreview(
				message.body,
				"You have a new direct message"
			);

			// Send the email
			const baseUrl = process.env.SITE_URL;
			const workspaceUrl = `${baseUrl}/workspace/${message.workspaceId}`;
			const apiUrl = `${baseUrl}/api/email/direct-message`;

			try {
				const response: Response = await fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						to: recipient.user.email,
						userId: recipient.userId,
						firstName: recipient.user.name || "User",
						senderName: sender.user.name || "A team member",
						messagePreview: messagePreview,
						workspaceUrl: workspaceUrl,
						workspaceName: "Proddy",
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error("Email API error:", errorData);
					return {
						success: false,
						error: `Email API error: ${response.status} ${response.statusText}`,
					};
				}

				const result = await response.json();
				return { success: true };
			} catch (error) {
				console.error("Error sending direct message email:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			console.error("Error in sendDirectMessageEmail:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Action to send email notification for mentions
export const sendMentionEmail = action({
	args: {
		mentionId: v.id("mentions"),
	},
	handler: async (ctx, args): Promise<EmailNotificationResult> => {
		try {
			// Get the mention using the existing query
			const mention = await ctx.runQuery(api.mentions._getMentionById, {
				mentionId: args.mentionId,
			});
			if (!mention) {
				console.error("Mention not found:", args.mentionId);
				return { success: false, error: "Mention not found" };
			}

			// Get the mentioned member
			const mentionedMember = await ctx.runQuery(api.members._getMemberById, {
				memberId: mention.mentionedMemberId,
			});
			if (
				!mentionedMember ||
				!mentionedMember.user ||
				!mentionedMember.user.email
			) {
				return { success: true, skipped: true };
			}

			// Get the mentioner
			const mentioner = await ctx.runQuery(api.members._getMemberById, {
				memberId: mention.mentionerMemberId,
			});
			if (!mentioner || !mentioner.user) {
				console.error("Mentioner not found:", mention.mentionerMemberId);
				return { success: false, error: "Mentioner not found" };
			}

			// Don't send email to the mentioner themselves
			if (mentioner.userId === mentionedMember.userId) {
				return { success: true, skipped: true };
			}

			// Get the message if it exists
			let messagePreview = "You were mentioned in a message";
			if (mention.messageId) {
				const message = await ctx.runQuery(api.messages._getMessageById, {
					messageId: mention.messageId,
				});
				if (message) {
					messagePreview = extractMessagePreview(
						message.body,
						"You were mentioned in a message"
					);
				}
			}

			// Get channel name if it exists
			let channelName = "a channel";
			if (mention.channelId) {
				const channel = await ctx.runQuery(api.channels._getChannelById, {
					channelId: mention.channelId,
				});
				if (channel) {
					channelName = channel.name;
				}
			}

			// Send the email
			const baseUrl = process.env.SITE_URL;
			const workspaceUrl = `${baseUrl}/workspace/${mention.workspaceId}`;
			const apiUrl = `${baseUrl}/api/email/mention`;
			try {
				const response: Response = await fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						to: mentionedMember.user.email,
						userId: mentionedMember.userId,
						firstName: mentionedMember.user.name || "User",
						mentionerName: mentioner.user.name || "A team member",
						messagePreview: messagePreview,
						channelName: channelName,
						workspaceUrl: workspaceUrl,
						workspaceName: "Proddy",
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error("Email API error:", errorData);
					return {
						success: false,
						error: `Email API error: ${response.status} ${response.statusText}`,
					};
				}

				const result = await response.json();
				return { success: true };
			} catch (error) {
				console.error("Error sending mention email:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			console.error("Error in sendMentionEmail:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Action to send email notification for thread replies
export const sendThreadReplyEmail = action({
	args: {
		messageId: v.id("messages"),
		parentMessageId: v.id("messages"),
	},
	handler: async (ctx, args): Promise<EmailNotificationResult> => {
		try {
			// Get the reply message
			const replyMessage = await ctx.runQuery(api.messages._getMessageById, {
				messageId: args.messageId,
			});
			if (!replyMessage) {
				console.error("Reply message not found:", args.messageId);
				return { success: false, error: "Reply message not found" };
			}

			// Get the parent message
			const parentMessage = await ctx.runQuery(api.messages._getMessageById, {
				messageId: args.parentMessageId,
			});
			if (!parentMessage) {
				console.error("Parent message not found:", args.parentMessageId);
				return { success: false, error: "Parent message not found" };
			}

			// Get the original author (parent message author)
			const originalAuthor = await ctx.runQuery(api.members._getMemberById, {
				memberId: parentMessage.memberId,
			});
			if (
				!originalAuthor ||
				!originalAuthor.user ||
				!originalAuthor.user.email
			) {
				return { success: true, skipped: true };
			}

			// Get the replier
			const replier = await ctx.runQuery(api.members._getMemberById, {
				memberId: replyMessage.memberId,
			});
			if (!replier || !replier.user) {
				console.error("Replier not found:", replyMessage.memberId);
				return { success: false, error: "Replier not found" };
			}

			// Don't send email if the replier is the same as the original author
			if (replier.userId === originalAuthor.userId) {
				return { success: true, skipped: true };
			}

			// Extract message previews
			const originalMessagePreview = extractMessagePreview(
				parentMessage.body,
				"Original message"
			);
			const replyMessagePreview = extractMessagePreview(
				replyMessage.body,
				"Reply message"
			);

			// Get channel name if it exists
			let channelName = "a channel";
			if (replyMessage.channelId) {
				const channel = await ctx.runQuery(api.channels._getChannelById, {
					channelId: replyMessage.channelId,
				});
				if (channel) {
					channelName = channel.name;
				}
			}

			// Send the email
			const baseUrl = process.env.SITE_URL;
			const workspaceUrl = `${baseUrl}/workspace/${replyMessage.workspaceId}`;
			const apiUrl = `${baseUrl}/api/email/thread-reply`;
			try {
				const response: Response = await fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						to: originalAuthor.user.email,
						userId: originalAuthor.userId,
						firstName: originalAuthor.user.name || "User",
						replierName: replier.user.name || "A team member",
						originalMessagePreview: originalMessagePreview,
						replyMessagePreview: replyMessagePreview,
						channelName: channelName,
						workspaceUrl: workspaceUrl,
						workspaceName: "Proddy",
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error("Email API error:", errorData);
					return {
						success: false,
						error: `Email API error: ${response.status} ${response.statusText}`,
					};
				}

				const result = await response.json();
				return { success: true };
			} catch (error) {
				console.error("Error sending thread reply email:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			console.error("Error in sendThreadReplyEmail:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Weekly digest types
type WorkspaceDigest = {
	workspaceName: string;
	workspaceUrl: string;
	stats: {
		totalMessages: number;
		totalTasks: number;
		completedTasks: number;
		activeUsers: number;
	};
	topChannels: Array<{
		name: string;
		messageCount: number;
	}>;
	recentTasks: Array<{
		title: string;
		status: string;
		dueDate?: string;
	}>;
};

type DigestData = {
	workspaces: WorkspaceDigest[];
	totalStats: {
		totalMessages: number;
		totalTasks: number;
		totalWorkspaces: number;
	};
};

// Action to send weekly digest emails to users
export const sendWeeklyDigestEmails = action({
	args: {
		dayOfWeek: v.string(), // e.g., 'monday', 'tuesday', etc.
	},
	handler: async (ctx, args): Promise<any> => {
		try {
			// Get users who have weekly digest enabled for this day
			const users = await ctx.runQuery(api.email.getUsersForWeeklyDigest, {
				dayOfWeek: args.dayOfWeek as
					| "monday"
					| "tuesday"
					| "wednesday"
					| "thursday"
					| "friday"
					| "saturday"
					| "sunday",
			});


			const results = [];
			const weekRange = getWeekRange();

			// Calculate week start and end dates
			const now = Date.now();
			const currentDate = new Date(now);
			const dayOfWeek = currentDate.getDay();
			const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
			const weekStart = new Date(currentDate);
			weekStart.setDate(currentDate.getDate() - daysToMonday);
			weekStart.setHours(0, 0, 0, 0);
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 6);
			weekEnd.setHours(23, 59, 59, 999);

			for (const user of users) {
				try {
					// Get digest data for this user
					const digestData: DigestData = await ctx.runQuery(
						api.email.getUserWeeklyDigest,
						{
							userId: user.userId,
							startDate: weekStart.getTime(),
							endDate: weekEnd.getTime(),
						}
					);

					// Only send if user has activity in any workspace
					if (
						digestData.totalStats.totalMessages > 0 ||
						digestData.totalStats.totalTasks > 0
					) {
						// Call the email API
						const emailResponse = await fetch(
							`${process.env.SITE_URL}/api/email/weekly-digest`,
							{
								method: "POST",
								headers: {
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									to: user.email,
									userId: user.userId,
									firstName: user.name.split(" ")[0],
									weekRange,
									workspaces: digestData.workspaces,
									totalStats: digestData.totalStats,
								}),
							}
						);

						const emailResult = await emailResponse.json();

						results.push({
							userId: user.userId,
							email: user.email,
							success: emailResponse.ok,
							result: emailResult,
						});


					} else {
						results.push({
							userId: user.userId,
							email: user.email,
							success: true,
							skipped: true,
							reason: "No activity",
						});	
					}
				} catch (error) {
					console.error(
						`Error processing weekly digest for user ${user.email}:`,
						error
					);
					results.push({
						userId: user.userId,
						email: user.email,
						success: false,
						error: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}

			return {
				success: true,
				totalUsers: users.length,
				results,
			};
		} catch (error) {
			console.error("Error in sendWeeklyDigestEmails:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Helper function to get week range string
function getWeekRange(): string {
	const now = new Date();
	const startOfWeek = new Date(now);
	startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)

	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)

	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}, ${now.getFullYear()}`;
}

// Internal version for use in mutations
async function getUsersForWeeklyDigestInternal(
	ctx: QueryCtx,
	dayOfWeek: string
) {
	// Get all user preferences where weekly digest is enabled for the specified day
	const preferences = await ctx.db
		.query("preferences")
		.filter((q) =>
			q.and(
				q.eq(q.field("settings.notifications.weeklyDigest"), true),
				q.eq(q.field("settings.notifications.weeklyDigestDay"), dayOfWeek)
			)
		)
		.collect();

	const users = [];
	for (const pref of preferences) {
		const user = await ctx.db.get(pref.userId);
		if (user?.email) {
			users.push({
				userId: pref.userId,
				email: user.email,
				name: user.name || "User",
			});
		}
	}

	return users;
}

// Internal version for use in mutations
async function getUserWeeklyDigestInternal(
	ctx: QueryCtx,
	args: {
		userId: any;
		startDate: number;
		endDate: number;
	}
) {
	// Get all workspaces the user is a member of
	const memberships = await ctx.db
		.query("members")
		.withIndex("by_user_id", (q: any) => q.eq("userId", args.userId))
		.collect();

	const workspaceDigests = [];
	let totalMessages = 0;
	let totalTasks = 0;

	for (const membership of memberships) {
		const workspace = await ctx.db.get(membership.workspaceId);
		if (!workspace) continue;

		// Get workspace stats for the week
		const workspaceStats = await getWorkspaceWeeklyStats(ctx, {
			workspaceId: membership.workspaceId,
			startDate: args.startDate,
			endDate: args.endDate,
		});

		if (workspaceStats) {
			workspaceDigests.push({
				workspaceName: workspace.name,
				workspaceUrl: `${process.env.SITE_URL}/workspace/${workspace._id}`,
				stats: workspaceStats.stats,
				topChannels: workspaceStats.topChannels,
				recentTasks: workspaceStats.recentTasks,
			});

			totalMessages += workspaceStats.stats.totalMessages;
			totalTasks += workspaceStats.stats.totalTasks;
		}
	}

	return {
		workspaces: workspaceDigests,
		totalStats: {
			totalMessages,
			totalTasks,
			totalWorkspaces: workspaceDigests.length,
		},
	};
}

// Send weekly digest emails (to be called by scheduled function)
export const sendWeeklyDigests = internalMutation({
	args: {
		dayOfWeek: v.union(
			v.literal("monday"),
			v.literal("tuesday"),
			v.literal("wednesday"),
			v.literal("thursday"),
			v.literal("friday"),
			v.literal("saturday"),
			v.literal("sunday")
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const currentDate = new Date(now);

		// Get start of week (Monday)
		const dayOfWeek = currentDate.getDay();
		const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back to Monday
		const weekStart = new Date(currentDate);
		weekStart.setDate(currentDate.getDate() - daysToMonday);
		weekStart.setHours(0, 0, 0, 0);

		// Get end of week (Sunday)
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		weekEnd.setHours(23, 59, 59, 999);

		const weekRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

		// Get users who should receive digest today
		const users = await getUsersForWeeklyDigestInternal(ctx, args.dayOfWeek);

		const results = [];

		for (const user of users) {
			try {
				// Get user's weekly digest data
				const digestData = await getUserWeeklyDigestInternal(ctx, {
					userId: user.userId,
					startDate: weekStart.getTime(),
					endDate: weekEnd.getTime(),
				});

				// Only send if user has activity in any workspace
				if (
					digestData.totalStats.totalMessages > 0 ||
					digestData.totalStats.totalTasks > 0
				) {
					// Call the email API
					const emailResponse = await fetch(
						`${process.env.SITE_URL}/api/email/weekly-digest`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								to: user.email,
								firstName: user.name.split(" ")[0],
								weekRange,
								workspaces: digestData.workspaces,
								totalStats: digestData.totalStats,
							}),
						}
					);

					const emailResult = await emailResponse.json();

					results.push({
						userId: user.userId,
						email: user.email,
						success: emailResponse.ok,
						result: emailResult,
					});
				} else {
					results.push({
						userId: user.userId,
						email: user.email,
						success: true,
						skipped: true,
						reason: "No activity this week",
					});
				}
			} catch (error) {
				results.push({
					userId: user.userId,
					email: user.email,
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		return {
			dayOfWeek: args.dayOfWeek,
			weekRange,
			totalUsers: users.length,
			results,
		};
	},
});

// Card details type for card assignment emails
type CardDetails = {
	title: string;
	description?: string;
	dueDate?: number | string;
	priority?: string;
	listName: string;
	channelName: string;
	channelId: Id<"channels">;
	workspaceId: Id<"workspaces">;
	listId: Id<"lists">;
	_id: Id<"cards">;
	_creationTime: number;
	[key: string]: any; // For other properties from the card
};

// Action to send email notification for card assignment
export const sendCardAssignmentEmail = action({
	args: {
		assigneeId: v.id("members"),
		cardId: v.id("cards"),
		assignerId: v.id("members"),
	},
	handler: async (
		ctx: ActionCtx,
		{
			assigneeId,
			cardId,
			assignerId,
		}: {
			assigneeId: Id<"members">;
			cardId: Id<"cards">;
			assignerId: Id<"members">;
		}
	): Promise<EmailNotificationResult> => {
		try {
			// Get the card details
			const card: CardDetails | null = await ctx.runQuery(
				api.board._getCardDetails,
				{ cardId }
			);
			if (!card) {
				console.error("Card not found for email notification:", cardId);
				return { success: false, error: "Card not found" };
			}
			// Get the assignee's email and name
			const assigneeEmail: string | null = await ctx.runQuery(
				api.board._getMemberEmail,
				{
					memberId: assigneeId,
				}
			);
			if (!assigneeEmail) {
				return { success: true, skipped: true };
			}

			const assigneeName: string | null = await ctx.runQuery(
				api.board._getMemberName,
				{
					memberId: assigneeId,
				}
			);

			// Get the assigner's name
			const assignerName: string | null = await ctx.runQuery(
				api.board._getMemberName,
				{
					memberId: assignerId,
				}
			);

			// Send the email
			// Make sure we're using the correct URL format for the API endpoint
			const baseUrl = process.env.SITE_URL;
			const workspaceUrl = `${baseUrl}/workspace/${card.workspaceId}/channel/${card.channelId}/board`;
			const apiUrl = `${baseUrl}/api/email/assignee`;

			try {
				const response: Response = await fetch(apiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						to: assigneeEmail,
						userId: assigneeId,
						firstName: assigneeName || "User",
						type: "card_assignment",
						cardTitle: card.title,
						cardDescription: card.description,
						dueDate: card.dueDate,
						priority: card.priority,
						listName: card.listName,
						channelName: card.channelName,
						assignedBy: assignerName || "A team member",
						workspaceUrl,
						workspaceName: "Proddy",
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error("Email API error:", errorData);
					return {
						success: false,
						error: `Email API error: ${response.status} ${response.statusText}`,
					};
				}

				const result = await response.json();
				return { success: true };
			} catch (error) {
				console.error("Error sending card assignment email:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			console.error("Error in sendCardAssignmentEmail:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
