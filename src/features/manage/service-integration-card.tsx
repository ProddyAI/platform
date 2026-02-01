"use client";

import {
	Check,
	CheckSquare,
	FileText,
	Loader,
	Mail,
	RefreshCw,
	Ticket,
	Unlink,
} from "lucide-react";
import { useState } from "react";
import { FaGithub, FaSlack } from "react-icons/fa";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../../components/ui/card";

type AuthConfig = {
	_id: Id<"auth_configs">;
	workspaceId: Id<"workspaces">;
	toolkit: "github" | "gmail" | "slack" | "jira" | "notion" | "clickup";
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
	role: "owner" | "admin" | "member";
};

interface ServiceIntegrationCardProps {
	workspaceId: Id<"workspaces">;
	toolkit: "github" | "gmail" | "slack" | "linear" | "notion" | "clickup";
	authConfig?: AuthConfig;
	connectedAccount?: ConnectedAccount;
	currentMember: CurrentMember;
	onConnectionChange?: () => void;
}

const toolkits = {
	github: {
		icon: FaGithub,
		color: "bg-slate-700 hover:bg-slate-600",
		name: "GitHub",
		description:
			"Connect to GitHub for repository management and issue tracking with AgentAuth",
	},
	gmail: {
		icon: Mail,
		color: "bg-red-600 hover:bg-red-700",
		name: "Gmail",
		description:
			"Connect to Gmail for email management and automation with AgentAuth",
	},
	slack: {
		icon: FaSlack,
		color: "bg-purple-600 hover:bg-purple-700",
		name: "Slack",
		description:
			"Connect to Slack for team communication and notifications with AgentAuth",
	},
	linear: {
		icon: Ticket,
		color: "bg-blue-600 hover:bg-blue-700",
		name: "Linear",
		description:
			"Connect to Linear for issue tracking and project management with AgentAuth",
	},
	notion: {
		icon: FileText,
		color: "bg-zinc-700 hover:bg-zinc-600",
		name: "Notion",
		description:
			"Connect to Notion for document management and collaboration with AgentAuth",
	},
	clickup: {
		icon: CheckSquare,
		color: "bg-pink-600 hover:bg-pink-700",
		name: "ClickUp",
		description:
			"Connect to ClickUp for task management and productivity with AgentAuth",
	},
};

export const ServiceIntegrationCard = ({
	workspaceId,
	toolkit,
	authConfig,
	connectedAccount,
	currentMember,
	onConnectionChange,
}: ServiceIntegrationCardProps) => {
	const [isConnecting, setIsConnecting] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [_connectionStatus, setConnectionStatus] = useState<{
		connected: boolean;
		connectionId?: string;
		status?: string;
		error?: string;
	}>({ connected: !!connectedAccount && connectedAccount.status === "ACTIVE" });

	// Component state and derived values

	const IconComponent = toolkits[toolkit].icon;
	const isConnected = connectedAccount && connectedAccount.status === "ACTIVE";
	const hasAuthConfig = !!authConfig;

	const handleCreateAuthConfig = async () => {
		setIsConnecting(true);

		try {
			console.log(`[ServiceCard] Starting authorization for ${toolkit}:`, {
				workspaceId,
				memberId: currentMember._id,
				userId: `member_${currentMember._id}`,
			});

			// Use AgentAuth to authorize user to toolkit with member-specific entity ID
			const response = await fetch("/api/composio/agentauth", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					action: "authorize",
					userId: `member_${currentMember._id}`, // Use member entity ID for user-specific auth
					toolkit,
					workspaceId,
					memberId: currentMember._id,
				}),
			});

			console.log(`[ServiceCard] API response status:`, response.status);

			if (!response.ok) {
				let errorDetails;
				try {
					errorDetails = await response.json();
					console.error(`[ServiceCard] API error response:`, errorDetails);
				} catch (_parseError) {
					const errorText = await response.text();
					console.error(
						`[ServiceCard] Failed to parse error response:`,
						errorText
					);
					errorDetails = { error: errorText || `HTTP ${response.status}` };
				}
				throw new Error(
					errorDetails.error ||
						`Failed to authorize toolkit (HTTP ${response.status})`
				);
			}

			const result = await response.json();
			console.log(`[ServiceCard] Authorization successful:`, {
				hasRedirectUrl: !!result.redirectUrl,
				connectionId: result.connectionId,
			});

			if (!result.redirectUrl) {
				console.error(`[ServiceCard] No redirect URL in response:`, result);
				throw new Error("No redirect URL received from authorization");
			}

			// Redirect to service OAuth (AgentAuth handles the full flow)
			window.location.href = result.redirectUrl;
		} catch (error) {
			console.error(`[ServiceCard] Error authorizing ${toolkit}:`, error);
			console.error(`[ServiceCard] Error details:`, {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			});
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to authorize ${toolkits[toolkit].name}`
			);
			setIsConnecting(false);
		}
	};

	const _handleConnect = async () => {
		await handleCreateAuthConfig();
	};

	const handleDisconnect = async () => {
		if (!connectedAccount) {
			toast.error("No connected account found");
			return;
		}

		console.log(`[ServiceCard] Disconnecting ${toolkit}:`, {
			connectedAccountId: connectedAccount._id,
			composioAccountId: connectedAccount.composioAccountId,
			memberId: currentMember._id,
			workspaceId,
		});

		setIsDisconnecting(true);

		try {
			// Call AgentAuth API to disconnect the account with member-specific entity ID
			const response = await fetch("/api/composio/agentauth", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					workspaceId,
					connectedAccountId: connectedAccount._id,
					composioAccountId: connectedAccount.composioAccountId,
					memberId: currentMember._id, // Pass memberId for user-specific deletion
				}),
			});

			console.log(`[ServiceCard] Disconnect response status:`, response.status);

			if (!response.ok) {
				const error = await response.json();
				console.error(`[ServiceCard] Disconnect failed:`, error);
				throw new Error(error.error || "Failed to disconnect account");
			}

			const result = await response.json();
			console.log(`[ServiceCard] Disconnect successful:`, result);

			toast.success(`${toolkits[toolkit].name} disconnected successfully`);
			onConnectionChange?.();
		} catch (error) {
			console.error(`[ServiceCard] Error disconnecting ${toolkit}:`, error);
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to disconnect ${toolkits[toolkit].name}`
			);
		} finally {
			setIsDisconnecting(false);
		}
	};

	const handleRefresh = async () => {
		if (!connectedAccount?.composioAccountId) {
			toast.error("No connected account to refresh");
			return;
		}

		setIsConnecting(true);

		try {
			// Call AgentAuth API to check connection status
			const response = await fetch(
				`/api/composio/agentauth?action=check-status&composioAccountId=${connectedAccount.composioAccountId}&memberId=${currentMember._id}`,
				{
					method: "GET",
				}
			);

			if (!response.ok) {
				throw new Error("Failed to refresh connection status");
			}

			const status = await response.json();
			setConnectionStatus(status);

			if (status.connected) {
				toast.success(`${toolkits[toolkit].name} connection is active`);
			} else {
				toast.warning(
					`${toolkits[toolkit].name} connection is not active. ${status.error || ""}`
				);
			}

			// Refresh the integrations list
			onConnectionChange?.();
		} catch (error) {
			console.error(`Error refreshing ${toolkit} connection:`, error);
			toast.error(`Failed to refresh ${toolkits[toolkit].name} status`);
		} finally {
			setIsConnecting(false);
		}
	};

	return (
		<Card className="relative overflow-hidden">
			{/* Connected badge as overlay */}
			{isConnected && (
				<div className="absolute top-3 right-3 z-10">
					<div className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full shadow-sm">
						<Check className="h-3 w-3" />
						<span className="font-medium">Connected</span>
					</div>
				</div>
			)}

			<CardHeader className="pb-3 pr-20">
				<div className="flex items-center gap-3">
					<div
						className={`p-2 rounded-lg text-white ${toolkits[toolkit].color}`}
					>
						<IconComponent className="h-5 w-5" />
					</div>
					<div>
						<CardTitle className="text-lg">{toolkits[toolkit].name}</CardTitle>
						<CardDescription className="text-sm">
							{toolkits[toolkit].description}
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{isConnected ? (
					<div className="space-y-3">
						{connectedAccount.lastUsed && (
							<div className="text-sm text-muted-foreground">
								Last used:{" "}
								{new Date(connectedAccount.lastUsed).toLocaleDateString()}
							</div>
						)}

						<div className="flex gap-2">
							<Button
								className="bg-blue-100 border-blue-200 text-blue-700 hover:bg-blue-200 hover:border-blue-300"
								disabled={isConnecting}
								onClick={handleRefresh}
								size="sm"
								variant="outline"
							>
								{isConnecting ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										Refreshing...
									</>
								) : (
									<>
										<RefreshCw className="mr-2 h-4 w-4" />
										Refresh
									</>
								)}
							</Button>

							<Button
								className="bg-red-100 border-red-200 text-red-700 hover:bg-red-200 hover:border-red-300"
								disabled={isDisconnecting}
								onClick={handleDisconnect}
								size="sm"
								variant="outline"
							>
								{isDisconnecting ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										Disconnecting...
									</>
								) : (
									<>
										<Unlink className="mr-2 h-4 w-4" />
										Disconnect
									</>
								)}
							</Button>
						</div>
					</div>
				) : (
					<div className="space-y-3">
						<Button
							className={`w-full ${toolkits[toolkit].color} text-white`}
							disabled={isConnecting}
							onClick={handleCreateAuthConfig}
						>
							{isConnecting ? (
								<>
									<Loader className="mr-2 h-4 w-4 animate-spin" />
									Connecting with AgentAuth...
								</>
							) : (
								<>
									<IconComponent className="mr-2 h-4 w-4" />
									Connect {toolkits[toolkit].name}
								</>
							)}
						</Button>
					</div>
				)}
			</CardContent>

			{/* Subtle connection status indicator - only show for non-connected states */}
			{!isConnected && (
				<div
					className={`absolute bottom-3 right-3 w-2 h-2 rounded-full ${
						hasAuthConfig ? "bg-yellow-400" : "bg-gray-300"
					}`}
				/>
			)}
		</Card>
	);
};
