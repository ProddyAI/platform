export const showTidioChat = (): boolean => {
	if (typeof window === "undefined") return false;
	if (!window.tidioChatApi) return false;

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
	} catch {
		return false;
	}
};

export const hideTidioChat = (): boolean => {
	if (typeof window === "undefined") return false;
	if (!window.tidioChatApi) return false;

	try {
		window.tidioChatApi.hide();
		setTimeout(() => {
			if (window.tidioChatApi) {
				window.tidioChatApi.show();
			}
		}, 100);
		return true;
	} catch {
		return false;
	}
};
