import { type FunctionReference, httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { auth } from "./auth";
import { subscriptions } from "./dodo";
import { PLANS } from "./plans";

const http = httpRouter();

auth.addHttpRoutes(http);

const parsePlanFromMetadata = (
	metadata: Record<string, unknown> | undefined
): "pro" | "enterprise" | undefined => {
	const plan = metadata?.plan;
	if (plan === "pro" || plan === "enterprise") {
		return plan;
	}
	return undefined;
};

const parseWorkspaceIdFromMetadata = (
	metadata: Record<string, unknown> | undefined
): string | undefined => {
	const workspaceId = metadata?.workspace_id ?? metadata?.workspaceId;
	return typeof workspaceId === "string" ? workspaceId : undefined;
};

const parseQuantityFromMetadata = (
	metadata: Record<string, unknown> | undefined
): number | undefined => {
	const quantity = metadata?.quantity;
	if (typeof quantity === "number" && Number.isFinite(quantity)) {
		return Math.max(1, Math.floor(quantity));
	}
	if (typeof quantity === "string") {
		const parsed = Number(quantity);
		if (Number.isFinite(parsed)) return Math.max(1, Math.floor(parsed));
	}
	return undefined;
};

const parsePlanFromProductId = (
	productId: unknown
): "pro" | "enterprise" | undefined => {
	if (typeof productId !== "string") return undefined;
	if (productId === PLANS.pro.dodoProductId) return "pro";
	if (productId === PLANS.enterprise.dodoProductId) return "enterprise";
	return undefined;
};

interface DodoSubscriptionData {
	subscription_id?: string;
	status?: string;
	quantity?: number;
	cancel_at_next_billing_date?: boolean;
	next_billing_date?: string;
	product_id?: string;
	product?: {
		product_id?: string;
		id?: string;
	};
	metadata?: {
		workspace_id?: string;
		workspaceId?: string;
		plan?: string;
	};
	customer?:
		| string
		| {
				customer_id?: string;
				id?: string;
				email?: string;
		  };
	customer_id?: string;
	customer_email?: string;
}

interface DodoWebhookPayload {
	type: string;
	data: DodoSubscriptionData & {
		payment_id?: string;
		total_amount?: number;
		tax?: number;
		invoice_url?: string;
		currency?: string;
		status?: string;
		quantity?: number;
		cancel_at_next_billing_date?: boolean;
		next_billing_date?: string;
		subscription_id?: string;
		metadata?: {
			workspace_id?: string;
			workspaceId?: string;
			plan?: string;
		};
		customer?:
			| string
			| {
					customer_id?: string;
					id?: string;
					email?: string;
			  };
		customer_email?: string;
	};
	business_id?: string;
	webhook_id?: string;
	id?: string;
	msg_id?: string;
	msgId?: string;
}

const parseSubscriptionWorkspaceId = (
	data: DodoSubscriptionData
): string | undefined => parseWorkspaceIdFromMetadata(data?.metadata);

const parseSubscriptionCustomerId = (
	data: DodoSubscriptionData
): string | undefined => {
	if (typeof data?.customer === "string") return data.customer;
	return data?.customer?.customer_id ?? data?.customer?.id ?? data?.customer_id;
};

const parseCustomerEmail = (data: DodoSubscriptionData): string | null => {
	if (typeof data?.customer === "object" && data.customer?.email) {
		return data.customer.email;
	}
	return typeof data?.customer_email === "string" ? data.customer_email : null;
};

const parseSubscriptionPlan = (
	data: DodoSubscriptionData
): "pro" | "enterprise" | undefined =>
	parsePlanFromProductId(data?.product_id) ??
	parsePlanFromProductId(data?.product?.product_id) ??
	parsePlanFromProductId(data?.product?.id) ??
	parsePlanFromMetadata(data?.metadata);

const buildSubscriptionMutationArgs = (
	data: DodoSubscriptionData,
	raw: string,
	fallbackWorkspaceId?: string,
	billingDetails?: {
		amountDue?: number;
		currency?: string;
		taxAmount?: number;
		invoiceUrl?: string;
		paymentConfirmed?: boolean;
	},
	fallbackPlan?: "pro" | "enterprise",
	fallbackQuantity?: number
) => {
	const args: {
		workspaceId?: string;
		subscriptionId: string;
		status: string;
		plan?: "pro" | "enterprise";
		customerId?: string;
		quantity?: number;
		customerEmail?: string | null;
		cancelAtNextBillingDate?: boolean;
		nextBillingDate?: string;
		amountDue?: number;
		currency?: string;
		taxAmount?: number;
		invoiceUrl?: string;
		paymentConfirmed?: boolean;
		raw: string;
	} = {
		subscriptionId: data?.subscription_id ?? "",
		status: data?.status ?? "unknown",
		raw,
	};
	const workspaceId = parseSubscriptionWorkspaceId(data) ?? fallbackWorkspaceId;
	const plan = parseSubscriptionPlan(data) ?? fallbackPlan;
	const customerId = parseSubscriptionCustomerId(data);
	const customerEmail = parseCustomerEmail(data);

	if (workspaceId) args.workspaceId = workspaceId;
	if (plan) args.plan = plan;
	if (customerId) args.customerId = customerId;
	if (customerEmail) args.customerEmail = customerEmail;
	if (typeof data?.quantity === "number") args.quantity = data.quantity;
	else if (typeof fallbackQuantity === "number") {
		args.quantity = fallbackQuantity;
	}
	if (typeof data?.cancel_at_next_billing_date === "boolean") {
		args.cancelAtNextBillingDate = data.cancel_at_next_billing_date;
	}
	if (typeof data?.next_billing_date === "string") {
		args.nextBillingDate = data.next_billing_date;
	}
	if (billingDetails?.amountDue && billingDetails.amountDue > 0) {
		args.amountDue = billingDetails.amountDue;
	}
	if (billingDetails?.currency) args.currency = billingDetails.currency;
	if (billingDetails?.taxAmount && billingDetails.taxAmount > 0) {
		args.taxAmount = billingDetails.taxAmount;
	}
	if (billingDetails?.invoiceUrl) args.invoiceUrl = billingDetails.invoiceUrl;
	if (billingDetails?.paymentConfirmed === true) {
		args.paymentConfirmed = true;
	}

	return args;
};

const syncSubscriptionFromDodo = async (
	ctx: ActionCtx,
	subscriptionId: string,
	fallbackWorkspaceId?: string,
	billingDetails?: {
		amountDue?: number;
		currency?: string;
		taxAmount?: number;
		invoiceUrl?: string;
		paymentConfirmed?: boolean;
	},
	fallbackPlan?: "pro" | "enterprise",
	fallbackQuantity?: number
) => {
	try {
		const subscription = await subscriptions.retrieve(ctx, {
			subscription_id: subscriptionId,
		});

		await ctx.runMutation(
			internal.webhooks.updateSubscription,
			buildSubscriptionMutationArgs(
				{
					...subscription,
					subscription_id: subscription.subscription_id ?? subscriptionId,
				},
				JSON.stringify(subscription),
				fallbackWorkspaceId,
				billingDetails,
				fallbackPlan,
				fallbackQuantity
			)
		);
	} catch (error) {
		console.error("[Dodo Webhook] Failed to retrieve subscription:", error);
		await ctx.runMutation(
			internal.webhooks.updateSubscription,
			buildSubscriptionMutationArgs(
				{
					subscription_id: subscriptionId,
					status: "sync_failed",
					metadata: fallbackWorkspaceId
						? { workspace_id: fallbackWorkspaceId, plan: fallbackPlan }
						: undefined,
					quantity: fallbackQuantity,
				},
				JSON.stringify({
					subscription_id: subscriptionId,
					fallback: true,
					error: String(error),
				}),
				fallbackWorkspaceId,
				billingDetails,
				fallbackPlan,
				fallbackQuantity
			)
		);
	}
};

// ─── Dodo Payments Webhook ─────────────────────────────────────────────────────
// Securely handles Dodo Payments webhook events with signature verification.
// Ensure DODO_PAYMENTS_WEBHOOK_SECRET is configured in Convex dashboard env vars.

const parseWebhookSignatures = (signatureHeader: string): string[] =>
	signatureHeader
		.split(/\s+/)
		.flatMap((token) => token.split(","))
		.map((segment) => segment.trim())
		.filter(Boolean)
		.flatMap((segment) => {
			const versioned = segment.match(/^v\d+[=,](.+)$/i);
			if (versioned) return [versioned[1].trim()];
			return /^v\d+$/i.test(segment) ? [] : [segment];
		})
		.filter(Boolean);

const getWebhookId = (payload: DodoWebhookPayload): string | null => {
	const id = payload?.msg_id ?? payload?.msgId ?? payload?.id;
	return typeof id === "string" && id.length > 0 ? id : null;
};

const verifyDodoSignature = async (
	payload: string,
	signatureHeader: string,
	msgId: string,
	timestamp: string,
	secretBase64: string
): Promise<boolean> => {
	const encoder = new TextEncoder();
	const toSign = encoder.encode(`${msgId}.${timestamp}.${payload}`);

	const secretStr = secretBase64.startsWith("whsec_")
		? secretBase64.substring(6)
		: secretBase64;
	const secretBytes = Uint8Array.from(atob(secretStr), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		"raw",
		secretBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);

	const signatureBuffer = await crypto.subtle.sign("HMAC", key, toSign);
	const signatureBase64Computed = btoa(
		String.fromCharCode(...new Uint8Array(signatureBuffer))
	);

	const signatures = parseWebhookSignatures(signatureHeader);
	return signatures.includes(signatureBase64Computed);
};

const handlePaymentSucceededEvent = async (
	ctx: ActionCtx,
	payload: DodoWebhookPayload
) => {
	const subscriptionId = payload.data?.subscription_id;
	const plan = parsePlanFromMetadata(payload.data?.metadata);
	const workspaceId = parseWorkspaceIdFromMetadata(payload.data?.metadata);
	const paymentId = payload.data?.payment_id;
	const totalAmount = payload.data?.total_amount;
	const currency = payload.data?.currency;
	if (
		typeof paymentId !== "string" ||
		typeof totalAmount !== "number" ||
		typeof currency !== "string"
	) {
		console.warn("[Dodo Webhook] payment.succeeded missing required fields", {
			paymentId,
			totalAmount,
			currency,
		});
		return;
	}
	const paymentArgs: {
		paymentId: string;
		businessId?: string;
		workspaceId?: string;
		subscriptionId?: string;
		applyPendingBilling?: boolean;
		plan?: "pro" | "enterprise";
		quantity?: number;
		customerId?: string;
		customerEmail?: string | null;
		amount: number;
		currency: string;
		status: string;
		taxAmount?: number;
		invoiceUrl?: string;
		raw: string;
	} = {
		paymentId,
		customerEmail: parseCustomerEmail(payload.data),
		amount: totalAmount,
		currency,
		status: payload.data.status ?? "unknown",
		raw: JSON.stringify(payload),
	};
	if (typeof payload.business_id === "string") {
		paymentArgs.businessId = payload.business_id;
	}
	let dodoQuantityAligned = true;
	let pendingChange: {
		workspaceId: Id<"workspaces">;
		plan: "pro" | "enterprise";
		quantity: number;
		currentQuantity: number;
		amountDue: number | null;
		currency: string | null;
		taxAmount: number | null;
	} | null = null;
	if (typeof subscriptionId === "string") {
		paymentArgs.subscriptionId = subscriptionId;
		pendingChange = await ctx.runQuery(
			internal.webhooks.getPendingSubscriptionChange,
			{ subscriptionId }
		);
		if (pendingChange) {
			if (plan !== pendingChange.plan) {
				console.warn(
					"[Dodo Webhook] Payment succeeded for subscription with pending plan change, but payment metadata did not match the pending plan. Leaving workspace on current plan.",
					{
						subscriptionId,
						paymentPlan: plan ?? null,
						pendingPlan: pendingChange.plan,
						workspaceId: pendingChange.workspaceId,
					}
				);
				dodoQuantityAligned = false;
			}
			const productId = PLANS[pendingChange.plan].dodoProductId;
			if (!productId) {
				console.error(
					"[Dodo Webhook] Missing Dodo product id for pending plan",
					{
						plan: pendingChange.plan,
						workspaceId: pendingChange.workspaceId,
					}
				);
				dodoQuantityAligned = false;
			} else if (dodoQuantityAligned) {
				try {
					const liveSubscription = await subscriptions.retrieve(ctx, {
						subscription_id: subscriptionId,
					});
					const livePlan = parseSubscriptionPlan(liveSubscription);
					if (
						livePlan !== pendingChange.plan ||
						liveSubscription?.quantity !== pendingChange.quantity
					) {
						await subscriptions.changePlan(ctx, {
							subscription_id: subscriptionId,
							product_id: productId,
							quantity: pendingChange.quantity,
							proration_billing_mode: "do_not_bill",
							effective_at: "immediately",
							on_payment_failure: "apply_change",
							metadata: {
								workspace_id: pendingChange.workspaceId,
								plan: pendingChange.plan,
							},
						});
						const updatedSubscription = await subscriptions.retrieve(ctx, {
							subscription_id: subscriptionId,
						});
						const updatedPlan = parseSubscriptionPlan(updatedSubscription);
						if (
							updatedPlan !== pendingChange.plan ||
							updatedSubscription?.quantity !== pendingChange.quantity
						) {
							throw new Error(
								`Dodo subscription did not update to ${pendingChange.plan} x ${pendingChange.quantity}`
							);
						}
						console.log("[Dodo Webhook] Applied paid pending seat quantity", {
							workspaceId: pendingChange.workspaceId,
							subscriptionId,
							quantity: pendingChange.quantity,
						});
					}
				} catch (error) {
					dodoQuantityAligned = false;
					const errorDetails =
						error instanceof Error ? error.message : String(error);
					console.error(
						"[Dodo Webhook] Failed to update Dodo quantity after payment",
						{
							workspaceId: pendingChange.workspaceId,
							subscriptionId,
							error: errorDetails,
						}
					);
					await ctx.runMutation(internal.webhooks.markDodoSyncManualReview, {
						workspaceId: pendingChange.workspaceId,
						reason: `Failed to apply paid Dodo plan change after payment: ${errorDetails}`,
					});
				}
			}
			paymentArgs.applyPendingBilling = dodoQuantityAligned;
		}
	}
	const customerId = parseSubscriptionCustomerId(payload.data);
	if (customerId) paymentArgs.customerId = customerId;
	if (workspaceId) paymentArgs.workspaceId = workspaceId;
	if (plan) paymentArgs.plan = plan;
	if (typeof payload.data?.quantity === "number") {
		paymentArgs.quantity = payload.data.quantity;
	} else {
		const metadataQuantity = parseQuantityFromMetadata(payload.data?.metadata);
		if (typeof metadataQuantity === "number") {
			paymentArgs.quantity = metadataQuantity;
		}
	}
	if (typeof payload.data?.tax === "number") {
		paymentArgs.taxAmount = payload.data.tax;
	}
	if (typeof payload.data?.invoice_url === "string") {
		paymentArgs.invoiceUrl = payload.data.invoice_url;
	}
	await ctx.runMutation(internal.webhooks.createPayment, paymentArgs);
	if (pendingChange && dodoQuantityAligned) {
		return;
	}
	if (typeof subscriptionId === "string") {
		const billingDetails: {
			amountDue?: number;
			currency?: string;
			taxAmount?: number;
			invoiceUrl?: string;
			paymentConfirmed?: boolean;
		} = {};
		billingDetails.paymentConfirmed = dodoQuantityAligned;
		if (
			typeof payload.data?.total_amount === "number" &&
			payload.data.total_amount > 0
		) {
			billingDetails.amountDue = payload.data.total_amount;
		}
		if (typeof payload.data?.currency === "string") {
			billingDetails.currency = payload.data.currency;
		}
		if (typeof payload.data?.tax === "number" && payload.data.tax > 0) {
			billingDetails.taxAmount = payload.data.tax;
		}
		if (typeof payload.data?.invoice_url === "string") {
			billingDetails.invoiceUrl = payload.data.invoice_url;
		}
		await syncSubscriptionFromDodo(
			ctx,
			subscriptionId,
			workspaceId,
			billingDetails,
			plan,
			typeof payload.data?.quantity === "number"
				? payload.data.quantity
				: undefined
		);
	}
};

const handleSubscriptionActiveEvent = async (
	ctx: ActionCtx,
	payload: DodoWebhookPayload
) => {
	await ctx.runMutation(
		internal.webhooks.createSubscription,
		buildSubscriptionMutationArgs(payload.data, JSON.stringify(payload))
	);
};

const handleSubscriptionUpdatedEvent = async (
	ctx: ActionCtx,
	payload: DodoWebhookPayload
) => {
	await ctx.runMutation(
		internal.webhooks.updateSubscription,
		buildSubscriptionMutationArgs(payload.data, JSON.stringify(payload))
	);
};

const handleSubscriptionCancelledEvent = async (
	ctx: ActionCtx,
	payload: DodoWebhookPayload
) => {
	const workspaceId = payload.data?.metadata?.workspace_id as
		| string
		| undefined;
	const customerId = parseSubscriptionCustomerId(payload.data);

	const cancelArgs: {
		workspaceId?: string;
		subscriptionId: string;
		customerId?: string;
		raw: string;
	} = {
		subscriptionId: payload.data.subscription_id ?? "",
		raw: JSON.stringify(payload),
	};
	if (!cancelArgs.subscriptionId) {
		console.warn(
			"[Dodo Webhook] subscription.cancelled missing subscription_id"
		);
		return;
	}
	if (workspaceId) cancelArgs.workspaceId = workspaceId;
	if (customerId) cancelArgs.customerId = customerId;

	await ctx.runMutation(internal.webhooks.cancelSubscription, cancelArgs);
};

http.route({
	path: "/dodopayments-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		// Refactored to external handlers
		/* skipcq: JS-0002 */ console.log("[Webhook] Request received");

		const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
		if (!webhookSecret) {
			/* skipcq: JS-0002 */ console.error(
				"Missing DODO_PAYMENTS_WEBHOOK_SECRET"
			);
			return new Response("Configuration error", { status: 500 });
		}

		const body = await request.text();
		const signature = request.headers.get("webhook-signature");
		const msgId = request.headers.get("webhook-id");
		const timestamp = request.headers.get("webhook-timestamp");

		if (!signature || !msgId || !timestamp) {
			return new Response("Missing headers", { status: 400 });
		}

		const now = Math.floor(Date.now() / 1000);
		const parsedTimestamp = Number.parseInt(timestamp, 10);
		if (!Number.isFinite(parsedTimestamp)) {
			return new Response("Invalid timestamp", { status: 400 });
		}
		if (Math.abs(now - parsedTimestamp) > 300) {
			return new Response("Timestamp out of tolerance", { status: 400 });
		}

		try {
			const isValid = await verifyDodoSignature(
				body,
				signature,
				msgId,
				timestamp,
				webhookSecret
			);
			if (!isValid) return new Response("Invalid signature", { status: 401 });
		} catch (e) {
			/* skipcq: JS-0002 */ console.error("Signature verification failed", e);
			return new Response("Signature verification error", { status: 400 });
		}

		let payload: DodoWebhookPayload;
		try {
			payload = JSON.parse(body);
		} catch (e) {
			/* skipcq: JS-0002 */ console.error("Invalid JSON payload", {
				error: e,
				bodyPreview: body.slice(0, 1000),
			});
			return new Response("Bad Request", { status: 400 });
		}

		/* skipcq: JS-0002 */ console.log(
			`[Dodo Webhook] Received event: ${payload.type}`
		);
		const webhookId = getWebhookId(payload);
		if (webhookId) {
			const isDuplicate = await ctx.runQuery(
				(internal.webhooks as Record<string, unknown>)
					.checkWebhook as FunctionReference<
					"query",
					"internal",
					{ webhookId: string },
					boolean
				>,
				{
					webhookId,
				}
			);
			if (isDuplicate) {
				/* skipcq: JS-0002 */ console.log(
					`[Dodo Webhook] Duplicate event skipped: ${webhookId}`
				);
				return new Response("OK", { status: 200 });
			}
		}

		try {
			if (payload.type === "payment.succeeded") {
				await handlePaymentSucceededEvent(ctx, payload);
			} else if (
				payload.type === "payment.failed" ||
				payload.type === "payment.cancelled" ||
				payload.type === "payment.canceled"
			) {
				const failedWorkspaceId = parseWorkspaceIdFromMetadata(
					payload.data?.metadata
				);
				console.warn("[Dodo Webhook] Payment did not complete", {
					type: payload.type,
					workspaceId: failedWorkspaceId,
					paymentId: payload.data?.payment_id,
				});
				if (failedWorkspaceId) {
					await ctx.runMutation(internal.payments.clearPendingUpgrade, {
						workspaceId: failedWorkspaceId as Id<"workspaces">,
					});
				}
			} else if (payload.type === "subscription.active") {
				await handleSubscriptionActiveEvent(ctx, payload);
			} else if (
				payload.type === "subscription.updated" ||
				payload.type === "subscription.plan_changed"
			) {
				await handleSubscriptionUpdatedEvent(ctx, payload);
			} else if (payload.type === "subscription.cancelled") {
				await handleSubscriptionCancelledEvent(ctx, payload);
			}

			if (webhookId) {
				await ctx.runMutation(
					(internal.webhooks as Record<string, unknown>)
						.recordWebhook as FunctionReference<
						"mutation",
						"internal",
						{ webhookId: string; eventType: string },
						unknown
					>,
					{
						webhookId,
						eventType: payload.type ?? "unknown",
					}
				);
			}
		} catch (e) {
			/* skipcq: JS-0002 */ console.error(
				`[Dodo Webhook] Error processing webhook ${payload?.type}:`,
				e
			);
			// Always returning 200 to acknowledge receipt and prevent endless retries
			// as requested by the user.
			return new Response("OK", { status: 200 });
		}

		return new Response("OK", { status: 200 });
	}),
});

// Slack OAuth callback handler
http.route({
	path: "/import/slack/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		// Early validation of SITE_URL configuration
		const siteUrl = process.env.SITE_URL;
		if (!siteUrl) {
			return new Response("Configuration error", { status: 500 });
		}

		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Handle OAuth error - safely parse workspaceId for redirect
		if (error) {
			let workspaceId = "";
			try {
				if (state) {
					const parsed = JSON.parse(base64UrlDecode(state));
					workspaceId = parsed.workspaceId || "";
				}
			} catch (_e) {
				// If state parsing fails, redirect to a safe default
			}

			const redirectPath = workspaceId
				? `/workspace/${workspaceId}/manage?error=${encodeURIComponent(error)}#import`
				: `/manage?error=${encodeURIComponent(error)}#import`;

			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}${redirectPath}`,
				},
			});
		}

		if (!code || !state) {
			return new Response("Missing code or state parameter", { status: 400 });
		}

		// Parse state parameter using base64-encoded JSON
		let workspaceId: string;
		let memberId: string;
		try {
			const normalizedState = normalizeStateParam(state);
			const parsed = JSON.parse(base64UrlDecode(normalizedState));
			workspaceId = parsed.workspaceId;
			memberId = parsed.memberId;

			if (!workspaceId || !memberId) {
				throw new Error("Invalid state parameter");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error("Slack OAuth state decode failed:", message);
			return new Response("Invalid state parameter", { status: 400 });
		}

		try {
			// Exchange code for access token
			const clientId = process.env.SLACK_CLIENT_ID;
			const clientSecret = process.env.SLACK_CLIENT_SECRET;
			const redirectUri = `${siteUrl}/api/import/slack/callback`;

			if (!clientId || !clientSecret) {
				throw new Error("Slack OAuth not configured");
			}

			// Create AbortController for timeout handling
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

			let tokenResponse: Response | undefined;
			try {
				tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						code,
						client_id: clientId,
						client_secret: clientSecret,
						redirect_uri: redirectUri,
					}),
					signal: controller.signal,
				});
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					throw new Error("OAuth token exchange timeout");
				}
				throw error;
			} finally {
				clearTimeout(timeoutId);
			}

			if (!tokenResponse) {
				throw new Error("OAuth token exchange failed");
			}

			const tokenData = await tokenResponse.json();

			if (!tokenData.ok) {
				throw new Error(tokenData.error || "Failed to exchange OAuth code");
			}

			// Validate required token fields
			if (
				!tokenData.access_token ||
				!tokenData.team?.id ||
				!tokenData.team.name
			) {
				throw new Error("Invalid token response from Slack");
			}

			// Store the connection
			await ctx.runMutation(internal.importIntegrations.storeSlackConnection, {
				workspaceId: workspaceId as Id<"workspaces">,
				memberId: memberId as Id<"members">,
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token || undefined,
				expiresAt:
					tokenData.expires_in && typeof tokenData.expires_in === "number"
						? Date.now() + tokenData.expires_in * 1000
						: undefined,
				scope: tokenData.scope,
				teamId: tokenData.team.id,
				teamName: tokenData.team.name,
			});

			// Redirect back to manage page with success
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?success=slack_connected#import`,
				},
			});
		} catch (error) {
			// Sanitize error logging to avoid leaking sensitive data
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("Slack OAuth error:", errorMessage);
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?error=${encodeURIComponent(errorMessage)}#import`,
				},
			});
		}
	}),
});

export default http;

function normalizeStateParam(value: string): string {
	if (!value.includes("%")) return value;
	try {
		return decodeURIComponent(value);
	} catch (_error) {
		return value;
	}
}

function base64UrlDecode(value: string): string {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	if (typeof atob === "function") {
		return atob(padded);
	}
	if (typeof Buffer !== "undefined") {
		return Buffer.from(padded, "base64").toString("utf8");
	}
	throw new Error("Base64 decode not supported");
}
