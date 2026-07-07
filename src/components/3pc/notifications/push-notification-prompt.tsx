"use client";

import { AlertTriangle, Bell, BellOff, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdBlockerDetectionContext } from "@/components/providers/ad-blocker-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { logger } from "@/lib/logger";

export type PushNotificationPromptProps = Record<string, never>;

export const PushNotificationPrompt = (_props: PushNotificationPromptProps) => {
	const [permission, setPermission] =
		useState<NotificationPermission>("default");
	const [isSupported, setIsSupported] = useState(false);
	const [isRequesting, setIsRequesting] = useState(false);
	const { isAdBlockerActive } = useAdBlockerDetectionContext();

	useEffect(() => {
		// Check if notifications are supported
		if (typeof window !== "undefined" && "Notification" in window) {
			setIsSupported(true);
			setPermission(Notification.permission);
		}
	}, []);

	const requestPermission = async () => {
		if (!isSupported) return;

		setIsRequesting(true);
		try {
			// Use OneSignal's requestPermission if available
			if (window.OneSignal) {
				await window.OneSignal.Notifications.requestPermission();
				// Read permission state after request instead of awaiting it
				const newPermission = Notification.permission;
				setPermission(newPermission);
			} else {
				// Fallback to native browser notification API
				const result = await Notification.requestPermission();
				setPermission(result);
			}
		} catch (error) {
			logger.error("Error requesting notification permission:", error);
		} finally {
			setIsRequesting(false);
		}
	};

	if (!isSupported) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{permission === "granted" ? (
						<Bell className="h-5 w-5 text-primary" />
					) : (
						<BellOff className="h-5 w-5 text-muted-foreground" />
					)}
					Browser Push Notifications
				</CardTitle>
				<CardDescription>
					Enable push notifications to receive real-time alerts in your browser
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Ad Blocker Warning */}
				{isAdBlockerActive && (
					<Alert className="border-destructive/20 bg-destructive/10">
						<AlertTriangle className="h-4 w-4 text-destructive" />
						<AlertDescription className="text-destructive">
							Notifications may be blocked by your browser or network settings
						</AlertDescription>
					</Alert>
				)}

				{permission === "granted" ? (
					<Alert className="border-primary/20 bg-primary/10">
						<CheckCircle2 className="h-4 w-4 text-primary" />
						<AlertDescription className="text-foreground">
							Push notifications are enabled. You&apos;ll receive real-time
							alerts based on your notification preferences below.
						</AlertDescription>
					</Alert>
				) : permission === "denied" ? (
					<Alert className="border-destructive/20 bg-destructive/10">
						<BellOff className="h-4 w-4 text-destructive" />
						<AlertDescription className="text-destructive">
							Push notifications are blocked. To enable them, please update your
							browser settings and allow notifications for this site.
						</AlertDescription>
					</Alert>
				) : (
					<>
						<p className="text-sm text-muted-foreground">
							Allow push notifications to stay updated with mentions, direct
							messages, task assignments, and workspace activity in real-time -
							even when you&apos;re not actively using the app.
						</p>
						<Button
							className="w-full"
							disabled={isRequesting || isAdBlockerActive}
							onClick={requestPermission}
							size="lg"
						>
							<Bell className="h-4 w-4 mr-2" />
							{isRequesting ? "Requesting..." : "Enable Push Notifications"}
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
};
