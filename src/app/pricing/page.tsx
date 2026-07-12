"use client";

import {
	AnimatePresence,
	motion,
	useReducedMotion,
	useSpring,
	useTransform,
} from "framer-motion";
import {
	ArrowRight,
	Check,
	ChevronDown,
	Minus,
	Plus,
	Sparkles,
	Users,
} from "lucide-react";
import Link from "next/link";
import { Fragment, type PointerEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CTASection } from "@/features/landing/components/cta-section";
import { Footer } from "@/features/landing/components/footer";
import { Header } from "@/features/landing/components/header";
import { cn } from "@/lib/utils";

/**
 * Every figure on this page is sourced from `convex/billing/plans.ts` (the
 * PLANS config) and the seat-based billing behaviour in
 * `convex/billing/payments.ts`. Free $0, Pro $5/seat/mo, Enterprise $10/seat/mo
 * (unlimited usage). Billing is monthly and per active seat — there is no
 * annual plan, so the page must not imply one.
 */
type PlanId = "free" | "pro" | "enterprise";

const PRO_PER_SEAT = 5; // PLANS.pro.pricePerSeatMonthly
const ENTERPRISE_PER_SEAT = 10; // PLANS.enterprise.pricePerSeatMonthly
const MIN_SEATS = 1;
const MAX_SEATS = 50;
const SEAT_PRESETS = [3, 10, 25, 50];

const PricingPage = () => {
	const [seats, setSeats] = useState(8);
	const [considered, setConsidered] = useState<PlanId>("pro");

	return (
		<div className="flex min-h-screen flex-col">
			<Header />

			<HeroSection />

			{/* Interactive calculator + tiers */}
			<section className="bg-muted pb-20 pt-4">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<SeatControls onSeatsChange={setSeats} seats={seats} />

					<div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
						<PlanCard
							blurb="For individuals and small teams just getting started."
							caption="Free forever · unlimited members"
							considered={considered}
							cta={{ href: "/auth/signup", label: "Get Started" }}
							features={[
								"Unlimited members",
								"50 AI chat requests / month",
								"1,000 messages / month",
								"50 tasks & 20 notes / month",
								"5 channels & 2 boards / month",
							]}
							id="free"
							name="Free"
							onConsider={setConsidered}
							priceNode={
								<div className="flex items-baseline gap-2">
									<span className="text-5xl font-bold tracking-tight">$0</span>
									<span className="text-muted-foreground">/month</span>
								</div>
							}
						/>

						<PlanCard
							blurb="For growing teams that need more power and flexibility."
							caption={`$${PRO_PER_SEAT}/user · billed monthly per seat`}
							considered={considered}
							cta={{ href: "/auth/signup", label: "Upgrade to Pro" }}
							featured
							features={[
								"1,000 AI chat requests / month",
								"500 AI diagrams & 500 summaries / month",
								"50,000 messages / month",
								"1,000 tasks & 500 notes / month",
								"50 channels & 20 boards / month",
								"Self-serve billing & customer portal",
							]}
							id="pro"
							name="Pro"
							onConsider={setConsidered}
							priceNode={
								<div className="flex items-baseline gap-2">
									<AnimatedMoney
										className="text-5xl font-bold tracking-tight text-primary"
										value={seats * PRO_PER_SEAT}
									/>
									<span className="text-muted-foreground">/month</span>
								</div>
							}
						/>

						<PlanCard
							blurb="Unlimited usage for large organisations."
							caption={`$${ENTERPRISE_PER_SEAT}/user · billed monthly per seat`}
							considered={considered}
							cta={{
								href: "/auth/signup",
								label: "Choose Enterprise",
								variant: "outline",
							}}
							features={[
								"Unlimited AI chat, diagrams & summaries",
								"Unlimited messages",
								"Unlimited tasks, notes, channels & boards",
								"Unlimited members",
								"Self-serve billing & customer portal",
							]}
							id="enterprise"
							name="Enterprise"
							onConsider={setConsidered}
							priceNode={
								<div className="flex items-baseline gap-2">
									<AnimatedMoney
										className="text-5xl font-bold tracking-tight"
										value={seats * ENTERPRISE_PER_SEAT}
									/>
									<span className="text-muted-foreground">/month</span>
								</div>
							}
						/>
					</div>
				</div>
			</section>

			<ComparisonTable considered={considered} onConsider={setConsidered} />

			<FaqSection />

			<CTASection />

			<Footer />
		</div>
	);
};

export default PricingPage;

function HeroSection() {
	return (
		<section className="bg-background py-20">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-3xl text-center">
					<motion.h1
						animate={{ opacity: 1, y: 0 }}
						className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl"
						initial={{ opacity: 0, y: 16 }}
						transition={{ duration: 0.5 }}
					>
						Pricing that adds up{" "}
						<span className="text-primary">as you grow</span>
					</motion.h1>
					<motion.p
						animate={{ opacity: 1, y: 0 }}
						className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl"
						initial={{ opacity: 0, y: 16 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Size your team and watch the seat price move. Every plan includes
						the full Proddy workspace — plans differ by monthly limits, not
						features.
					</motion.p>
				</div>
			</div>
		</section>
	);
}

function SeatControls({
	seats,
	onSeatsChange,
}: {
	seats: number;
	onSeatsChange: (n: number) => void;
}) {
	const clamp = (n: number) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, n));

	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-md sm:p-6"
			initial={{ opacity: 0, y: 16 }}
			transition={{ duration: 0.5, delay: 0.15 }}
		>
			<div className="mb-3 flex items-center justify-between gap-3">
				<label
					className="flex items-center gap-2 text-sm font-medium text-foreground"
					htmlFor="seat-slider"
				>
					<Users className="size-4 text-muted-foreground" />
					Team size
				</label>
				<div className="flex items-center gap-1.5">
					<button
						aria-label="Remove a seat"
						className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
						disabled={seats <= MIN_SEATS}
						onClick={() => onSeatsChange(clamp(seats - 1))}
						type="button"
					>
						<Minus className="size-3.5" />
					</button>
					<span className="w-20 text-center text-sm font-semibold tabular-nums text-foreground">
						{seats} {seats === 1 ? "seat" : "seats"}
					</span>
					<button
						aria-label="Add a seat"
						className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
						disabled={seats >= MAX_SEATS}
						onClick={() => onSeatsChange(clamp(seats + 1))}
						type="button"
					>
						<Plus className="size-3.5" />
					</button>
				</div>
			</div>

			<Slider
				aria-label="Team size in seats"
				id="seat-slider"
				max={MAX_SEATS}
				min={MIN_SEATS}
				onValueChange={([v]) => onSeatsChange(v)}
				step={1}
				value={[seats]}
			/>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap gap-1.5">
					{SEAT_PRESETS.map((p) => (
						<button
							className={cn(
								"rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
								seats === p
									? "border-primary bg-primary/10 text-primary"
									: "border-border text-muted-foreground hover:bg-muted"
							)}
							key={p}
							onClick={() => onSeatsChange(p)}
							type="button"
						>
							{p}
						</button>
					))}
				</div>
				<span className="text-xs text-muted-foreground">
					Billed monthly per seat · cancel anytime
				</span>
			</div>
		</motion.div>
	);
}

function PlanCard({
	id,
	name,
	priceNode,
	caption,
	blurb,
	features,
	cta,
	featured = false,
	considered,
	onConsider,
}: {
	id: PlanId;
	name: string;
	priceNode: React.ReactNode;
	caption: string;
	blurb: string;
	features: string[];
	cta: { href: string; label: string; variant?: "default" | "outline" };
	featured?: boolean;
	considered: PlanId;
	onConsider: (id: PlanId) => void;
}) {
	const isConsidered = considered === id;

	const onMove = (e: PointerEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const r = el.getBoundingClientRect();
		el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
		el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
	};

	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className={cn(
				"price-card rounded-2xl border bg-card p-7 shadow-sm transition-shadow duration-300 hover:shadow-lg",
				featured
					? "price-card--pro border-transparent md:-mt-3 md:mb-3"
					: "border-border",
				isConsidered && !featured && "ring-1 ring-primary/30"
			)}
			initial={{ opacity: 0, y: 20 }}
			onFocus={() => onConsider(id)}
			onMouseEnter={() => onConsider(id)}
			onPointerMove={onMove}
			transition={{ duration: 0.45, delay: id === "pro" ? 0.05 : 0.12 }}
		>
			{featured && (
				<div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2">
					<span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
						<Sparkles className="size-3" />
						Most popular
					</span>
				</div>
			)}

			<div className="price-card__body">
				<h3 className="text-base font-semibold text-foreground">{name}</h3>

				<div className="mt-3 min-h-[3.5rem]">{priceNode}</div>

				<p className="mt-1 text-sm text-muted-foreground">{caption}</p>

				<p className="mt-5 text-sm text-muted-foreground">{blurb}</p>

				<ul className="mt-6 space-y-3">
					{features.map((f) => (
						<li className="flex items-start gap-2.5" key={f}>
							<Check className="mt-0.5 size-4 shrink-0 text-success" />
							<span className="text-sm text-foreground">{f}</span>
						</li>
					))}
				</ul>

				<Link className="mt-8 block" href={cta.href}>
					<Button
						className="w-full"
						size="lg"
						variant={cta.variant ?? "default"}
					>
						{cta.label}
						{cta.variant !== "outline" && (
							<ArrowRight className="ml-2 size-4" />
						)}
					</Button>
				</Link>
			</div>
		</motion.div>
	);
}

function AnimatedMoney({
	value,
	className,
}: {
	value: number;
	className?: string;
}) {
	const reduce = useReducedMotion();
	const spring = useSpring(value, { stiffness: 150, damping: 26, mass: 0.7 });
	const display = useTransform(
		spring,
		(v) => `$${Math.round(v).toLocaleString()}`
	);

	useEffect(() => {
		spring.set(value);
	}, [spring, value]);

	if (reduce) {
		return (
			<span
				className={className}
			>{`$${Math.round(value).toLocaleString()}`}</span>
		);
	}
	return <motion.span className={className}>{display}</motion.span>;
}

/**
 * Comparison rows mirror the PLANS limits in `convex/billing/plans.ts` exactly
 * (-1 → "Unlimited"), plus the seat-based billing + customer-portal behaviour
 * from the billing module. No support-tier / SSO / storage claims — those are
 * not represented in the code.
 */
const PRICING_DATA: {
	category: string;
	features: { name: string; free: string; pro: string; enterprise: string }[];
}[] = [
	{
		category: "AI Usage (Monthly)",
		features: [
			{
				name: "AI chat requests",
				free: "50",
				pro: "1,000",
				enterprise: "Unlimited",
			},
			{
				name: "AI diagram generations",
				free: "10",
				pro: "500",
				enterprise: "Unlimited",
			},
			{
				name: "AI summaries",
				free: "10",
				pro: "500",
				enterprise: "Unlimited",
			},
		],
	},
	{
		category: "Communication (Monthly)",
		features: [
			{
				name: "Messages sent",
				free: "1,000",
				pro: "50,000",
				enterprise: "Unlimited",
			},
			{
				name: "Channels created",
				free: "5",
				pro: "50",
				enterprise: "Unlimited",
			},
		],
	},
	{
		category: "Work Management (Monthly)",
		features: [
			{
				name: "Tasks created",
				free: "50",
				pro: "1,000",
				enterprise: "Unlimited",
			},
			{
				name: "Board cards created",
				free: "2",
				pro: "20",
				enterprise: "Unlimited",
			},
			{
				name: "Notes created",
				free: "20",
				pro: "500",
				enterprise: "Unlimited",
			},
		],
	},
	{
		category: "Plans & Billing",
		features: [
			{
				name: "Price per user",
				free: "$0",
				pro: "$5/mo",
				enterprise: "$10/mo",
			},
			{
				name: "Members",
				free: "Unlimited",
				pro: "Unlimited",
				enterprise: "Unlimited",
			},
			{
				name: "Seat-based billing",
				free: "No",
				pro: "Yes",
				enterprise: "Yes",
			},
			{
				name: "Customer portal",
				free: "No",
				pro: "Yes",
				enterprise: "Yes",
			},
			{
				name: "Plan enforcement",
				free: "Yes",
				pro: "Yes",
				enterprise: "Yes",
			},
		],
	},
];

const PLAN_COLUMNS: { id: PlanId; label: string }[] = [
	{ id: "free", label: "Free" },
	{ id: "pro", label: "Pro" },
	{ id: "enterprise", label: "Enterprise" },
];

function ComparisonTable({
	considered,
	onConsider,
}: {
	considered: PlanId;
	onConsider: (id: PlanId) => void;
}) {
	return (
		<section className="bg-background py-20" id="comparison">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mb-10 max-w-2xl">
					<h2 className="text-3xl font-semibold tracking-tight text-foreground">
						Full feature comparison
					</h2>
					<p className="mt-3 text-muted-foreground">
						Every plan opens the same tools. What changes are the monthly limits
						— pick a column to keep your eye on the plan you&apos;re weighing.
					</p>
				</div>

				<div className="overflow-x-auto rounded-2xl border border-border lg:overflow-x-visible">
					<table className="w-full min-w-[720px] border-collapse text-sm">
						<thead className="sticky top-16 z-20 shadow-[0_1px_0_0_hsl(var(--border))]">
							<tr>
								<th className="rounded-tl-2xl bg-card px-5 py-4 text-left align-bottom text-xs font-medium text-muted-foreground">
									Feature
								</th>
								{PLAN_COLUMNS.map((col) => {
									const active = considered === col.id;
									return (
										<th
											className="bg-card px-5 py-3 text-left align-bottom transition-colors last:rounded-tr-2xl"
											key={col.id}
										>
											<button
												className="group flex flex-col items-start gap-1"
												onClick={() => onConsider(col.id)}
												type="button"
											>
												<span
													className={cn(
														"text-sm font-semibold transition-colors",
														active
															? "text-primary"
															: "text-foreground group-hover:text-primary"
													)}
												>
													{col.label}
												</span>
												<span
													className={cn(
														"h-0.5 w-8 rounded-full transition-colors",
														active ? "bg-primary" : "bg-transparent"
													)}
												/>
											</button>
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody>
							{PRICING_DATA.map((section) => (
								<Fragment key={section.category}>
									<tr>
										<td
											className="bg-muted px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
											colSpan={4}
										>
											{section.category}
										</td>
									</tr>
									{section.features.map((feature) => (
										<tr
											className="border-t border-border/60 transition-colors hover:bg-muted/30"
											key={feature.name}
										>
											<td className="px-5 py-3.5 text-foreground">
												{feature.name}
											</td>
											<Cell
												active={considered === "free"}
												value={feature.free}
											/>
											<Cell active={considered === "pro"} value={feature.pro} />
											<Cell
												active={considered === "enterprise"}
												value={feature.enterprise}
											/>
										</tr>
									))}
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}

function Cell({ value, active }: { value: string; active: boolean }) {
	const isNo = value === "No";
	const isYes = value === "Yes";
	return (
		<td
			className={cn(
				"px-5 py-3.5 transition-colors",
				active && "bg-primary/[0.04]",
				isNo ? "text-muted-foreground/60" : "text-foreground"
			)}
		>
			{isYes ? (
				<Check
					aria-label="Included"
					className="size-4 text-success"
					role="img"
				/>
			) : isNo ? (
				<>
					<span className="sr-only">Not included</span>
					<span aria-hidden="true">—</span>
				</>
			) : (
				<span className={cn(value === "Unlimited" && "font-medium")}>
					{value}
				</span>
			)}
		</td>
	);
}

/**
 * FAQ copy is grounded in the real product configuration — plan limits and
 * prices come from `convex/billing/plans.ts`, module coverage from PRODUCT.md,
 * and billing behaviour (seat-based, self-serve customer portal, no annual
 * plan) from `convex/billing/payments.ts`. Do not add claims not backed there.
 */
const FAQS: { q: string; a: string }[] = [
	{
		q: "Is the Free plan free forever?",
		a: "Yes. Free is $0 for unlimited members — not a time-limited trial. It includes the full Proddy workspace with monthly limits of 50 AI chat requests, 1,000 messages, 50 tasks, 20 notes, 5 channels, and 2 boards.",
	},
	{
		q: "What do I get when I upgrade to Pro?",
		a: "Pro is $5 per user each month and raises every monthly limit: 1,000 AI chat requests, 500 AI diagrams and 500 summaries, 50,000 messages, 1,000 tasks, 500 notes, 50 channels, and 20 boards — with self-serve billing through the customer portal.",
	},
	{
		q: "What's included in Enterprise, and how much is it?",
		a: "Enterprise is $10 per user each month and removes every usage limit — unlimited AI requests, messages, tasks, notes, channels, and boards. It's seat-based and self-serve, exactly like Pro.",
	},
	{
		q: "How does seat-based billing work?",
		a: "Paid plans (Pro and Enterprise) are billed per active member in your workspace. Add a teammate and the seat is added to your subscription; remove them and it comes off. You manage invoices, seats, and cancellation yourself from the customer portal.",
	},
	{
		q: "Do usage limits reset each month?",
		a: "Yes. Limits such as AI requests, messages, tasks, and notes are counted per billing month and reset at the start of the next cycle. Enterprise usage is unlimited, so there's nothing to reset.",
	},
	{
		q: "What happens if I reach a limit?",
		a: "That specific action pauses — for example a further AI request or a new board card — until the next monthly reset or until you upgrade. Nothing is deleted: your existing messages, tasks, and notes stay fully accessible.",
	},
	{
		q: "Can I change plans or cancel anytime?",
		a: "Yes. Upgrades, downgrades, and cancellations are self-serve from the customer portal, with no fixed-term contract.",
	},
	{
		q: "Are all Proddy features available on every plan?",
		a: "Yes. Messaging, tasks, boards, canvas, notes, calendar, meetings, and reports ship in every plan, including Free. Plans differ by monthly usage limits and price — never by which tools you can open.",
	},
];

function FaqSection() {
	const [openIndex, setOpenIndex] = useState<number | null>(0);

	return (
		<section className="bg-muted py-20" id="faq">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-semibold tracking-tight text-foreground">
						Frequently asked questions
					</h2>
					<p className="mt-3 text-muted-foreground">
						Everything about plans, limits, and billing. Still curious?{" "}
						<Link
							className="text-primary underline-offset-4 hover:underline"
							href="/contact"
						>
							Talk to us
						</Link>
						.
					</p>
				</div>

				<div className="grid items-start gap-4 md:grid-cols-2 lg:gap-6">
					{[FAQS.slice(0, 4), FAQS.slice(4, 8)].map((column, colIndex) => (
						<div
							className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
							key={column[0].q}
						>
							{column.map((item, rowIndex) => {
								const index = colIndex * 4 + rowIndex;
								return (
									<FaqItem
										answer={item.a}
										key={item.q}
										onToggle={() =>
											setOpenIndex(openIndex === index ? null : index)
										}
										open={openIndex === index}
										question={item.q}
									/>
								);
							})}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function FaqItem({
	question,
	answer,
	open,
	onToggle,
}: {
	question: string;
	answer: string;
	open: boolean;
	onToggle: () => void;
}) {
	const reduce = useReducedMotion();

	return (
		<div>
			<h3>
				<button
					aria-expanded={open}
					className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-muted/40"
					onClick={onToggle}
					type="button"
				>
					<span className="text-base font-medium text-foreground">
						{question}
					</span>
					<ChevronDown
						className={cn(
							"size-5 shrink-0 text-muted-foreground transition-transform duration-300",
							open && "rotate-180 text-primary"
						)}
					/>
				</button>
			</h3>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						animate={{ height: "auto", opacity: 1 }}
						className="overflow-hidden"
						exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
						initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
						transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
					>
						<p className="px-5 pb-5 pr-12 text-sm leading-relaxed text-muted-foreground">
							{answer}
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
