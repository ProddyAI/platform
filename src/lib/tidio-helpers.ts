/**
 * Shows or refreshes the Tidio chat widget
 * 
 * This function ensures the Tidio chat widget is visible to the user. If the chat
 * is already open, it performs a refresh by briefly hiding and re-showing the widget
 * to ensure proper UI state. If the chat is closed, it opens the chat window.
 * 
 * **Runtime Dependency**: Requires `window.tidioChatApi` to be available (browser-only).
 * This function is a no-op on server-side (returns false when `window` is undefined).
 * 
 * **Error Handling**: Swallows any errors via try/catch and returns false on failure.
 * 
 * @returns {boolean} `true` if the Tidio API call succeeded, `false` otherwise
 * 
 * @example
 * ```tsx
 * // Call from browser-only code
 * import { showTidioChat } from '@/lib/tidio-helpers';
 * 
 * function ChatButton() {
 *   const handleClick = () => {
 *     const success = showTidioChat();
 *     if (!success) {
 *       console.warn('Tidio chat unavailable');
 *     }
 *   };
 *   
 *   return <button onClick={handleClick}>Open Chat</button>;
 * }
 * ```
 */
export const showTidioChat = (): boolean => {
	if (typeof window === "undefined") return false;
	if (!window.tidioChatApi) return false;

	try {
		window.tidioChatApi.show();
		const isOpen = window.tidioChatApi.isOpen();
		if (isOpen) {
			// Refresh the chat UI by briefly hiding and re-showing
			window.tidioChatApi.hide();
			setTimeout(() => window.tidioChatApi?.show(), 100);
		} else {
			window.tidioChatApi.open();
		}
		return true;
	} catch {
		return false;
	}
};

/**
 * Collapses the Tidio chat window while keeping the launcher button visible
 * 
 * This function hides the expanded chat window but ensures the chat launcher
 * button remains visible by scheduling a delayed show call. This creates a
 * "collapsed" state where users can still access the chat via the launcher.
 * 
 * **Note**: This function does NOT completely hide the Tidio widget. If you need
 * to fully remove the widget from view, use the Tidio API's visibility controls instead.
 * 
 * **Runtime Dependency**: Requires `window.tidioChatApi` to be available (browser-only).
 * This function is a no-op on server-side (returns false when `window` is undefined).
 * 
 * **Error Handling**: Swallows any errors via try/catch and returns false on failure.
 * 
 * @returns {boolean} `true` if the Tidio API calls succeeded, `false` otherwise
 * 
 * @example
 * ```tsx
 * // Call from browser-only code
 * import { collapseTidioChat } from '@/lib/tidio-helpers';
 * 
 * function CloseButton() {
 *   const handleClick = () => {
 *     const success = collapseTidioChat();
 *     if (!success) {
 *       console.warn('Tidio chat unavailable');
 *     }
 *   };
 *   
 *   return <button onClick={handleClick}>Collapse Chat</button>;
 * }
 * ```
 */
export const collapseTidioChat = (): boolean => {
	if (typeof window === "undefined") return false;
	if (!window.tidioChatApi) return false;

	try {
		// Hide the chat window but keep the launcher visible
		window.tidioChatApi.hide();
		setTimeout(() => {
			if (window.tidioChatApi) {
				// Re-show to ensure the launcher button remains visible
				window.tidioChatApi.show();
			}
		}, 100);
		return true;
	} catch {
		return false;
	}
};

/**
 * @deprecated Use `collapseTidioChat` instead for clarity
 * @see collapseTidioChat
 */
export const hideTidioChat = collapseTidioChat;
