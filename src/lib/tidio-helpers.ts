/**
 * Helper functions for interacting with the Tidio Chat API
 *
 * The Tidio Chat API is loaded from the script with the public key
 * stored in the NEXT_PUBLIC_TIDIO_PUBLIC_KEY environment variable.
 */

/**
 * Shows and opens the Tidio chat widget if it's hidden, or hides it if it's already visible
 * This allows the help button to toggle the chat widget
 * @returns {boolean} True if the operation was successful, false otherwise
 */
export const showTidioChat = (): boolean => {
	if (typeof window === 'undefined') return false;

	if (window.tidioChatApi) {
		try {
			// First, always make sure the widget is shown (the icon is visible)
			window.tidioChatApi.show();

			// Then check if the chat window is open
			const isOpen = window.tidioChatApi.isOpen();

			if (isOpen) {
				// If chat window is open, close it (but keep the icon visible)
				window.tidioChatApi.hide();
				// And then show it again to ensure the icon remains visible
				setTimeout(() => window.tidioChatApi?.show(), 100);
			} else {
				// If chat window is closed, open it
				window.tidioChatApi.open();
			}
			return true;
		} catch (error) {
			console.error('Error toggling Tidio chat:', error);
			// Fallback approach - just try to show and open
			try {
				window.tidioChatApi.show();
				window.tidioChatApi.open();
				return true;
			} catch (e) {
				return false;
			}
		}
	}

	return false;
};

/**
 * Hides the Tidio chat window but keeps the icon visible
 * @returns {boolean} True if the chat was successfully hidden, false otherwise
 */
export const hideTidioChat = (): boolean => {
	if (typeof window === 'undefined') return false;

	if (window.tidioChatApi) {
		try {
			// First hide the chat window
			window.tidioChatApi.hide();

			// Then make sure the icon is still visible
			setTimeout(() => {
				if (window.tidioChatApi) {
					window.tidioChatApi.show();
				}
			}, 100);

			return true;
		} catch (error) {
			console.error('Error hiding Tidio chat:', error);
			return false;
		}
	}

	return false;
};
