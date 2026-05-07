// Components
export { CompactMessage } from "./components/compact-message";
export { FullMessage } from "./components/full-message";
export { MessageContent } from "./components/message-content";
export { MessageContextMenu } from "./components/message-context-menu";
export { TaskCreationModal } from "./components/task-creation-modal";

// Contexts
export {
	ContextMenuProvider,
	useContextMenu,
} from "./contexts/context-menu-context";

// Hooks
export { useMessageActions } from "./hooks/use-message-actions";

// Types
export type {
	ContextMenuState,
	MessageProps,
	TaskModalState,
} from "./types/message";

// Utils
export { extractTextFromBody, formatFullTime } from "./utils/message-utils";
