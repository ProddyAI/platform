// Global type declarations

// OneSignal type declarations
interface OneSignalNotifications {
	requestPermission(): Promise<void>;
	permission: boolean;
}

interface OneSignalInterface {
	Notifications: OneSignalNotifications;
	init(config: {
		appId: string;
		serviceWorkerPath?: string;
		serviceWorkerParam?: { scope: string };
	}): Promise<void>;
	login(externalId: string): Promise<void>;
	logout(): Promise<void>;
}

type OneSignalDeferredCallback = (
	OneSignal: OneSignalInterface
) => void | Promise<void>;

interface Window {
	OneSignal?: OneSignalInterface;
	OneSignalDeferred?: Array<OneSignalDeferredCallback>;
}
