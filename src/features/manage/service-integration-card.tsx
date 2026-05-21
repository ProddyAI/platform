"use client";

import {
	CheckCircle2,
	CheckSquare,
	FileText,
	Loader2,
	Mail,
	RefreshCw,
	Ticket,
	Unlink,
	Wifi,
	WifiOff,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { FaGithub, FaSlack } from "react-icons/fa";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";

// Single source of truth for supported toolkits
type Toolkit = "github" | "gmail" | "slack" | "linear" | "notion" | "clickup";

type AuthConfig = {
	_id: Id<"auth_configs">;
	workspaceId: Id<"workspaces">;
	toolkit: Toolkit;
	name: string;
	type:
		| "use_composio_managed_auth"
		| "use_custom_auth"
		| "service_connection"
		| "no_auth";
	authScheme?: string;
	composioAuthConfigId: string;
	credentials?: any;
	isComposioManaged: boolean;
	isDisabled: boolean;
	createdAt: number;
	updatedAt: number;
	createdBy: Id<"members">;
};

type ConnectedAccount = {
	_id: Id<"connected_accounts">;
	workspaceId: Id<"workspaces">;
	authConfigId: Id<"auth_configs">;
	userId: string;
	composioAccountId: string;
	toolkit: string;
	status: "ACTIVE" | "PENDING" | "EXPIRED" | "ERROR" | "DISABLED";
	statusReason?: string;
	metadata?: any;
	testRequestEndpoint?: string;
	isDisabled: boolean;
	connectedAt: number;
	lastUsed?: number;
	connectedBy: Id<"members">;
};

type CurrentMember = {
	_id: Id<"members">;
	userId: string;
	role: "owner" | "admin" | "member" | "viewer";
};

interface ServiceIntegrationCardProps {
	workspaceId: Id<"workspaces">;
	toolkit: Toolkit;
	authConfig?: AuthConfig;
	connectedAccount?: ConnectedAccount;
	currentMember: CurrentMember;
	onConnectionChange?: () => void;
}

type ToolkitConfig = {
	icon: React.ComponentType<{ className?: string }>;
	/** Solid brand bg for the icon pill */
	iconBg: string;
	/** Gradient used on the top border strip when connected */
	connectedGradient: string;
	/** Tailwind class for the connect button */
	connectBtn: string;
	name: string;
	description: string;
	/** Short capability label shown under description */
	capability: string;
};

const toolkits: Record<Toolkit, ToolkitConfig> = {
	github: {
		icon: FaGithub,
		iconBg: "bg-[#24292e]",
		connectedGradient: "from-slate-700 to-slate-500",
		connectBtn: "bg-[#24292e] hover:bg-[#3a3f47] text-white",
		name: "GitHub",
		description: "Manage repos, issues & pull requests with AI",
		capability: "Repos · Issues · PRs",
	},
	gmail: {
		icon: Mail,
		iconBg: "bg-red-600",
		connectedGradient: "from-red-600 to-orange-500",
		connectBtn: "bg-red-600 hover:bg-red-700 text-white",
		name: "Gmail",
		description: "Send emails, read inbox & automate email workflows",
		capability: "Send · Read · Search",
	},
	slack: {
		icon: FaSlack,
		iconBg: "bg-[#4a154b]",
		connectedGradient: "from-[#4a154b] to-purple-500",
		connectBtn: "bg-[#4a154b] hover:bg-[#611f69] text-white",
		name: "Slack",
		description: "Send messages, manage channels & team notifications",
		capability: "Messages · Channels · Users",
	},
	linear: {
		icon: Ticket,
		iconBg: "bg-[#5e6ad2]",
		connectedGradient: "from-[#5e6ad2] to-indigo-400",
		connectBtn: "bg-[#5e6ad2] hover:bg-indigo-600 text-white",
		name: "Linear",
		description: "Track issues, manage projects & team sprints",
		capability: "Issues · Projects · Teams",
	},
	notion: {
		icon: FileText,
		iconBg: "bg-neutral-800",
		connectedGradient: "from-neutral-800 to-neutral-500",
		connectBtn: "bg-neutral-800 hover:bg-neutral-700 text-white",
		name: "Notion",
		description: "Create pages, query databases & manage workspace docs",
		capability: "Pages · Databases · Docs",
	},
	clickup: {
		icon: CheckSquare,
		iconBg: "bg-[#7b68ee]",
		connectedGradient: "from-[#7b68ee] to-pink-500",
		connectBtn: "bg-[#7b68ee] hover:bg-violet-600 text-white",
		name: "ClickUp",
		description: "Create tasks, track time & manage projects",
		capability: "Tasks · Time · Goals",
	},
};

/** Relative-time helper */
function timeAgo(ms: number): string {
	const diff = Date.now() - ms;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

export const ServiceIntegrationCard = ({
	workspaceId,
	toolkit,
	authConfig: _authConfig,
	connectedAccount,
	currentMember,
	onConnectionChange,
}: ServiceIntegrationCardProps) => {
	const [isConnecting, setIsConnecting] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const cfg = toolkits[toolkit];
	const IconComponent = cfg.icon;
	const isConnected = connectedAccount && connectedAccount.status === "ACTIVE";

	/* ──── AUTHORIZE ──────────────────────────────────────────── */
	const handleConnect = async () => {
		setIsConnecting(true);
		try {
			const response = await fetch("/api/assistant/composio/agentauth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "authorize",
					userId: `member_${currentMember._id}`,
					toolkit,
					workspaceId,
					memberId: currentMember._id,
				}),
			});

			if (!response.ok) {
				let details: { error?: string };
				try {
					details = (await response.json()) as { error?: string };
				} catch {
					details = { error: `HTTP ${response.status}` };
				}
				throw new Error(
					details?.error || `Failed to authorize (HTTP ${response.status})`
				);
			}

			const result = await response.json();
			if (!result.redirectUrl)
				throw new Error("No redirect URL from authorization");

			toast.success(`Redirecting to ${cfg.name} authorization…`);
			window.location.href = result.redirectUrl;
			// page navigates away — no need to reset isConnecting
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : `Failed to connect ${cfg.name}`
			);
			setIsConnecting(false);
		}
	};

	/* ──── DISCONNECT ─────────────────────────────────────────── */
	const handleDisconnect = async (): Promise<void> => {
		if (!connectedAccount) {
			toast.error("No connected account found");
			return;
		}
		setIsDisconnecting(true);
		try {
			const response = await fetch("/api/assistant/composio/agentauth", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId,
					connectedAccountId: connectedAccount._id,
					composioAccountId: connectedAccount.composioAccountId,
					memberId: currentMember._id,
				}),
			});
			if (!response.ok) {
				let errorMessage = "";
				try {
					const err = (await response.json()) as { error?: string };
					errorMessage = err.error ?? "";
				} catch {
					errorMessage = (await response.text()).trim();
				}
				throw new Error(
					errorMessage ||
						`Failed to disconnect (${response.status} ${response.statusText})`
				);
			}
			toast.success(`${cfg.name} disconnected`);
			onConnectionChange?.();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : `Failed to disconnect ${cfg.name}`
			);
		} finally {
			setIsDisconnecting(false);
		}
	};

	/* ──── REFRESH STATUS ─────────────────────────────────────── */
	const handleRefresh = async (): Promise<void> => {
		if (!connectedAccount?.composioAccountId) {
			toast.error("No account to refresh");
			return;
		}
		setIsRefreshing(true);
		try {
			const statusParams = new URLSearchParams({
				action: "check-status",
				composioAccountId: connectedAccount.composioAccountId,
				memberId: currentMember._id,
			});
			const res = await fetch(
				`/api/assistant/composio/agentauth?${statusParams}`
			);
			if (!res.ok) throw new Error("Status check failed");
			const status = await res.json();
			if (status.connected) {
				toast.success(`${cfg.name} connection is active`);
			} else {
				toast.warning(
					`${cfg.name} connection issue: ${status?.error || "unknown"}`
				);
			}
			onConnectionChange?.();
		} catch {
			toast.error(`Failed to refresh ${cfg.name} status`);
		} finally {
			setIsRefreshing(false);
		}
	};

	/* ──── RENDER ─────────────────────────────────────────────── */
	return (
		<Card
			className={`
				relative overflow-hidden border transition-all duration-200
				hover:shadow-md hover:-translate-y-0.5
				${
					isConnected
						? "border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent"
						: "border-border bg-card hover:border-primary/20"
				}
			`}
		>
			{/* ── Connected gradient top-bar ── */}
			{isConnected && (
				<div
					className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${cfg.connectedGradient}`}
				/>
			)}

			{/* ── Status badge ── */}
			<div className="absolute top-3 right-3 z-10">
				{isConnected ? (
					<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5 leading-5">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
						Active
					</span>
				) : (
					<span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-medium px-2.5 py-0.5 leading-5">
						<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
						Not connected
					</span>
				)}
			</div>

			{/* ── Header ── */}
			<CardHeader className="pb-2 pt-5 pr-24">
				<div className="flex items-center gap-3">
					{/* Icon pill */}
					<div
						className={`
							relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
							text-white shadow-sm ${cfg.iconBg}
						`}
					>
						<IconComponent className="h-5 w-5" />
						{isConnected && (
							<span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center">
								<CheckCircle2 className="h-2.5 w-2.5 text-white" />
							</span>
						)}
					</div>

					<div className="min-w-0">
						<p className="font-semibold text-sm text-foreground leading-tight">
							{cfg.name}
						</p>
						<p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
							{cfg.description}
						</p>
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-1 pb-4">
				{/* Capability pills */}
				<div className="flex flex-wrap gap-1 mb-4">
					{cfg.capability.split(" · ").map((cap) => (
						<span
							className="text-[10px] font-medium bg-muted text-muted-foreground rounded-md px-2 py-0.5 border border-border/60"
							key={cap}
						>
							{cap}
						</span>
					))}
				</div>

				{isConnected ? (
					/* ── Connected state ── */
					<div className="space-y-3">
						{/* Meta row */}
						<div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/60 rounded-lg px-3 py-2 border border-border/40">
							<span className="flex items-center gap-1.5">
								<Wifi className="h-3 w-3 text-emerald-500" />
								Connected
								{connectedAccount.connectedAt && (
									<span className="text-muted-foreground/70">
										· {timeAgo(connectedAccount.connectedAt)}
									</span>
								)}
							</span>
							{connectedAccount.lastUsed && (
								<span className="flex items-center gap-1">
									<Zap className="h-3 w-3" />
									Used {timeAgo(connectedAccount.lastUsed)}
								</span>
							)}
						</div>

						{/* Action buttons */}
						<div className="flex gap-2">
							<Button
								className="flex-1 h-8 text-xs font-medium border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors"
								disabled={isRefreshing || isDisconnecting}
								onClick={handleRefresh}
								size="sm"
								variant="outline"
							>
								{isRefreshing ? (
									<Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
								) : (
									<RefreshCw className="h-3.5 w-3.5 mr-1.5" />
								)}
								{isRefreshing ? "Checking…" : "Verify"}
							</Button>

							<Button
								className="flex-1 h-8 text-xs font-medium border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 transition-colors"
								disabled={isDisconnecting || isRefreshing}
								onClick={handleDisconnect}
								size="sm"
								variant="outline"
							>
								{isDisconnecting ? (
									<Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
								) : (
									<Unlink className="h-3.5 w-3.5 mr-1.5" />
								)}
								{isDisconnecting ? "Disconnecting…" : "Disconnect"}
							</Button>
						</div>
					</div>
				) : (
					/* ── Not connected state ── */
					<div className="space-y-2">
						<Button
							className={`w-full h-9 text-xs font-semibold rounded-lg transition-all duration-150 shadow-sm ${cfg.connectBtn}`}
							disabled={isConnecting}
							onClick={handleConnect}
							size="sm"
						>
							{isConnecting ? (
								<>
									<Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
									Redirecting…
								</>
							) : (
								<>
									<IconComponent className="h-3.5 w-3.5 mr-2" />
									Connect {cfg.name}
								</>
							)}
						</Button>

						<p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
							<WifiOff className="h-3 w-3" />
							Authorize once, use everywhere in Proddy AI
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
