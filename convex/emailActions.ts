"use node";

import { v } from "convex/values";
import crypto from "crypto";
import { Resend } from "resend";
import { logger } from "../src/lib/logger";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, action, internalAction } from "./_generated/server";

// Initialize Resend SDK
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration - get from environment
function getEmailConfig() {
	const fromAddress = process.env.RESEND_FROM_EMAIL;
	const replyToAddress = process.env.RESEND_FROM_EMAIL;

	if (!fromAddress) {
		throw new Error("RESEND_FROM_EMAIL environment variable is required");
	}

	return { fromAddress, replyToAddress };
}

// Get SITE_URL from environment
function getSiteUrl(): string {
	const siteUrl = process.env.SITE_URL;
	if (!siteUrl) {
		throw new Error("SITE_URL environment variable is required");
	}
	return siteUrl;
}

// Generate unsubscribe URL for Convex (server-side version)
function generateUnsubscribeUrl(
	userId: string,
	emailType:
		| "mentions"
		| "assignee"
		| "threadReply"
		| "directMessage"
		| "weeklyDigest"
): string {
	const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
	if (!secret) {
		logger.warn(
			"EMAIL_UNSUBSCRIBE_SECRET not configured, skipping unsubscribe URL"
		);
		return "";
	}

	const timestamp = Date.now().toString();
	const data = `${userId}:${emailType}:${timestamp}`;

	const signature = crypto
		.createHmac("sha256", secret)
		.update(data)
		.digest("hex");

	const siteUrl = getSiteUrl();
	const params = new URLSearchParams({
		userId,
		emailType,
		timestamp,
		signature,
	});

	return `${siteUrl}/api/email/unsubscribe?${params.toString()}`;
}

// Helper function to escape HTML to prevent XSS
const escapeHtml = (unsafe: string): string => {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
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

// Common email notification result type
type EmailNotificationResult = {
	success: boolean;
	error?: string;
	skipped?: boolean;
	emailId?: string;
};

type EmailNotificationKey =
	| "mentions"
	| "directMessage"
	| "threadReply"
	| "assignee";

const shouldSendEmailNotification = async (
	ctx: ActionCtx,
	userId: Id<"users">,
	key: EmailNotificationKey
): Promise<boolean> => {
	const prefs = await ctx.runQuery(
		api.preferences.getNotificationPreferencesByUserId,
		{
			userId,
		}
	);

	const emailEnabled = prefs?.emailNotificationsEnabled ?? true;
	const emailPrefFromMap = prefs?.notificationEmailPrefs?.[key];
	const emailPrefFromLegacy = prefs?.[key];
	const emailPref =
		typeof emailPrefFromMap === "boolean"
			? emailPrefFromMap
			: (emailPrefFromLegacy ?? true);

	return !!emailEnabled && !!emailPref;
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
				logger.error("Message not found:", args.messageId);
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
				logger.error("Conversation not found:", message.conversationId);
				return { success: false, error: "Conversation not found" };
			}

			// Get the sender using the existing query
			const sender = await ctx.runQuery(api.members.getMemberById, {
				memberId: message.memberId,
			});
			if (!sender?.user) {
				logger.error("Sender not found:", message.memberId);
				return { success: false, error: "Sender not found" };
			}

			// Find the recipient (the other member in the conversation)
			const recipientMemberId =
				conversation.memberOneId === message.memberId
					? conversation.memberTwoId
					: conversation.memberOneId;

			const recipient = await ctx.runQuery(api.members.getMemberById, {
				memberId: recipientMemberId,
			});
			if (!recipient?.user?.email) {
				return { success: true, skipped: true };
			}

			const canSendEmail = await shouldSendEmailNotification(
				ctx,
				recipient.userId,
				"directMessage"
			);
			if (!canSendEmail) {
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

			// Generate unsubscribe URL
			const unsubscribeUrl = generateUnsubscribeUrl(
				recipient.userId,
				"directMessage"
			);

			// Send the email directly using Resend
			try {
				const { fromAddress, replyToAddress } = getEmailConfig();
				const subject = `New direct message from ${sender.user.name || "A team member"}`;

				// Send email using Resend
				const { data, error } = await resend.emails.send({
					from: fromAddress,
					to: [recipient.user.email],
					subject,
					html: `
						<html>
							<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
								<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
									<h2>New Direct Message</h2>
									<p>Hi ${escapeHtml(recipient.user.name || "User")},</p>
									<p><strong>${escapeHtml(sender.user.name || "A team member")}</strong> sent you a direct message:</p>
									<blockquote style="border-left: 4px solid #667eea; padding-left: 16px; margin: 16px 0; color: #666;">
										${escapeHtml(messagePreview)}
									</blockquote>
									<p><a href="${escapeHtml(getSiteUrl())}/workspace/${escapeHtml(message.workspaceId)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Proddy</a></p>
									${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from direct message emails</a></p>` : ""}
								</div>
							</body>
						</html>
					`,
					replyTo: replyToAddress,
				});

				if (error) {
					logger.error("Resend error sending direct message email:", error);
					return {
						success: false,
						error: `Failed to send email: ${error.message}`,
					};
				}

				logger.info("Direct message email sent successfully via Resend", {
					emailId: data?.id,
					to: recipient.user.email,
				});
				return { success: true };
			} catch (error) {
				logger.error("Error sending direct message email via Resend:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			logger.error("Error in sendDirectMessageEmail:", error);
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
				logger.error("Mention not found:", args.mentionId);
				return { success: false, error: "Mention not found" };
			}

			// Get the mentioned member
			const mentionedMember = await ctx.runQuery(api.members.getMemberById, {
				memberId: mention.mentionedMemberId,
			});
			if (!mentionedMember?.user?.email) {
				return { success: true, skipped: true };
			}

			const canSendEmail = await shouldSendEmailNotification(
				ctx,
				mentionedMember.userId,
				"mentions"
			);
			if (!canSendEmail) {
				return { success: true, skipped: true };
			}

			// Get the mentioner
			const mentioner = await ctx.runQuery(api.members.getMemberById, {
				memberId: mention.mentionerMemberId,
			});
			if (!mentioner?.user) {
				logger.error("Mentioner not found:", mention.mentionerMemberId);
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

			// Generate unsubscribe URL
			const unsubscribeUrl = generateUnsubscribeUrl(
				mentionedMember.userId,
				"mentions"
			);

			// Send the email directly using Resend
			try {
				const { fromAddress, replyToAddress } = getEmailConfig();
				const subject = `You were mentioned in ${escapeHtml(channelName)} - Proddy`;

				const { data, error } = await resend.emails.send({
					from: fromAddress,
					to: [mentionedMember.user.email],
					subject,
					html: `
						<html>
							<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
								<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
									<h2>You were mentioned in ${escapeHtml(channelName)}</h2>
									<p>Hi ${escapeHtml(mentionedMember.user.name || "User")},</p>
									<p><strong>${escapeHtml(mentioner.user.name || "A team member")}</strong> mentioned you in the <strong>${escapeHtml(channelName)}</strong> channel:</p>
									<blockquote style="border-left: 4px solid #667eea; padding-left: 16px; margin: 16px 0; color: #666;">
										${escapeHtml(messagePreview)}
									</blockquote>
									<p><a href="${escapeHtml(getSiteUrl())}/workspace/${escapeHtml(mention.workspaceId)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Proddy</a></p>
									${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from mention emails</a></p>` : ""}
								</div>
							</body>
						</html>
					`,
					replyTo: replyToAddress,
				});

				if (error) {
					logger.error("Resend error sending mention email:", error);
					return {
						success: false,
						error: `Failed to send email: ${error.message}`,
					};
				}

				logger.info("Mention email sent successfully via Resend", {
					emailId: data?.id,
					to: mentionedMember.user.email,
				});
				return { success: true };
			} catch (error) {
				logger.error("Error sending mention email via Resend:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			logger.error("Error in sendMentionEmail:", error);
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
				logger.error("Reply message not found:", args.messageId);
				return { success: false, error: "Reply message not found" };
			}

			// Get the parent message
			const parentMessage = await ctx.runQuery(api.messages._getMessageById, {
				messageId: args.parentMessageId,
			});
			if (!parentMessage) {
				logger.error("Parent message not found:", args.parentMessageId);
				return { success: false, error: "Parent message not found" };
			}

			// Get the original author (parent message author)
			const originalAuthor = await ctx.runQuery(api.members.getMemberById, {
				memberId: parentMessage.memberId,
			});
			if (!originalAuthor?.user?.email) {
				return { success: true, skipped: true };
			}

			const canSendEmail = await shouldSendEmailNotification(
				ctx,
				originalAuthor.userId,
				"threadReply"
			);
			if (!canSendEmail) {
				return { success: true, skipped: true };
			}

			// Get the replier
			const replier = await ctx.runQuery(api.members.getMemberById, {
				memberId: replyMessage.memberId,
			});
			if (!replier?.user) {
				logger.error("Replier not found:", replyMessage.memberId);
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

			// Generate unsubscribe URL
			const unsubscribeUrl = generateUnsubscribeUrl(
				originalAuthor.userId,
				"threadReply"
			);

			// Send the email directly using Resend
			try {
				const { fromAddress, replyToAddress } = getEmailConfig();
				const subject = `${escapeHtml(replier.user.name || "A team member")} replied to your message in Proddy`;

				const { data, error } = await resend.emails.send({
					from: fromAddress,
					to: [originalAuthor.user.email],
					subject,
					html: `
						<html>
							<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
								<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
									<h2>New Reply to Your Message</h2>
									<p>Hi ${escapeHtml(originalAuthor.user.name || "User")},</p>
									<p><strong>${escapeHtml(replier.user.name || "A team member")}</strong> replied to your message in <strong>${escapeHtml(channelName)}</strong>:</p>
									<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
										<p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">Your message:</p>
										<blockquote style="border-left: 4px solid #e0e0e0; padding-left: 16px; margin: 0; color: #666;">
											${escapeHtml(originalMessagePreview)}
										</blockquote>
									</div>
									<div style="background: #f0f7ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
										<p style="margin: 0 0 10px 0; color: #666; font-size: 12px;">Reply:</p>
										<blockquote style="border-left: 4px solid #667eea; padding-left: 16px; margin: 0; color: #333;">
											${escapeHtml(replyMessagePreview)}
										</blockquote>
									</div>
									<p><a href="${escapeHtml(getSiteUrl())}/workspace/${escapeHtml(replyMessage.workspaceId)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Thread</a></p>
									${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from thread reply emails</a></p>` : ""}
								</div>
							</body>
						</html>
					`,
					replyTo: replyToAddress,
				});

				if (error) {
					logger.error("Resend error sending thread reply email:", error);
					return {
						success: false,
						error: `Failed to send email: ${error.message}`,
					};
				}

				logger.info("Thread reply email sent successfully via Resend", {
					emailId: data?.id,
					to: originalAuthor.user.email,
				});
				return { success: true };
			} catch (error) {
				logger.error("Error sending thread reply email via Resend:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			logger.error("Error in sendThreadReplyEmail:", error);
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
		dayOfWeek: v.string(),
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
						// Generate unsubscribe URL
						const unsubscribeUrl = generateUnsubscribeUrl(
							user.userId,
							"weeklyDigest"
						);

						// Send email directly using Resend
						try {
							const { fromAddress, replyToAddress } = getEmailConfig();
							const subject = `Your Proddy Weekly Digest - ${weekRange}`;
							const firstName = user.name.split(" ")[0];

							// Build simple HTML digest
							const workspacesHtml = digestData.workspaces
								.map(
									(ws) => `
									<div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
										<h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(ws.workspaceName)}</h3>
										<p style="margin: 5px 0; color: #666;">📊 <strong>${ws.stats.totalMessages}</strong> messages | 📋 <strong>${ws.stats.totalTasks}</strong> tasks (${ws.stats.completedTasks} completed)</p>
										${ws.topChannels.length > 0 ? `<p style="margin: 5px 0; color: #666;"><strong>Top channels:</strong> ${ws.topChannels.map((c) => `${escapeHtml(c.name!)} (${c.messageCount!})`).join(", ")}</p>` : ""}
									</div>
								`
								)
								.join("");

							const { data, error } = await resend.emails.send({
								from: fromAddress,
								to: [user.email],
								subject,
								html: `
									<html>
										<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
											<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
												<h1 style="margin-top: 0; color: #333;">Weekly Digest</h1>
												<p>Hi ${escapeHtml(firstName)},</p>
												<p>Here's your summary for the week of <strong>${weekRange}</strong>:</p>
												${workspacesHtml}
												<p style="text-align: center; margin-top: 30px;">
													<a href="${escapeHtml(getSiteUrl())}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Proddy</a>
												</p>
												${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from weekly digest</a></p>` : ""}
											</div>
										</body>
									</html>
								`,
								replyTo: replyToAddress,
							});

							if (error) {
								logger.error(
									`Resend error sending weekly digest to ${user.email}:`,
									error
								);
								results.push({
									userId: user.userId,
									email: user.email,
									success: false,
									error: `Failed to send email: ${error.message}`,
								});
							} else {
								logger.info(
									"Weekly digest email sent successfully via Resend",
									{
										emailId: data?.id,
										to: user.email,
									}
								);
								results.push({
									userId: user.userId,
									email: user.email,
									success: true,
									emailId: data?.id,
								});
							}
						} catch (error) {
							logger.error(
								`Error sending weekly digest to ${user.email} via Resend:`,
								error
							);
							results.push({
								userId: user.userId,
								email: user.email,
								success: false,
								error: error instanceof Error ? error.message : "Unknown error",
							});
						}
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
					logger.error(
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
			logger.error("Error in sendWeeklyDigestEmails:", error);
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
	startOfWeek.setDate(now.getDate() - now.getDay());

	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(startOfWeek.getDate() + 6);

	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}, ${now.getFullYear()}`;
}

// Main action: Send weekly digest emails (called by scheduler for a specific day)
export const sendWeeklyDigests = action({
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
		try {
			const now = Date.now();
			const currentDate = new Date(now);

			// Get start of week (Monday)
			const dayOfWeek = currentDate.getDay();
			const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
			const weekStart = new Date(currentDate);
			weekStart.setDate(currentDate.getDate() - daysToMonday);
			weekStart.setHours(0, 0, 0, 0);

			// Get end of week (Sunday)
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 6);
			weekEnd.setHours(23, 59, 59, 999);

			const weekRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

			// Get users who should receive digest today
			const users = await ctx.runQuery(api.email.getUsersForWeeklyDigest, {
				dayOfWeek: args.dayOfWeek,
			});

			const results = [];

			for (const user of users) {
				try {
					// Get user's weekly digest data
					const digestData = await ctx.runQuery(api.email.getUserWeeklyDigest, {
						userId: user.userId,
						startDate: weekStart.getTime(),
						endDate: weekEnd.getTime(),
					});

					// Only trigger action if user has activity
					if (
						digestData.totalStats.totalMessages > 0 ||
						digestData.totalStats.totalTasks > 0
					) {
						// Call the internal action to send email
						const result = await ctx.runAction(
							internal.emailActions.sendWeeklyDigestEmail,
							{
								userId: user.userId,
								email: user.email,
								name: user.name,
								weekRange,
								digestData,
							}
						);
						results.push({ userId: user.userId, email: user.email, ...result });
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
		} catch (error) {
			logger.error("Error in sendWeeklyDigests:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// New action: Send weekly digest email for a single user (called by mutation)
export const sendWeeklyDigestEmail = internalAction({
	args: {
		userId: v.id("users"),
		email: v.string(),
		name: v.string(),
		weekRange: v.string(),
		digestData: v.any(),
	},
	handler: async (ctx, args): Promise<EmailNotificationResult> => {
		try {
			const { fromAddress, replyToAddress } = getEmailConfig();
			const subject = `Your Proddy Weekly Digest - ${args.weekRange}`;
			const firstName = args.name.split(" ")[0];

			// Generate unsubscribe URL
			const unsubscribeUrl = generateUnsubscribeUrl(
				args.userId,
				"weeklyDigest"
			);

			// Build simple HTML digest
			const workspacesHtml = (args.digestData.workspaces || [])
				.map(
					(ws: any) => `
					<div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
						<h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(ws.workspaceName)}</h3>
						<p style="margin: 5px 0; color: #666;">📊 <strong>${ws.stats.totalMessages}</strong> messages | 📋 <strong>${ws.stats.totalTasks}</strong> tasks (${ws.stats.completedTasks} completed)</p>
						${ws.topChannels.length > 0 ? `<p style="margin: 5px 0; color: #666;"><strong>Top channels:</strong> ${ws.topChannels.map((c: any) => `${escapeHtml(c.name!)} (${c.messageCount!})`).join(", ")}</p>` : ""}
					</div>
				`
				)
				.join("");

			// Send email directly using Resend
			const { data, error } = await resend.emails.send({
				from: fromAddress,
				to: [args.email],
				subject,
				html: `
					<html>
						<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
							<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
								<h1 style="margin-top: 0; color: #333;">Weekly Digest</h1>
								<p>Hi ${escapeHtml(firstName)},</p>
								<p>Here's your summary for the week of <strong>${args.weekRange}</strong>:</p>
								${workspacesHtml}
								<p style="text-align: center; margin-top: 30px;">
									<a href="${escapeHtml(getSiteUrl())}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Proddy</a>
								</p>
								${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from weekly digest</a></p>` : ""}
							</div>
						</body>
					</html>
				`,
				replyTo: replyToAddress,
			});

			if (error) {
				logger.error(
					`Resend error sending weekly digest to ${args.email}:`,
					error
				);
				return {
					success: false,
					error: `Failed to send email: ${error.message}`,
				};
			}

			logger.info("Weekly digest email sent successfully via Resend", {
				emailId: data?.id,
				to: args.email,
			});
			return { success: true, emailId: data?.id };
		} catch (error) {
			logger.error(
				`Error sending weekly digest to ${args.email} via Resend:`,
				error
			);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
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
	[key: string]: any;
};

// Action to send email notification for card assignment
export const sendCardAssignmentEmail = action({
	args: {
		assigneeId: v.id("members"),
		cardId: v.id("cards"),
		assignerId: v.id("members"),
	},
	handler: async (
		ctx,
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
				logger.error("Card not found for email notification:", cardId);
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

			const assigneeMember = await ctx.runQuery(api.members.getMemberById, {
				memberId: assigneeId,
			});
			if (!assigneeMember?.userId) {
				return { success: true, skipped: true };
			}
			const canSendEmail = await shouldSendEmailNotification(
				ctx,
				assigneeMember.userId,
				"assignee"
			);
			if (!canSendEmail) {
				return { success: true, skipped: true };
			}

			// Get the assigner's name
			const assignerName: string | null = await ctx.runQuery(
				api.board._getMemberName,
				{
					memberId: assignerId,
				}
			);

			// Generate unsubscribe URL
			const unsubscribeUrl = generateUnsubscribeUrl(
				assigneeMember.userId,
				"assignee"
			);

			// Send the email directly using Resend
			try {
				const { fromAddress, replyToAddress } = getEmailConfig();
				const subject = `Card Assignment: ${escapeHtml(card.title)}`;
				const siteUrl = getSiteUrl();
				const workspaceUrl = `${siteUrl}/workspace/${escapeHtml(card.workspaceId)}/channel/${escapeHtml(card.channelId)}/board`;

				const { data, error } = await resend.emails.send({
					from: fromAddress,
					to: [assigneeEmail],
					subject,
					html: `
						<html>
							<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
								<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
									<h2>Card Assignment</h2>
									<p>Hi ${escapeHtml(assigneeName || "User")},</p>
									<p><strong>${escapeHtml(assignerName || "A team member")}</strong> assigned you a card in <strong>${escapeHtml(card.channelName)}</strong>:</p>
									<div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
										<h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(card.title)}</h3>
										${card.description ? `<p style="margin: 5px 0; color: #666;"><strong>Description:</strong> ${escapeHtml(card.description)}</p>` : ""}
										${card.dueDate ? `<p style="margin: 5px 0; color: #666;"><strong>Due:</strong> ${new Date(typeof card.dueDate === "string" ? parseInt(card.dueDate) : card.dueDate).toLocaleDateString()}</p>` : ""}
										${card.priority ? `<p style="margin: 5px 0; color: #666;"><strong>Priority:</strong> ${escapeHtml(card.priority)}</p>` : ""}
										<p style="margin: 5px 0; color: #666;"><strong>List:</strong> ${escapeHtml(card.listName)}</p>
									</div>
									<p><a href="${escapeHtml(workspaceUrl)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Card</a></p>
									${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from assignment emails</a></p>` : ""}
								</div>
							</body>
						</html>
					`,
					replyTo: replyToAddress,
				});

				if (error) {
					logger.error("Resend error sending card assignment email:", error);
					return {
						success: false,
						error: `Failed to send email: ${error.message}`,
					};
				}

				logger.info("Card assignment email sent successfully via Resend", {
					emailId: data?.id,
					to: assigneeEmail,
				});
				return { success: true };
			} catch (error) {
				logger.error("Error sending card assignment email via Resend:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			logger.error("Error in sendCardAssignmentEmail:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// Action to send email notification for issue assignment
export const sendIssueAssignmentEmail = action({
	args: {
		assigneeId: v.id("members"),
		issueId: v.id("issues"),
		assignerId: v.id("members"),
	},
	handler: async (
		ctx,
		{
			assigneeId,
			issueId,
			assignerId,
		}: {
			assigneeId: Id<"members">;
			issueId: Id<"issues">;
			assignerId: Id<"members">;
		}
	): Promise<EmailNotificationResult> => {
		try {
			const issue = await ctx.runQuery(api.board._getIssueDetails, { issueId });
			if (!issue) {
				return { success: false, error: "Issue not found" };
			}

			const assigneeEmail: string | null = await ctx.runQuery(
				api.board._getMemberEmail,
				{ memberId: assigneeId }
			);
			if (!assigneeEmail) return { success: true, skipped: true };

			const assigneeName: string | null = await ctx.runQuery(
				api.board._getMemberName,
				{ memberId: assigneeId }
			);

			const assigneeMember = await ctx.runQuery(api.members.getMemberById, {
				memberId: assigneeId,
			});
			if (!assigneeMember?.userId) {
				return { success: true, skipped: true };
			}
			const canSendEmail = await shouldSendEmailNotification(
				ctx,
				assigneeMember.userId,
				"assignee"
			);
			if (!canSendEmail) {
				return { success: true, skipped: true };
			}

			const assignerName: string | null = await ctx.runQuery(
				api.board._getMemberName,
				{ memberId: assignerId }
			);

			// Generate unsubscribe URL
			const unsubscribeUrl = generateUnsubscribeUrl(
				assigneeMember.userId,
				"assignee"
			);

			// Send the email directly using Resend
			try {
				const { fromAddress, replyToAddress } = getEmailConfig();
				const subject = `Issue Assignment: ${escapeHtml(issue.title)}`;
				const siteUrl = getSiteUrl();
				const workspaceUrl = `${siteUrl}/workspace/${escapeHtml(issue.workspaceId)}/channel/${escapeHtml(issue.channelId)}/board`;

				const { data, error } = await resend.emails.send({
					from: fromAddress,
					to: [assigneeEmail],
					subject,
					html: `
						<html>
							<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
								<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
									<h2>Issue Assignment</h2>
									<p>Hi ${escapeHtml(assigneeName || "User")},</p>
									<p><strong>${escapeHtml(assignerName || "A team member")}</strong> assigned you an issue in <strong>${escapeHtml(issue.channelName)}</strong>:</p>
									<div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
										<h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(issue.title)}</h3>
										${issue.description ? `<p style="margin: 5px 0; color: #666;"><strong>Description:</strong> ${escapeHtml(issue.description)}</p>` : ""}
										${issue.dueDate ? `<p style="margin: 5px 0; color: #666;"><strong>Due:</strong> ${new Date(typeof issue.dueDate === "string" ? parseInt(issue.dueDate) : issue.dueDate).toLocaleDateString()}</p>` : ""}
										${issue.priority ? `<p style="margin: 5px 0; color: #666;"><strong>Priority:</strong> ${escapeHtml(issue.priority)}</p>` : ""}
										<p style="margin: 5px 0; color: #666;"><strong>Status:</strong> ${escapeHtml(issue.statusName || "Board")}</p>
									</div>
									<p><a href="${escapeHtml(workspaceUrl)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Issue</a></p>
									${unsubscribeUrl ? `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;"><p style="font-size: 12px; color: #999;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #999; text-decoration: none;">Unsubscribe from assignment emails</a></p>` : ""}
								</div>
							</body>
						</html>
					`,
					replyTo: replyToAddress,
				});

				if (error) {
					logger.error("Resend error sending issue assignment email:", error);
					return {
						success: false,
						error: `Failed to send email: ${error.message}`,
					};
				}

				logger.info("Issue assignment email sent successfully via Resend", {
					emailId: data?.id,
					to: assigneeEmail,
				});
				return { success: true };
			} catch (error) {
				logger.error(
					"Error sending issue assignment email via Resend:",
					error
				);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Send import completion email notification
 */
export const sendImportCompletionEmail = internalAction({
	args: {
		email: v.string(),
		userName: v.string(),
		platform: v.string(),
		status: v.union(
			v.literal("completed"),
			v.literal("failed"),
			v.literal("cancelled")
		),
		channelsImported: v.number(),
		messagesImported: v.number(),
		workspaceId: v.id("workspaces"),
	},
	handler: async (_ctx, args) => {
		try {
			const { fromAddress, replyToAddress } = getEmailConfig();

			const siteUrl = getSiteUrl();
			const workspaceUrl = `${siteUrl}/workspace/${args.workspaceId}`;
			const platformName =
				args.platform.charAt(0).toUpperCase() + args.platform.slice(1);

			let subject: string;
			let html: string;

			if (args.status === "completed") {
				subject = `✅ ${platformName} Import Completed Successfully`;
				html = `
					<html>
						<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
							<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
								<h1 style="margin-top: 0; color: #333;">🎉 Import Completed!</h1>
								<p>Hi ${escapeHtml(args.userName)},</p>
								<p>Great news! Your ${escapeHtml(platformName)} data has been successfully imported into your Proddy workspace.</p>
								<div style="background: #f0f7ff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
									<h3 style="margin: 0 0 10px 0; color: #333;">Import Summary</h3>
									<p style="margin: 5px 0;"><strong>Channels Imported:</strong> ${args.channelsImported}</p>
									<p style="margin: 5px 0;"><strong>Messages Imported:</strong> ${args.messagesImported.toLocaleString()}</p>
									<p style="margin: 5px 0;"><strong>Platform:</strong> ${escapeHtml(platformName)}</p>
								</div>
								<p>All your ${escapeHtml(platformName)} conversations, channels, and messages are now available in your workspace. You can start collaborating with your team right away!</p>
								<p><a href="${escapeHtml(workspaceUrl)}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Workspace</a></p>
							</div>
						</body>
					</html>
				`;
			} else if (args.status === "failed") {
				subject = `❌ ${platformName} Import Failed`;
				html = `
					<html>
						<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
							<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
								<h1 style="margin-top: 0; color: #ef4444;">Import Failed</h1>
								<p>Hi ${escapeHtml(args.userName)},</p>
								<p>Unfortunately, your ${escapeHtml(platformName)} data import encountered an error and could not be completed.</p>
								<p>Please try again or contact our support team if the issue persists.</p>
								<p><a href="${escapeHtml(workspaceUrl)}/manage?tab=import" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Try Again</a></p>
							</div>
						</body>
					</html>
				`;
			} else {
				subject = `${platformName} Import Cancelled`;
				html = `
					<html>
						<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
							<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
								<h1 style="margin-top: 0; color: #f59e0b;">Import Cancelled</h1>
								<p>Hi ${escapeHtml(args.userName)},</p>
								<p>Your ${escapeHtml(platformName)} data import was cancelled.</p>
								<p>You can start a new import anytime from your workspace settings.</p>
							</div>
						</body>
					</html>
				`;
			}

			// Send email directly using Resend
			try {
				const { data, error } = await resend.emails.send({
					from: fromAddress,
					to: [args.email],
					subject,
					html,
					replyTo: replyToAddress,
				});

				if (error) {
					logger.error("Resend error sending import completion email:", error);
					return {
						success: false,
						error: `Failed to send email: ${error.message}`,
					};
				}

				logger.info("Import completion email sent successfully via Resend", {
					emailId: data?.id,
					to: args.email,
				});
				return { success: true };
			} catch (error) {
				logger.error(
					"Error sending import completion email via Resend:",
					error
				);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} catch (error) {
			logger.error("Error in sendImportCompletionEmail:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
