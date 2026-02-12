// Global type declarations

// OneSignal type declarations
interface OneSignalNotifications {
	requestPermission(): Promise<void>;
	permission: boolean;
}

interface OneSignalInterface {
	Notifications: OneSignalNotifications;
}

interface Window {
	OneSignal?: OneSignalInterface;
}
