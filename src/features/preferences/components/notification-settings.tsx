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
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
	const [isUpdating, setIsUpdating] = useState(false);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
		"idle"
	);
	const [allNotificationsEnabled, setAllNotificationsEnabled] = useState(true);
	const [testPushState, setTestPushState] = useState<
		"idle" | "sending" | "sent" | "error"
	>("idle");
	const [permissionState, setPermissionState] = useState<
		"default" | "granted" | "denied"
	>("default");

	const updateSettings = useMutation(api.preferences.updateUserPreferences);
	const updateBrowserPrefs = useMutation(
		api.preferences.updateBrowserPrefs
	);
	const updateEmailPrefs = useMutation(
		api.preferences.updateEmailPrefs
	);
	const updateChannelToggle = useMutation(
		api.preferences.updateChannelToggle
	);
	const sendTestPush = useAction(
		api.notifications.sendTestPushNotification
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

	const withSaveState = async (callback: () => Promise<void>) => {
		setIsUpdating(true);
		setSaveStatus("saving");
		try {
			await callback();
			showSaved();
			toast.success("Notification preferences saved");
		} catch (error) {
			console.error("Failed to save notification preferences", error);
			toast.error("Failed to save notification preferences");
			setSaveStatus("idle");
		} finally {
			setIsUpdating(false);
		}
	};

	const handleMasterToggle = async (enabled: boolean) => {
		await withSaveState(async () => {
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
		await withSaveState(async () => {
			await updateBrowserPrefs({
				updates: { [type]: enabled } as unknown as Record<NotificationKey, boolean>,
			});
		});
	};

	const handleEmailToggle = async (type: string, enabled: boolean) => {
		await withSaveState(async () => {
			await updateEmailPrefs({
				updates: { [type]: enabled } as unknown as Record<NotificationKey, boolean>,
			});
		});
	};

	const handleChannelToggle = async (
		channel: "browser" | "email",
		enabled: boolean
	) => {
		await withSaveState(async () => {
			await updateChannelToggle({ channel, enabled });
		});
	};

	const handleWeeklyDigestDayChange = async (day: string) => {
		await withSaveState(async () => {
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
		await withSaveState(async () => {
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
					(window.Notification?.permission as "default" | "granted" | "denied") ??
						"default"
				);
			}
			await (window as any).OneSignal?.User?.PushSubscription?.optIn?.();
			await sendTestPush({});
			setTestPushState("sent");
			toast.success("Test notification sent");
			window.setTimeout(() => setTestPushState("idle"), 1500);
		} catch (error) {
			console.error("Failed to send test notification", error);
			setTestPushState("error");
			toast.error("Failed to send test notification");
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
			enabled: notifications?.mentions ?? true,
			browserEnabled: browserPrefs.mentions ?? true,
			emailEnabled: emailPrefs.mentions ?? false,
		},
		{
			key: "assignee",
			title: "Task Assignments",
			description: "Get notified when you are assigned to a task or card",
			icon: UserPlus,
			enabled: notifications?.assignee ?? true,
			browserEnabled: browserPrefs.assignee ?? true,
			emailEnabled: emailPrefs.assignee ?? false,
		},
		{
			key: "threadReply",
			title: "Thread Replies",
			description:
				"Get notified when someone replies to a thread you participated in",
			icon: MessageSquare,
			enabled: notifications?.threadReply ?? true,
			browserEnabled: browserPrefs.threadReply ?? true,
			emailEnabled: emailPrefs.threadReply ?? false,
		},
		{
			key: "directMessage",
			title: "Direct Messages",
			description: "Get notified when you receive a direct message",
			icon: Mail,
			enabled: notifications?.directMessage ?? true,
			browserEnabled: browserPrefs.directMessage ?? true,
			emailEnabled: emailPrefs.directMessage ?? false,
		},
		{
			key: "inviteSent",
			title: "Invite Links",
			description: "Get notified when an invite link is sent to the workspace",
			icon: Mail,
			enabled: notifications?.inviteSent ?? true,
			browserEnabled: browserPrefs.inviteSent ?? true,
			emailEnabled: emailPrefs.inviteSent ?? false,
		},
		{
			key: "workspaceJoin",
			title: "Workspace Joins",
			description:
				"Get notified when someone joins a workspace (if you are online)",
			icon: Users,
			enabled: notifications?.workspaceJoin ?? true,
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
						Browser Push Notifications
					</CardTitle>
					<CardDescription>
						Check permission status and send a test push notification.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
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
							disabled={testPushState === "sending"}
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
							<span className="text-sm text-green-600">Success ✅</span>
						)}
						{testPushState === "error" && (
							<span className="text-sm text-red-600">Error ❌</span>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Mail className="h-5 w-5" />
						Delivery Channels
					</CardTitle>
					<CardDescription>
						Control where notifications are delivered.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<Label className="text-sm font-medium">Browser Notifications</Label>
						<Switch
							checked={browserNotificationsEnabled}
							disabled={isUpdating}
							onCheckedChange={(enabled) =>
								handleChannelToggle("browser", enabled)
							}
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label className="text-sm font-medium">Email Notifications</Label>
						<Switch
							checked={emailNotificationsEnabled}
							disabled={isUpdating}
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
				</CardContent>
			</Card>

			{/* Master Notification Toggle */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						{allNotificationsEnabled ? (
							<Volume2 className="h-5 w-5 text-green-600" />
						) : (
							<VolumeX className="h-5 w-5 text-red-600" />
						)}
						Master Notification Control
					</CardTitle>
					<CardDescription>
						Quickly enable or disable all instant notifications at once
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10">
						<div className="space-y-1">
							<Label className="flex items-center gap-2 text-base font-medium">
								{allNotificationsEnabled ? (
									<Bell className="h-5 w-5 text-green-600" />
								) : (
									<BellOff className="h-5 w-5 text-red-600" />
								)}
								All Notifications
							</Label>
							<p className="text-sm text-muted-foreground">
								{allNotificationsEnabled
									? "You will receive all instant notifications"
									: "All instant notifications are disabled"}
							</p>
						</div>
						<Switch
							checked={allNotificationsEnabled}
							className="data-[state=checked]:bg-green-600"
							disabled={isUpdating || !browserNotificationsEnabled}
							onCheckedChange={handleMasterToggle}
						/>
					</div>

					{!allNotificationsEnabled && (
						<Alert className="mt-4">
							<BellOff className="h-4 w-4" />
							<AlertDescription>
								All instant notifications are currently disabled. You can still
								enable individual notifications below or use the master toggle
								above.
							</AlertDescription>
						</Alert>
					)}
					<div className="mt-3 text-xs text-muted-foreground">
						{saveStatus === "saving" && "Saving..."}
						{saveStatus === "saved" && "Saved ✅"}
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
										<Label className="text-xs text-muted-foreground">
											Browser
										</Label>
										<Switch
											checked={notification.browserEnabled}
											disabled={isUpdating || !browserNotificationsEnabled}
											onCheckedChange={(enabled) =>
												handleBrowserToggle(notification.key, enabled)
											}
										/>
									</div>
									<div className="flex items-center gap-2">
										<Label className="text-xs text-muted-foreground">
											Email
										</Label>
										<Switch
											checked={notification.emailEnabled}
											disabled={isUpdating || !emailNotificationsEnabled}
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
							<Label className="flex items-center gap-2 text-base font-medium">
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
							disabled={isUpdating || !browserNotificationsEnabled}
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
								<Label className="flex items-center gap-2 text-base font-medium">
									<Calendar className="h-4 w-4" />
									Weekly Digest
								</Label>
								<p className="text-sm text-muted-foreground">
									Receive a weekly summary of workspace activity and reports
								</p>
							</div>
							<Switch
								checked={weeklyDigestEnabled}
								disabled={isUpdating}
								onCheckedChange={(enabled) =>
									withSaveState(async () => {
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
								<Label className="text-sm font-medium">Delivery Day</Label>
								<Select
									disabled={isUpdating}
									onValueChange={handleWeeklyDigestDayChange}
									value={weeklyDigestDay}
								>
									<SelectTrigger className="w-48">
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
								<Label className="text-base font-medium">
									Notification Timing
								</Label>
								<p className="text-sm text-muted-foreground">
									Choose between immediate delivery and batched summaries.
								</p>
							</div>
							<Select
								disabled={isUpdating}
								onValueChange={(value) =>
									handleSummaryModeChange(value as "realtime" | "batched30m")
								}
								value={notificationSummaryMode}
							>
								<SelectTrigger className="w-48">
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
					<div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
						<div className="flex items-start gap-3">
							<Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
							<div className="space-y-1">
								<h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
									Email Notifications
								</h4>
								<p className="text-sm text-blue-700 dark:text-blue-300">
									Enable email notifications above to receive instant emails and
									weekly digest updates. Unsubscribe links are included in all
									emails.
								</p>
							</div>
						</div>
					</div>
					<div className="text-xs text-muted-foreground">
						{saveStatus === "saving" && (
							<span className="inline-flex items-center gap-1">
								<Loader2 className="h-3 w-3 animate-spin" />
								Saving...
							</span>
						)}
						{saveStatus === "saved" && (
							<span className="inline-flex items-center gap-1 text-green-600">
								<Check className="h-3 w-3" />
								Saved ✅
							</span>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
