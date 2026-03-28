/**
 * Plan configuration for Proddy's tiered pricing.
 * Free → Pro → Enterprise
 */

export type PlanName = "free" | "pro" | "enterprise";

export interface PlanLimits {
	/** Max AI chat requests per month (-1 = unlimited) */
	aiRequestsPerMonth: number;
	/** Max AI diagram/flowchart generations per month (-1 = unlimited) */
	aiDiagramGenerationsPerMonth: number;
	/** Max AI summarize calls per month (-1 = unlimited) */
	aiSummaryRequestsPerMonth: number;
	/** Max messages sent per month (-1 = unlimited) */
	messagesPerMonth: number;
	/** Max tasks created per month (-1 = unlimited) */
	tasksPerMonth: number;
	/** Max channels created per month (-1 = unlimited) */
	channelsPerMonth: number;
	/** Max board cards created per month (-1 = unlimited) */
	boardsPerMonth: number;
	/** Max notes created per month (-1 = unlimited) */
	notesPerMonth: number;
}

export interface PlanConfig {
	name: PlanName;
	label: string;
	description: string;
	pricePerSeatMonthly: number; // USD
	priceDisplayLabel?: string; // Custom display like "$8\u201312/user"
	// Dodo Payments product identifier for this plan (from Dodo dashboard)
	dodoProductId?: string;
	limits: PlanLimits;
}

export const PLANS: Record<PlanName, PlanConfig> = {
	free: {
		name: "free",
		label: "Free",
		description: "For individuals and small teams just getting started.",
		pricePerSeatMonthly: 0,
		limits: {
			aiRequestsPerMonth: 50,
			aiDiagramGenerationsPerMonth: 10,
			aiSummaryRequestsPerMonth: 10,
			messagesPerMonth: 1000,
			tasksPerMonth: 50,
			channelsPerMonth: 5,
			boardsPerMonth: 2,
			notesPerMonth: 20,
		},
	},
	pro: {
		name: "pro",
		label: "Pro",
		description: "For growing teams that need more power and flexibility.",
		pricePerSeatMonthly: 5,
		// eslint-disable-next-line no-warning-comments
		// TODO: Replace with your Dodo Payments product ID from dashboard
		dodoProductId: process.env.DODO_PAYMENTS_PRODUCTID_PRO,
		limits: {
			aiRequestsPerMonth: 1000,
			aiDiagramGenerationsPerMonth: 500,
			aiSummaryRequestsPerMonth: 500,
			messagesPerMonth: 50000,
			tasksPerMonth: 1000,
			channelsPerMonth: 50,
			boardsPerMonth: 20,
			notesPerMonth: 500,
		},
	},
	enterprise: {
		name: "enterprise",
		label: "Enterprise",
		description: "Unlimited usage for large organisations.",
		pricePerSeatMonthly: 0,
		priceDisplayLabel: "$8\u201312/user",
		limits: {
			aiRequestsPerMonth: -1,
			aiDiagramGenerationsPerMonth: -1,
			aiSummaryRequestsPerMonth: -1,
			messagesPerMonth: -1,
			tasksPerMonth: -1,
			channelsPerMonth: -1,
			boardsPerMonth: -1,
			notesPerMonth: -1,
		},
	},
};

/** Return the plan config for a given plan name, defaulting to "free". */
export function getPlanConfig(planName?: PlanName | null): PlanConfig {
	return PLANS[planName ?? "free"] ?? PLANS.free;
}

/** Returns true when a limit value means "unlimited". */
export function isUnlimited(limit: number): boolean {
	return limit === -1;
}
