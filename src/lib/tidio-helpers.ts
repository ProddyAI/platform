export const showTidioChat = (): boolean => {
	if (typeof window === 'undefined') return false;

	if (window.tidioChatApi) {
		try {
			window.tidioChatApi.show();

			const isOpen = window.tidioChatApi.isOpen();

			if (isOpen) {
				window.tidioChatApi.hide();
				setTimeout(() => window.tidioChatApi?.show(), 100);
			} else {
				window.tidioChatApi.open();
			}
			return true;
		} catch (error) {
			console.error('Error toggling Tidio chat:', error);
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
