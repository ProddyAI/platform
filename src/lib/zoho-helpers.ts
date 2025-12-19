/**
 * Helper functions for interacting with the Zoho SalesIQ API
 *
 * The Zoho SalesIQ chat widget is loaded from the Zoho script.
 */

/**
 * Shows and opens the Zoho SalesIQ chat widget
 * This allows the help button to toggle the chat widget
 * @returns {boolean} True if the operation was successful, false otherwise
 */
export const showZohoChat = (): boolean => {
	if (typeof window === 'undefined') return false;

	if (window.$zoho?.salesiq) {
		try {
			window.$zoho.salesiq.ready(() => {
				// Show the chat button
				if (window.$zoho?.salesiq?.floatbutton) {
					window.$zoho.salesiq.floatbutton.visible('show');
				}
				// Show/open the chat window
				if (window.$zoho?.salesiq?.floatwindow) {
					window.$zoho.salesiq.floatwindow.visible('show');
				}
			});
			return true;
		} catch (error) {
			console.error('Error showing Zoho chat:', error);
			return false;
		}
	}

	return false;
};

/**
 * Hides the Zoho SalesIQ chat window but keeps the button visible
 * @returns {boolean} True if the chat was successfully hidden, false otherwise
 */
export const hideZohoChat = (): boolean => {
	if (typeof window === 'undefined') return false;

	if (window.$zoho?.salesiq) {
		try {
			window.$zoho.salesiq.ready(() => {
				// Hide the chat window
				if (window.$zoho?.salesiq?.floatwindow) {
					window.$zoho.salesiq.floatwindow.visible('hide');
				}
			});
			return true;
		} catch (error) {
			console.error('Error hiding Zoho chat:', error);
			return false;
		}
	}

	return false;
};
