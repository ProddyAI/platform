"use client";

import { useAction, useMutation } from "convex/react";
import {
	Bell,
	BellOff,
	Calendar,
	Check,
	Loader2,
	Mail,
	MessageSquare,
	Send,
	Shield,
	UserCheck,
	UserPlus,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useNotificationPreferences } from "../api/use-user-preferences";

type WeeklyDigestDay =
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday";

type NotificationKey =
	| "mentions"
	| "assignee"
	| "threadReply"
	| "directMessage"
	| "inviteSent"
	| "workspaceJoin"
	| "onlineStatus";

export const NotificationSettings = () => {
	const { data: notifications, isLoading } = useNotificationPreferences();
	const [updatingKey, setUpdatingKey] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<
		"idle" | "saving" | "saved" | "error"
	>("idle");
	const [allNotificationsEnabled, setAllNotificationsEnabled] = useState(true);
	const [testPushState, setTestPushState] = useState<
		"idle" | "sending" | "sent" | "error"
	>("idle");
	const [permissionState, setPermissionState] = useState<
		"default" | "granted" | "denied"
	>("default");

	const updateSettings = useMutation(
		api.workspace.preferences.updateUserPreferences
	);
	const updateBrowserPrefs = useMutation(
		api.workspace.preferences.updateBrowserPrefs
	);
	const updateEmailPrefs = useMutation(
		api.workspace.preferences.updateEmailPrefs
	);
	const updateChannelToggle = useMutation(
		api.workspace.preferences.updateChannelToggle
	);
	const sendTestPush = useAction(
		api.notify.notifications.sendTestPushNotification
	);

	const browserPrefs = notifications?.notificationBrowserPrefs || {
		mentions: true,
		assignee: true,
		threadReply: true,
		directMessage: true,
		inviteSent: true,
		workspaceJoin: false,
		onlineStatus: true,
	};
	const emailPrefs = notifications?.notificationEmailPrefs || {
		mentions: true,
		assignee: true,
		threadReply: true,
		directMessage: true,
		inviteSent: true,
		workspaceJoin: true,
		onlineStatus: false,
	};
	const browserNotificationsEnabled =
		notifications?.browserNotificationsEnabled ?? true;
	const emailNotificationsEnabled =
		notifications?.emailNotificationsEnabled ?? true;
	const notificationSummaryMode =
		notifications?.notificationSummaryMode ?? "realtime";

	// Calculate if all notifications are enabled (browser channel)
	useEffect(() => {
		if (notifications) {
			const allEnabled =
				(notifications.browserNotificationsEnabled ?? true) &&
				(browserPrefs.mentions ?? true) &&
				(browserPrefs.assignee ?? true) &&
				(browserPrefs.threadReply ?? true) &&
				(browserPrefs.directMessage ?? true) &&
				(browserPrefs.inviteSent ?? true) &&
				(browserPrefs.workspaceJoin ?? false);
			setAllNotificationsEnabled(allEnabled);
		}
	}, [notifications, browserPrefs]);

	useEffect(() => {
		if (typeof Notification !== "undefined") {
			setPermissionState(Notification.permission);
		}
	}, []);

	const showSaved = () => {
		setSaveStatus("saved");
		window.setTimeout(() => setSaveStatus("idle"), 1200);
	};

	const withSaveState = async (key: string, callback: () => Promise<void>) => {
		setUpdatingKey(key);
		setSaveStatus("saving");
		try {
			await callback();
			showSaved();
		} catch (error) {
			console.error("Failed to save notification preferences", error);
			setSaveStatus("error");
			window.setTimeout(() => setSaveStatus("idle"), 2500);
		} finally {
			setUpdatingKey(null);
		}
	};

	const handleMasterToggle = async (enabled: boolean) => {
		await withSaveState("master", async () => {
			const updates = {
				mentions: enabled,
				assignee: enabled,
				threadReply: enabled,
				directMessage: enabled,
				inviteSent: enabled,
				workspaceJoin: enabled,
			};
			await updateBrowserPrefs({
				updates: updates as unknown as Record<NotificationKey, boolean>,
			});
		});
	};

	const handleBrowserToggle = async (type: string, enabled: boolean) => {
		await withSaveState(`browser-${type}`, async () => {
			await updateBrowserPrefs({
				updates: { [type]: enabled } as unknown as Record<
					NotificationKey,
					boolean
				>,
			});
		});
	};

	const handleEmailToggle = async (type: string, enabled: boolean) => {
		await withSaveState(`email-${type}`, async () => {
			await updateEmailPrefs({
				updates: { [type]: enabled } as unknown as Record<
					NotificationKey,
					boolean
				>,
			});
		});
	};

	const handleChannelToggle = async (
		channel: "browser" | "email",
		enabled: boolean
	) => {
		await withSaveState(`channel-${channel}`, async () => {
			await updateChannelToggle({ channel, enabled });
		});
	};

	const handleWeeklyDigestDayChange = async (day: string) => {
		await withSaveState("weeklyDigestDay", async () => {
			await updateSettings({
				settings: {
					notifications: {
						...notifications,
						weeklyDigestDay: day as WeeklyDigestDay,
					},
				},
			});
		});
	};

	const handleSummaryModeChange = async (mode: "realtime" | "batched30m") => {
		await withSaveState("summaryMode", async () => {
			await updateSettings({
				settings: {
					notifications: {
						...notifications,
						notificationSummaryMode: mode,
					},
				},
			});
		});
	};

	const handleTestPush = async () => {
		try {
			setTestPushState("sending");
			await window.OneSignal?.Notifications.requestPermission();
			// Refresh permission state after user grants/blocks permission
			if ("Notification" in window) {
				setPermissionState(
					(window.Notification?.permission as
						| "default"
						| "granted"
						| "denied") ?? "default"
				);
			}
			await (
				window.OneSignal as
					| { User?: { PushSubscription?: { optIn?: () => Promise<unknown> } } }
					| undefined
			)?.User?.PushSubscription?.optIn?.();
			await sendTestPush({});
			setTestPushState("sent");
			window.setTimeout(() => setTestPushState("idle"), 1500);
		} catch (error) {
			console.error("Failed to send test notification", error);
			setTestPushState("error");
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bell className="h-5 w-5" />
						Notification Settings
					</CardTitle>
					<CardDescription>
						Loading your notification preferences...
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	const notificationTypes = [
		{
			key: "mentions",
			title: "Mentions",
			description: "Get notified when someone mentions you in a message",
			icon: MessageSquare,
			browserEnabled: browserPrefs.mentions ?? true,
			emailEnabled: emailPrefs.mentions ?? false,
		},
		{
			key: "assignee",
			title: "Task Assignments",
			description: "Get notified when you are assigned to a task or card",
			icon: UserPlus,
			browserEnabled: browserPrefs.assignee ?? true,
			emailEnabled: emailPrefs.assignee ?? false,
		},
		{
			key: "threadReply",
			title: "Thread Replies",
			description:
				"Get notified when someone replies to a thread you participated in",
			icon: MessageSquare,
			browserEnabled: browserPrefs.threadReply ?? true,
			emailEnabled: emailPrefs.threadReply ?? false,
		},
		{
			key: "directMessage",
			title: "Direct Messages",
			description: "Get notified when you receive a direct message",
			icon: Mail,
			browserEnabled: browserPrefs.directMessage ?? true,
			emailEnabled: emailPrefs.directMessage ?? false,
		},
		{
			key: "inviteSent",
			title: "Invite Links",
			description: "Get notified when an invite link is sent to the workspace",
			icon: Mail,
			browserEnabled: browserPrefs.inviteSent ?? true,
			emailEnabled: emailPrefs.inviteSent ?? false,
		},
		{
			key: "workspaceJoin",
			title: "Workspace Joins",
			description:
				"Get notified when someone joins a workspace (if you are online)",
			icon: Users,
			browserEnabled: browserPrefs.workspaceJoin ?? false,
			emailEnabled: emailPrefs.workspaceJoin ?? false,
		},
	];

	const weeklyDigestEnabled = notifications?.weeklyDigest ?? false;
	const weeklyDigestDay = notifications?.weeklyDigestDay ?? "monday";

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bell className="h-5 w-5" />
						Notifications
					</CardTitle>
					<CardDescription>
						Control push permissions, delivery channels, and instant alerts.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Push permission + test */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<Label className="text-sm font-medium">Permission Status</Label>
							<Badge
								variant={
									permissionState === "granted"
										? "default"
										: permissionState === "denied"
											? "destructive"
											: "secondary"
								}
							>
								{permissionState === "granted"
									? "Allowed"
									: permissionState === "denied"
										? "Blocked"
										: "Not enabled"}
							</Badge>
						</div>
						<div className="flex items-center gap-3">
							<Button
								disabled={
									testPushState === "sending" || permissionState === "denied"
								}
								onClick={handleTestPush}
							>
								{testPushState === "sending" ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Sending...
									</>
								) : (
									<>
										<Send className="mr-2 h-4 w-4" />
										Send Test Notification
									</>
								)}
							</Button>
							{testPushState === "sent" && (
								<span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
									<Check className="h-4 w-4" />
									Sent
								</span>
							)}
							{testPushState === "error" && (
								<span className="text-sm text-destructive">
									Couldn't send. Try again.
								</span>
							)}
						</div>
						{permissionState === "denied" && (
							<p className="text-sm text-muted-foreground">
								Notifications are blocked for this site. Enable them in your
								browser's site settings, then reload the page.
							</p>
						)}
					</div>

					<Separator />

					{/* Delivery channels */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<Label
								className="text-sm font-medium"
								htmlFor="browser-notifications-toggle"
							>
								Browser Notifications
							</Label>
							<Switch
								checked={browserNotificationsEnabled}
								disabled={updatingKey === "channel-browser"}
								id="browser-notifications-toggle"
								onCheckedChange={(enabled) =>
									handleChannelToggle("browser", enabled)
								}
							/>
						</div>
						<div className="flex items-center justify-between">
							<Label
								className="text-sm font-medium"
								htmlFor="email-notifications-toggle"
							>
								Email Notifications
							</Label>
							<Switch
								checked={emailNotificationsEnabled}
								disabled={updatingKey === "channel-email"}
								id="email-notifications-toggle"
								onCheckedChange={(enabled) =>
									handleChannelToggle("email", enabled)
								}
							/>
						</div>
						{!browserNotificationsEnabled && (
							<Alert>
								<BellOff className="h-4 w-4" />
								<AlertDescription>
									Browser channel is off. Push notifications will not be
									delivered.
								</AlertDescription>
							</Alert>
						)}
					</div>

					<Separator />

					{/* All browser notifications (master toggle) */}
					<div className="space-y-4">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="space-y-1">
								<Label
									className="flex items-center gap-2 text-base font-medium"
									htmlFor="all-browser-notifications-toggle"
								>
									{allNotificationsEnabled ? (
										<Bell className="h-5 w-5 text-primary" />
									) : (
										<BellOff className="h-5 w-5 text-muted-foreground" />
									)}
									All Browser Notifications
								</Label>
								<p className="text-sm text-muted-foreground">
									{allNotificationsEnabled
										? "You will receive all instant notifications"
										: "All instant notifications are disabled"}
								</p>
							</div>
							<Switch
								checked={allNotificationsEnabled}
								disabled={
									updatingKey === "master" || !browserNotificationsEnabled
								}
								id="all-browser-notifications-toggle"
								onCheckedChange={handleMasterToggle}
							/>
						</div>

						{!allNotificationsEnabled && (
							<Alert>
								<BellOff className="h-4 w-4" />
								<AlertDescription>
									All instant notifications are currently disabled. You can
									still enable individual notifications below or use the toggle
									above.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Individual Notification Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bell className="h-5 w-5" />
						Individual Notification Settings
					</CardTitle>
					<CardDescription>
						Fine-tune which specific notifications you want to receive
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Individual notification toggles */}
					{notificationTypes.map((notification, index) => (
						<div key={notification.key}>
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<Label className="flex items-center gap-2 text-base font-medium">
										<notification.icon className="h-4 w-4" />
										{notification.title}
									</Label>
									<p className="text-sm text-muted-foreground">
										{notification.description}
									</p>
								</div>
								<div className="flex items-center gap-4">
									<div className="flex items-center gap-2">
										<Label
											className="text-xs text-muted-foreground"
											htmlFor={`browser-${notification.key}`}
										>
											Browser
										</Label>
										<Switch
											aria-label={`${notification.title} - Browser`}
											checked={notification.browserEnabled}
											disabled={
												updatingKey === `browser-${notification.key}` ||
												!browserNotificationsEnabled
											}
											id={`browser-${notification.key}`}
											onCheckedChange={(enabled) =>
												handleBrowserToggle(notification.key, enabled)
											}
										/>
									</div>
									<div className="flex items-center gap-2">
										<Label
											className="text-xs text-muted-foreground"
											htmlFor={`email-${notification.key}`}
										>
											Email
										</Label>
										<Switch
											aria-label={`${notification.title} - Email`}
											checked={notification.emailEnabled}
											disabled={
												updatingKey === `email-${notification.key}` ||
												!emailNotificationsEnabled
											}
											id={`email-${notification.key}`}
											onCheckedChange={(enabled) =>
												handleEmailToggle(notification.key, enabled)
											}
										/>
									</div>
								</div>
							</div>
							{index < notificationTypes.length - 1 && (
								<Separator className="mt-4" />
							)}
						</div>
					))}

					<Separator />

					{/* Online/Offline Status Notifications */}
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<Label
								className="flex items-center gap-2 text-base font-medium"
								htmlFor="online-status-toggle"
							>
								<UserCheck className="h-4 w-4" />
								Online/Offline Status
							</Label>
							<p className="text-sm text-muted-foreground">
								Get notified when team members go online or offline (excludes
								DND status changes)
							</p>
						</div>
						<Switch
							checked={browserPrefs.onlineStatus ?? true}
							disabled={
								updatingKey === "browser-onlineStatus" ||
								!browserNotificationsEnabled
							}
							id="online-status-toggle"
							onCheckedChange={(enabled) =>
								handleBrowserToggle("onlineStatus", enabled)
							}
						/>
					</div>

					<Separator />

					{/* Weekly Digest */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label
									className="flex items-center gap-2 text-base font-medium"
									htmlFor="weekly-digest-toggle"
								>
									<Calendar className="h-4 w-4" />
									Weekly Digest
								</Label>
								<p className="text-sm text-muted-foreground">
									Receive a weekly summary of workspace activity and reports
								</p>
							</div>
							<Switch
								checked={weeklyDigestEnabled}
								disabled={updatingKey === "weeklyDigest"}
								id="weekly-digest-toggle"
								onCheckedChange={(enabled) =>
									withSaveState("weeklyDigest", async () => {
										await updateSettings({
											settings: {
												notifications: {
													...notifications,
													weeklyDigest: enabled,
												},
											},
										});
									})
								}
							/>
						</div>

						{weeklyDigestEnabled && (
							<div className="ml-6 space-y-2">
								<Label
									className="text-sm font-medium"
									htmlFor="weekly-digest-day"
								>
									Delivery Day
								</Label>
								<Select
									disabled={updatingKey === "weeklyDigestDay"}
									onValueChange={handleWeeklyDigestDayChange}
									value={weeklyDigestDay}
								>
									<SelectTrigger className="w-48" id="weekly-digest-day">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="monday">Monday</SelectItem>
										<SelectItem value="tuesday">Tuesday</SelectItem>
										<SelectItem value="wednesday">Wednesday</SelectItem>
										<SelectItem value="thursday">Thursday</SelectItem>
										<SelectItem value="friday">Friday</SelectItem>
										<SelectItem value="saturday">Saturday</SelectItem>
										<SelectItem value="sunday">Sunday</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Choose which day of the week to receive your digest email
								</p>
							</div>
						)}
					</div>

					<Separator />

					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label
									className="text-base font-medium"
									htmlFor="notification-summary-mode"
								>
									Notification Timing
								</Label>
								<p className="text-sm text-muted-foreground">
									Choose between immediate delivery and batched summaries.
								</p>
							</div>
							<Select
								disabled={updatingKey === "summaryMode"}
								onValueChange={(value) =>
									handleSummaryModeChange(value as "realtime" | "batched30m")
								}
								value={notificationSummaryMode}
							>
								<SelectTrigger className="w-48" id="notification-summary-mode">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="realtime">Real-time</SelectItem>
									<SelectItem value="batched30m">Batched (30 min)</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<Separator />

					{/* Privacy Notice */}
					<Alert>
						<Shield className="h-4 w-4" />
						<AlertTitle>Email Notifications</AlertTitle>
						<AlertDescription>
							Enable email notifications above to receive instant emails and
							weekly digest updates. Unsubscribe links are included in all
							emails.
						</AlertDescription>
					</Alert>
					<div aria-live="polite" className="text-xs text-muted-foreground">
						{saveStatus === "saving" && (
							<span className="inline-flex items-center gap-1">
								<Loader2 className="h-3 w-3 animate-spin" />
								Saving...
							</span>
						)}
						{saveStatus === "saved" && (
							<span className="inline-flex items-center gap-1">
								<Check className="h-3 w-3" />
								Saved
							</span>
						)}
						{saveStatus === "error" && (
							<span className="text-destructive">
								Couldn't save. Try again.
							</span>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
