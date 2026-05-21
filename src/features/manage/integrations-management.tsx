"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { ServiceIntegrationCard } from "./service-integration-card";

type CurrentMember = {
	_id: Id<"members">;
	userId: string;
	role: "owner" | "admin" | "member";
};

interface IntegrationsManagementProps {
	workspaceId: Id<"workspaces">;
	currentMember: CurrentMember;
}

const SUPPORTED_TOOLKITS = [
	"github",
	"gmail",
	"slack",
	"linear",
	"notion",
	"clickup",
] as const;

// Loading card component - matches the new ServiceIntegrationCard layout
const LoadingCard = () => {
	return (
		<Card className="relative overflow-hidden border border-border animate-pulse">
			{/* Badge placeholder */}
			<div className="absolute top-3 right-3">
				<Skeleton className="h-5 w-24 rounded-full" />
			</div>

			<CardHeader className="pb-2 pt-5 pr-24">
				<div className="flex items-center gap-3">
					<Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
					<div className="space-y-1.5 flex-1 min-w-0">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-3 w-40" />
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-1 pb-4 space-y-3">
				{/* Capability pills */}
				<div className="flex gap-1">
					<Skeleton className="h-5 w-12 rounded-md" />
					<Skeleton className="h-5 w-14 rounded-md" />
					<Skeleton className="h-5 w-10 rounded-md" />
				</div>
				{/* Button skeleton */}
				<Skeleton className="h-9 w-full rounded-lg" />
			</CardContent>
		</Card>
	);
};

export const IntegrationsManagement = ({
	workspaceId,
	currentMember,
}: IntegrationsManagementProps) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [refreshKey, setRefreshKey] = useState(0);
	const handledCallbackRef = useRef(false);

	// State for data fetching
	const [authConfigs, setAuthConfigs] = useState<any[]>([]);
	const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Fetch data from AgentAuth API route
	const fetchData = useCallback(async () => {
		try {
			setIsLoading(true);

			// Fetch auth configs and connected accounts using unified AgentAuth endpoint
			// Now with memberId to get user-specific integrations
			const response = await fetch(
				`/api/assistant/composio/agentauth?action=fetch-data&workspaceId=${workspaceId}&memberId=${currentMember._id}`
			);

			if (response.ok) {
				const data = await response.json();
				setAuthConfigs(data.authConfigs || []);
				setConnectedAccounts(data.connectedAccounts || []);
			} else {
				console.warn("Failed to fetch integration data, using empty arrays");
				setAuthConfigs([]);
				setConnectedAccounts([]);
			}
		} catch (error) {
			console.error("Error fetching integration data:", error);
			setAuthConfigs([]);
			setConnectedAccounts([]);
		} finally {
			setIsLoading(false);
		}
	}, [workspaceId, currentMember._id]);

	const handleConnectionComplete = useCallback(
		async (toolkit: string, userId?: string) => {
			try {
				// Complete connection using AgentAuth with member-scoped entity ID
				const response = await fetch("/api/assistant/composio/agentauth", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						action: "complete",
						userId: userId || `member_${currentMember._id}`, // Use member entity ID
						toolkit,
						workspaceId,
						memberId: currentMember._id,
					}),
				});

				if (!response.ok) {
					throw new Error("Failed to complete AgentAuth connection");
				}

				const _result = await response.json();

				// Refresh the data
				await fetchData();
				setRefreshKey((prev) => prev + 1);
			} catch (error) {
				console.error("Error completing AgentAuth connection:", error);
				toast.error("Failed to complete connection setup");
			}
		},
		[workspaceId, currentMember._id, fetchData]
	);

	// Check if user just returned from OAuth (AgentAuth callback)
	useEffect(() => {
		const connected = searchParams.get("connected");
		const toolkit = searchParams.get("toolkit");
		const userId = searchParams.get("userId");

		if (connected === "true" && toolkit && !handledCallbackRef.current) {
			handledCallbackRef.current = true;

			toast.success(
				`${toolkit.charAt(0).toUpperCase() + toolkit.slice(1)} authorization completed!`
			);

			// Handle the connection completion using AgentAuth
			handleConnectionComplete(toolkit, userId || undefined);

			// Remove the query parameters (including memberId added by our callbackUrl)
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete("connected");
			newUrl.searchParams.delete("toolkit");
			newUrl.searchParams.delete("userId");
			newUrl.searchParams.delete("memberId");
			// Also remove any Composio-appended params
			newUrl.searchParams.delete("connectedAccountId");
			newUrl.searchParams.delete("appName");
			router.replace(newUrl.pathname + newUrl.search);
		}
	}, [searchParams, router, handleConnectionComplete]);

	// Initial data fetch
	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleConnectionChange = () => {
		fetchData();
		setRefreshKey((prev) => prev + 1);
	};

	// Create maps for easier lookup
	const authConfigsByToolkit =
		authConfigs?.reduce(
			(acc, config) => {
				acc[config.toolkit] = config;
				return acc;
			},
			{} as Record<string, any>
		) || {};

	const connectedAccountsByToolkit =
		connectedAccounts?.reduce(
			(acc, account) => {
				acc[account.toolkit] = account;
				return acc;
			},
			{} as Record<string, any>
		) || {};

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-semibold tracking-tight">
					My Integrations
				</h3>
				<p className="text-sm text-muted-foreground">
					Connect your personal accounts to external services using Composio's
					unified AgentAuth system for AI-powered automation and enhanced
					productivity features. These connections are unique to you and not
					shared with other workspace members.
				</p>
			</div>

			{isLoading ? (
				<div className="space-y-6">
					{/* Loading header with spinner */}
					<div className="flex items-center justify-center py-8">
						<div className="flex items-center space-x-3">
							<Loader2 className="h-6 w-6 animate-spin text-primary" />
							<span className="text-sm text-muted-foreground">
								Loading integrations...
							</span>
						</div>
					</div>

					{/* Loading cards */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{SUPPORTED_TOOLKITS.map((toolkit) => (
							<LoadingCard key={toolkit} />
						))}
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{SUPPORTED_TOOLKITS.map((toolkit) => (
						<ServiceIntegrationCard
							authConfig={authConfigsByToolkit[toolkit]}
							connectedAccount={connectedAccountsByToolkit[toolkit]}
							currentMember={currentMember}
							key={`${toolkit}-${refreshKey}`}
							onConnectionChange={handleConnectionChange}
							toolkit={toolkit}
							workspaceId={workspaceId}
						/>
					))}
				</div>
			)}
		</div>
	);
};
