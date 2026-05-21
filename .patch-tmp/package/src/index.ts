/**
 * DatabaseChat React hooks and components.
 *
 * Import from here for all React-related functionality:
 *
 * ```tsx
 * import {
 *   DatabaseChatProvider,
 *   useDatabaseChat,
 *   useConversations,
 * } from "@dayhaysoos/convex-database-chat";
 * ```
 */

export {
	// Types
	type DatabaseChatApi,
	// Provider
	DatabaseChatProvider,
	type DatabaseChatProviderProps,
	type Message,
	// Components
	SmoothText,
	type SmoothTextProps,
	type StreamDelta,
	type StreamPart,
	type StreamState,
	type UseConversationsOptions,
	type UseConversationsReturn,
	type UseDatabaseChatOptions,
	type UseDatabaseChatReturn,
	type UseSmoothTextOptions,
	useConversations,
	// Hooks
	useDatabaseChat,
	useMessagesWithStreaming,
	useSmoothText,
	useStreamingContent,
} from "./react";
