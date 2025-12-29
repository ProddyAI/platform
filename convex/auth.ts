import GitHub from '@auth/core/providers/github';
import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { DataModel, Id } from './_generated/dataModel';
import { mutation } from './_generated/server';

const CustomPassword = Password<DataModel>({
	profile(params) {
		return {
			email: params.email as string,
			name: params.name as string,
		};
	},
});

// Custom GitHub provider with proper profile mapping
const CustomGitHub = GitHub({
	profile(profile) {
		return {
			id: profile.id.toString(),
			name: profile.name || profile.login || '',
			email: profile.email || '',
			image: profile.avatar_url || '',
		};
	},
});

// Custom Google provider with proper profile mapping
const CustomGoogle = Google({
	profile(profile) {
		return {
			id: profile.sub,
			name: profile.name || '',
			email: profile.email || '',
			image: profile.picture || '',
		};
	},
});

export const { auth, signIn, signOut, store } = convexAuth({
	providers: [CustomPassword, CustomGitHub, CustomGoogle],
});

// Function to clean up orphaned auth accounts
export const cleanupOrphanedAuthAccounts = mutation({
	args: {},
	handler: async (ctx) => {
		// This function should be called by an admin to clean up orphaned auth accounts
		// Get all auth accounts
		const authAccounts = await ctx.db.query('authAccounts').collect();

		let cleanedCount = 0;

		for (const authAccount of authAccounts) {
			// Check if the user still exists
			try {
				const user = await ctx.db.get(authAccount.userId);
				if (!user) {
					// User doesn't exist, delete the orphaned auth account
					await ctx.db.delete(authAccount._id);
					cleanedCount++;
					console.log(
						`Deleted orphaned auth account for user ${authAccount.userId}`
					);
				}
			} catch (e) {
				// User doesn't exist, delete the orphaned auth account
				await ctx.db.delete(authAccount._id);
				cleanedCount++;
				console.log(
					`Deleted orphaned auth account for user ${authAccount.userId}`
				);
			}
		}

		return { success: true, cleanedCount };
	},
});

export const deleteAccount = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error('Not authenticated');
		}

		try {
			// Get the user ID
			const userId = await getAuthUserId(ctx);
			console.log('Deleting account for user ID:', userId);

			if (!userId) {
				return { success: true, message: 'No user found to delete' };
			}

			// Verify user exists
			const user = await ctx.db.get(userId);
			if (!user) {
				return { success: true, message: 'User already deleted' };
			}

			// Step 1: Get all workspaces and memberships
			const [ownedWorkspaces, userMembers] = await Promise.all([
				ctx.db
					.query('workspaces')
					.withIndex('by_user_id', (q) => q.eq('userId', userId))
					.collect(),
				ctx.db
					.query('members')
					.withIndex('by_user_id', (q) => q.eq('userId', userId))
					.collect(),
			]);

			console.log(`Found ${ownedWorkspaces.length} owned workspaces, ${userMembers.length} memberships`);

			// Helper function to safely delete a document
			const safeDelete = async (id: any) => {
				try {
					await ctx.db.delete(id);
				} catch (error) {
					// Ignore "document doesn't exist" errors
					if (error instanceof Error && error.message.includes('nonexistent document')) {
						console.log(`Skipping delete of nonexistent document: ${id}`);
					} else {
						throw error;
					}
				}
			};

			// Step 2: Delete data from owned workspaces
			for (const workspace of ownedWorkspaces) {
				const workspaceId = workspace._id;
				console.log(`Deleting workspace: ${workspaceId}`);

				try {
					// Get all workspace-related data in parallel
					const [
						channels, 
						members, 
						conversations,
						categories,
						tasks,
						preferences,
						authConfigs,
						connectedAccounts,
						mcpServers,
						chatHistories
					] = await Promise.all([
						ctx.db.query('channels').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('members').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('conversations').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('categories').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('tasks').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('preferences').filter((q) => q.eq(q.field('lastActiveWorkspaceId'), workspaceId)).collect(),
						ctx.db.query('auth_configs').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('connected_accounts').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('mcp_servers').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('chatHistory').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
					]);

					// Delete all channels and their related data
					for (const channel of channels) {
						try {
							// Delete channel-related data
							const [messages, notes, lists] = await Promise.all([
								ctx.db.query('messages').withIndex('by_channel_id', (q) => q.eq('channelId', channel._id)).collect(),
								ctx.db.query('notes').withIndex('by_channel_id', (q) => q.eq('channelId', channel._id)).collect(),
								ctx.db.query('lists').withIndex('by_channel_id', (q) => q.eq('channelId', channel._id)).collect(),
							]);

							// Delete messages and their related data
							for (const message of messages) {
								const [reactions, events, mentions] = await Promise.all([
									ctx.db.query('reactions').withIndex('by_message_id', (q) => q.eq('messageId', message._id)).collect(),
									ctx.db.query('events').withIndex('by_message_id', (q) => q.eq('messageId', message._id)).collect(),
									ctx.db.query('mentions').withIndex('by_message_id', (q) => q.eq('messageId', message._id)).collect(),
								]);

								for (const reaction of reactions) await safeDelete(reaction._id);
								for (const event of events) await safeDelete(event._id);
								for (const mention of mentions) await safeDelete(mention._id);
								await safeDelete(message._id);
							}

							// Delete notes
							for (const note of notes) await safeDelete(note._id);

							// Delete lists and cards
							for (const list of lists) {
								const cards = await ctx.db.query('cards').withIndex('by_list_id', (q) => q.eq('listId', list._id)).collect();
								for (const card of cards) {
									const cardMentions = await ctx.db.query('mentions').withIndex('by_card_id', (q) => q.eq('cardId', card._id)).collect();
									for (const mention of cardMentions) await safeDelete(mention._id);
									await safeDelete(card._id);
								}
								await safeDelete(list._id);
							}

							await safeDelete(channel._id);
						} catch (error) {
							console.error(`Error deleting channel ${channel._id}:`, error);
							// Continue with other channels
						}
					}

					// Delete conversations and their messages
					for (const conversation of conversations) {
						try {
							const convMessages = await ctx.db.query('messages').withIndex('by_conversation_id', (q) => q.eq('conversationId', conversation._id)).collect();
							for (const message of convMessages) {
								const [reactions, directReads] = await Promise.all([
									ctx.db.query('reactions').withIndex('by_message_id', (q) => q.eq('messageId', message._id)).collect(),
									ctx.db.query('directReads').withIndex('by_message_id', (q) => q.eq('messageId', message._id)).collect(),
								]);
								for (const reaction of reactions) await safeDelete(reaction._id);
								for (const directRead of directReads) await safeDelete(directRead._id);
								await safeDelete(message._id);
							}
							await safeDelete(conversation._id);
						} catch (error) {
							console.error(`Error deleting conversation ${conversation._id}:`, error);
							// Continue with other conversations
						}
					}

					// Delete workspace-level data
					for (const member of members) {
						try {
							const [
								memberActivities,
								memberSessions,
								memberStats,
								memberHistory
							] = await Promise.all([
								ctx.db.query('userActivities').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
								ctx.db.query('channelSessions').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
								ctx.db.query('dailyStats').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
								ctx.db.query('history').filter((q) => q.eq(q.field('workspaceId'), workspaceId)).collect(),
							]);

							for (const activity of memberActivities) await safeDelete(activity._id);
							for (const session of memberSessions) await safeDelete(session._id);
							for (const stat of memberStats) await safeDelete(stat._id);
							for (const hist of memberHistory) await safeDelete(hist._id);
							
							await safeDelete(member._id);
						} catch (error) {
							console.error(`Error deleting member ${member._id}:`, error);
							// Continue with other members
						}
					}

					// Delete other workspace data
					for (const category of categories) await safeDelete(category._id);
					for (const task of tasks) await safeDelete(task._id);
					for (const chatHistory of chatHistories) await safeDelete(chatHistory._id);
					for (const authConfig of authConfigs) await safeDelete(authConfig._id);
					for (const connectedAccount of connectedAccounts) await safeDelete(connectedAccount._id);
					for (const mcpServer of mcpServers) await safeDelete(mcpServer._id);

					// Delete remaining workspace-level analytics
					const [workspaceActivities, workspaceStats] = await Promise.all([
						ctx.db.query('userActivities').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
						ctx.db.query('dailyStats').withIndex('by_workspace_id', (q) => q.eq('workspaceId', workspaceId)).collect(),
					]);
					for (const activity of workspaceActivities) await safeDelete(activity._id);
					for (const stat of workspaceStats) await safeDelete(stat._id);

					// Finally, delete the workspace
					await safeDelete(workspaceId);
				} catch (error) {
					console.error(`Error deleting workspace ${workspaceId}:`, error);
					// Continue with other workspaces
				}
			}

			// Step 3: Clean up user data from workspaces they're a member of
			for (const member of userMembers) {
				try {
					// Delete member-specific data
					const [
						memberMessages,
						memberReactions,
						memberMentions,
						memberNotes,
						memberActivities,
						memberSessions,
						memberDirectReads,
						memberChatHistories
					] = await Promise.all([
						ctx.db.query('messages').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
						ctx.db.query('reactions').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
						ctx.db.query('mentions').withIndex('by_mentioned_member_id', (q) => q.eq('mentionedMemberId', member._id)).collect(),
						ctx.db.query('notes').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
						ctx.db.query('userActivities').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
						ctx.db.query('channelSessions').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
						ctx.db.query('directReads').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
						ctx.db.query('chatHistory').withIndex('by_member_id', (q) => q.eq('memberId', member._id)).collect(),
					]);

					for (const message of memberMessages) await safeDelete(message._id);
					for (const reaction of memberReactions) await safeDelete(reaction._id);
					for (const mention of memberMentions) await safeDelete(mention._id);
					for (const note of memberNotes) await safeDelete(note._id);
					for (const activity of memberActivities) await safeDelete(activity._id);
					for (const session of memberSessions) await safeDelete(session._id);
					for (const directRead of memberDirectReads) await safeDelete(directRead._id);
					for (const chatHistory of memberChatHistories) await safeDelete(chatHistory._id);

					await safeDelete(member._id);
				} catch (error) {
					console.error(`Error deleting member ${member._id}:`, error);
					// Continue with other members
				}
			}

			// Step 4: Delete user-specific data
			const [userTasks, userCategories, userPreferences, userHistory] = await Promise.all([
				ctx.db.query('tasks').withIndex('by_user_id', (q) => q.eq('userId', userId)).collect(),
				ctx.db.query('categories').filter((q) => q.eq(q.field('userId'), userId)).collect(),
				ctx.db.query('preferences').withIndex('by_user_id', (q) => q.eq('userId', userId)).collect(),
				ctx.db.query('history').withIndex('by_user_id', (q) => q.eq('userId', userId)).collect(),
			]);

			for (const task of userTasks) await safeDelete(task._id);
			for (const category of userCategories) await safeDelete(category._id);
			for (const preference of userPreferences) await safeDelete(preference._id);
			for (const history of userHistory) await safeDelete(history._id);

			// Step 5: Delete the user account
			await safeDelete(userId);
			console.log('Account deletion completed successfully');

			return { success: true };
		} catch (error) {
			console.error('Error deleting account:', error);
			throw new Error(
				'Failed to delete account: ' +
					(error instanceof Error ? error.message : String(error))
			);
		}
	},
});
