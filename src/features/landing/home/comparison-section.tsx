"use client";

import {
	animate,
	m,
	useInView,
	useMotionTemplate,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
} from "framer-motion";
import {
	BarChart3,
	Calendar,
	Check,
	FileText,
	GripVertical,
	LayoutDashboard,
	Lock,
	type LucideIcon,
	MessageSquare,
	PenLine,
	Sparkles,
	Video,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	SiConfluence,
	SiFigma,
	SiGmail,
	SiGooglecalendar,
	SiMiro,
	SiNotion,
	SiSlack,
	SiTodoist,
	SiTrello,
	SiZoom,
} from "react-icons/si";

import { cn } from "@/lib/utils";

// Divider position (0 = all "before", 100 = all Proddy). The panel opens mostly
// on the chaotic "before" state, then sweeps open on scroll to reveal the payoff.
const START = 18;
const SETTLE = 55;
const MIN = 4;
const MAX = 96;

// The jobs Proddy absorbs — one card per function, scattered across the "before"
// half at loose angles so the left of the divider reads as a messy, disconnected
// pile. We show the job (not the brand name); the icon just hints at the culprit.
const legacyTools = [
	{
		job: "Team messaging",
		Icon: SiSlack,
		color: "#4A154B",
		pos: "left-[4%] top-[9%] -rotate-3",
	},
	{
		job: "Docs & wiki",
		Icon: SiNotion,
		color: "#111111",
		pos: "left-[30%] top-[6%] rotate-2",
		hideOnMobile: true,
	},
	{
		job: "Video meetings",
		Icon: SiZoom,
		color: "#0B5CFF",
		pos: "left-[16%] top-[24%] rotate-3",
	},
	{
		job: "Whiteboards",
		Icon: SiMiro,
		color: "#E6A400",
		pos: "left-[41%] top-[20%] -rotate-2",
		hideOnMobile: true,
	},
	{
		job: "Task tracking",
		Icon: SiTodoist,
		color: "#E44332",
		pos: "left-[6%] top-[38%] rotate-2",
	},
	{
		job: "Kanban boards",
		Icon: SiTrello,
		color: "#0052CC",
		pos: "left-[28%] top-[40%] -rotate-3",
		hideOnMobile: true,
	},
	{
		job: "Design canvas",
		Icon: SiFigma,
		color: "#F24E1E",
		pos: "left-[37%] top-[52%] rotate-3",
		hideOnMobile: true,
	},
	{
		job: "Knowledge base",
		Icon: SiConfluence,
		color: "#172B4D",
		pos: "left-[10%] top-[58%] -rotate-2",
	},
	{
		job: "Scheduling",
		Icon: SiGooglecalendar,
		color: "#4285F4",
		pos: "left-[34%] top-[66%] rotate-2",
	},
	{
		job: "Email threads",
		Icon: SiGmail,
		color: "#EA4335",
		pos: "left-[8%] top-[76%] rotate-3",
	},
];

// The unified surface, abstracted as skeleton so it reads as "one product" without
// pretending to be a screenshot. `active` marks the highlighted module.
const railModules = [
	{ Icon: MessageSquare, active: false },
	{ Icon: LayoutDashboard, active: true },
	{ Icon: FileText, active: false },
	{ Icon: Calendar, active: false },
	{ Icon: PenLine, active: false },
	{ Icon: BarChart3, active: false },
];

// One tile in the unified dashboard — a labeled module widget. `ai` swaps the
// accent to the magenta secondary (Proddy's AI garnish).
const DashTile = ({
	icon: Icon,
	label,
	badge,
	ai,
	className,
	children,
}: {
	icon: LucideIcon;
	label: string;
	badge?: string;
	ai?: boolean;
	className?: string;
	children: React.ReactNode;
}) => (
	<div
		className={cn(
			"flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-2.5 shadow-sm",
			className
		)}
	>
		<div className="flex items-center gap-1.5">
			<span
				className={cn(
					"grid size-5 shrink-0 place-items-center rounded-md",
					ai ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
				)}
			>
				<Icon className="size-3" />
			</span>
			<span className="truncate text-[11px] font-semibold text-foreground">
				{label}
			</span>
			{badge ? (
				<span className="ml-auto rounded-full bg-secondary/10 px-1.5 text-[9px] font-semibold text-secondary">
					{badge}
				</span>
			) : null}
		</div>
		<div className="min-h-0 flex-1">{children}</div>
	</div>
);

// Skeleton line used throughout the dashboard widgets.
const Bar = ({ w, className }: { w: string; className?: string }) => (
	<div
		className={cn("h-1.5 rounded-full bg-foreground/10", className)}
		style={{ width: w }}
	/>
);

const comparisons = [
	{
		title: "Tool management",
		traditional: "Five apps, five logins, five bills.",
		proddy: "One workspace, one login.",
	},
	{
		title: "Context switching",
		traditional: "Constant app-hopping breaks focus.",
		proddy: "Talk and do in the same place.",
	},
	{
		title: "Learning curve",
		traditional: "A new interface to learn per tool.",
		proddy: "One grammar across every module.",
	},
];

export const ComparisonSection = () => {
	const sectionRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);
	const isInView = useInView(sectionRef, { once: true, margin: "-100px 0px" });
	const shouldReduceMotion = useReducedMotion();

	// Init is deterministic (independent of shouldReduceMotion) so the SSR-rendered
	// clip-path/left match the first client render; reduced motion is applied in the
	// effect below to avoid a hydration mismatch.
	const pos = useMotionValue(START);
	const smooth = useSpring(pos, { stiffness: 240, damping: 30, mass: 0.5 });
	const revealRight = useTransform(smooth, (p) => `${100 - p}%`);
	const clipPath = useMotionTemplate`inset(0 ${revealRight} 0 0)`;
	const dividerLeft = useMotionTemplate`${smooth}%`;

	const [ariaValue, setAriaValue] = useState(() => Math.round(pos.get()));
	const [hasInteracted, setHasInteracted] = useState(false);

	useEffect(() => pos.on("change", (v) => setAriaValue(Math.round(v))), [pos]);

	// Cinematic reveal: the divider sweeps from the cluttered "before" to the
	// settle point, demonstrating five tools collapsing into one on scroll-in.
	// Reduced motion jumps straight to a balanced 50/50 with no animation.
	useEffect(() => {
		if (!isInView) return;
		if (shouldReduceMotion) {
			pos.set(50);
			smooth.jump(50);
			return;
		}
		const controls = animate(pos, SETTLE, {
			delay: 0.35,
			duration: 1.1,
			ease: [0.16, 1, 0.3, 1],
		});
		return () => controls.stop();
	}, [isInView, shouldReduceMotion, pos, smooth]);

	const setFromClientX = useCallback(
		(clientX: number) => {
			const el = panelRef.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			const pct = ((clientX - rect.left) / rect.width) * 100;
			pos.set(Math.min(MAX, Math.max(MIN, pct)));
		},
		[pos]
	);

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		draggingRef.current = true;
		setHasInteracted(true);
		e.currentTarget.setPointerCapture?.(e.pointerId);
		setFromClientX(e.clientX);
	};

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!draggingRef.current) return;
		setFromClientX(e.clientX);
	};

	const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		draggingRef.current = false;
		e.currentTarget.releasePointerCapture?.(e.pointerId);
	};

	const nudge = (delta: number) => {
		setHasInteracted(true);
		pos.set(Math.min(MAX, Math.max(MIN, pos.get() + delta)));
	};

	const onHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		switch (e.key) {
			case "ArrowLeft":
			case "ArrowDown":
				e.preventDefault();
				nudge(-4);
				break;
			case "ArrowRight":
			case "ArrowUp":
				e.preventDefault();
				nudge(4);
				break;
			case "PageDown":
				e.preventDefault();
				nudge(-12);
				break;
			case "PageUp":
				e.preventDefault();
				nudge(12);
				break;
			case "Home":
				e.preventDefault();
				setHasInteracted(true);
				pos.set(MIN);
				break;
			case "End":
				e.preventDefault();
				setHasInteracted(true);
				pos.set(MAX);
				break;
			default:
				break;
		}
	};

	return (
		<section
			className="py-16 md:py-24 bg-background relative overflow-hidden w-full"
			id="why-proddy"
			ref={sectionRef}
		>
			<div className="w-full px-6 md:px-8 relative z-10">
				<div className="max-w-7xl mx-auto">
					<div className="max-w-2xl mb-10">
						<m.h2
							animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
							className="text-3xl md:text-4xl font-bold tracking-tight text-foreground text-balance"
							initial={{ opacity: 0, y: 12 }}
							transition={{
								duration: shouldReduceMotion ? 0 : 0.35,
								delay: 0.05,
							}}
						>
							Five tools become <span className="text-primary">one</span>
						</m.h2>
						<m.p
							animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
							className="mt-3 text-lg text-muted-foreground text-pretty"
							initial={{ opacity: 0, y: 12 }}
							transition={{
								duration: shouldReduceMotion ? 0 : 0.35,
								delay: 0.1,
							}}
						>
							Messaging, docs, tasks, boards, meetings, and more — replaced by a
							single workspace. Drag the divider to see the difference.
						</m.p>
					</div>

					{/* Split-reveal: drag to wipe from the scattered "before" to Proddy. */}
					<m.div
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
						className="relative w-full h-[440px] md:h-[520px] overflow-hidden rounded-2xl border bg-card shadow-lg cursor-ew-resize touch-none select-none"
						initial={{ opacity: 0, y: 16 }}
						onPointerCancel={endDrag}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={endDrag}
						ref={panelRef}
						transition={{ duration: shouldReduceMotion ? 0 : 0.4, delay: 0.15 }}
					>
						{/* AFTER — the unified Proddy surface (base layer, always full width). */}
						<div className="absolute inset-0 flex flex-col bg-card">
							<div className="flex items-center gap-2 h-11 px-4 border-b shrink-0">
								<div className="size-2.5 rounded-full bg-primary" />
								<span className="text-sm font-semibold text-foreground">
									Proddy
								</span>
							</div>
							<div className="flex flex-1 min-h-0">
								<div className="w-14 shrink-0 border-r flex flex-col items-center gap-2 py-3">
									{railModules.map((mod, i) => (
										<div
											className={cn(
												"size-8 rounded-lg grid place-items-center",
												mod.active
													? "bg-primary text-primary-foreground shadow-sm"
													: "bg-muted text-muted-foreground"
											)}
											key={`rail-${i}`}
										>
											<mod.Icon className="size-4" />
										</div>
									))}
								</div>
								{/* One dashboard, every module — a compact bento of Proddy's
									surfaces so the payoff reads as "everything in one place". */}
								<div className="grid min-w-0 flex-1 grid-cols-3 grid-rows-3 gap-2.5 bg-muted/30 p-3">
									<DashTile badge="3" icon={MessageSquare} label="Messages">
										<div className="space-y-2">
											{["72%", "58%"].map((w) => (
												<div className="flex items-center gap-1.5" key={w}>
													<div className="size-4 shrink-0 rounded-full bg-primary/15" />
													<div className="flex-1 space-y-1">
														<Bar w={w} />
														<Bar w="42%" />
													</div>
												</div>
											))}
										</div>
									</DashTile>

									<DashTile icon={LayoutDashboard} label="Tasks">
										<div className="space-y-2">
											{[
												{ c: "bg-muted-foreground/40", w: "78%" },
												{ c: "bg-primary", w: "64%" },
												{ c: "bg-success", w: "70%", done: true },
											].map((t) => (
												<div className="flex items-center gap-1.5" key={t.w}>
													<span
														className={cn("size-2 shrink-0 rounded-full", t.c)}
													/>
													<Bar className="flex-1" w={t.w} />
													{t.done ? (
														<Check className="size-3 shrink-0 text-success" />
													) : null}
												</div>
											))}
										</div>
									</DashTile>

									<DashTile icon={Calendar} label="Today">
										<div className="space-y-2">
											{[
												{ t: "9:00", c: "bg-chart-3/25" },
												{ t: "13:30", c: "bg-chart-2/30" },
											].map((e) => (
												<div className="flex items-center gap-1.5" key={e.t}>
													<span className="w-8 shrink-0 text-[9px] font-medium tabular-nums text-muted-foreground">
														{e.t}
													</span>
													<div className={cn("h-3.5 flex-1 rounded-md", e.c)} />
												</div>
											))}
										</div>
									</DashTile>

									<DashTile
										ai
										className="col-span-2"
										icon={Sparkles}
										label="AI Assistant"
									>
										<div className="flex h-full flex-col justify-center gap-1.5 rounded-lg border border-secondary/15 bg-secondary/5 p-2.5">
											<div className="flex items-center gap-1.5">
												<Sparkles className="size-3 shrink-0 text-secondary" />
												<Bar className="bg-secondary/30" w="52%" />
											</div>
											<Bar className="bg-secondary/15" w="82%" />
										</div>
									</DashTile>

									<DashTile icon={BarChart3} label="Activity">
										<div className="flex h-full items-end gap-1 pt-1">
											{[45, 70, 52, 88, 60, 96].map((h) => (
												<div
													className="flex-1 rounded-sm bg-primary/25"
													key={h}
													style={{ height: `${h}%` }}
												/>
											))}
										</div>
									</DashTile>

									<DashTile icon={FileText} label="Notes">
										<div className="space-y-1.5">
											{["88%", "76%", "60%"].map((w) => (
												<Bar key={w} w={w} />
											))}
										</div>
									</DashTile>

									<DashTile icon={Video} label="Meetings">
										<div className="flex h-full items-center gap-2">
											<div className="flex -space-x-1.5">
												{[
													"bg-primary/25",
													"bg-chart-2/40",
													"bg-chart-4/40",
												].map((c) => (
													<span
														className={cn(
															"size-5 rounded-full border-2 border-card",
															c
														)}
														key={c}
													/>
												))}
											</div>
											<span className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
												<span className="size-1.5 rounded-full bg-destructive" />
												Live
											</span>
										</div>
									</DashTile>

									<DashTile icon={PenLine} label="Canvas">
										<div className="flex h-full items-center gap-1.5">
											<span className="size-6 rounded-md bg-chart-3/20" />
											<span className="size-6 rounded-full bg-chart-5/20" />
											<span className="h-1 flex-1 rounded-full bg-chart-4/30" />
										</div>
									</DashTile>
								</div>
							</div>
						</div>

						{/* BEFORE — scattered, disconnected tools (clipped to the left of the divider). */}
						<m.div
							className="absolute inset-0 bg-muted overflow-hidden"
							style={{ clipPath }}
						>
							<svg
								aria-hidden="true"
								className="absolute inset-0 size-full text-muted-foreground/25"
								preserveAspectRatio="none"
							>
								<title>Disconnected tools</title>
								{[
									["10%", "13%", "34%", "10%"],
									["34%", "10%", "20%", "28%"],
									["20%", "28%", "46%", "24%"],
									["20%", "28%", "12%", "42%"],
									["12%", "42%", "32%", "44%"],
									["32%", "44%", "50%", "50%"],
									["14%", "62%", "38%", "70%"],
									["38%", "70%", "12%", "80%"],
								].map(([x1, y1, x2, y2]) => (
									<line
										key={`${x1}-${y1}-${x2}-${y2}`}
										stroke="currentColor"
										strokeDasharray="4 6"
										strokeWidth="1.5"
										x1={x1}
										x2={x2}
										y1={y1}
										y2={y2}
									/>
								))}
							</svg>

							{legacyTools.map((tool) => (
								<div
									className={cn(
										"absolute items-center gap-2 rounded-lg border border-dashed border-border bg-card/95 px-2.5 py-1.5 shadow-sm",
										tool.hideOnMobile ? "hidden sm:flex" : "flex",
										tool.pos
									)}
									key={tool.job}
								>
									<tool.Icon
										className="size-4 shrink-0"
										style={{ color: tool.color }}
									/>
									<span className="text-xs font-medium text-foreground whitespace-nowrap">
										{tool.job}
									</span>
									<Lock
										aria-hidden="true"
										className="size-3 shrink-0 text-muted-foreground/60"
									/>
								</div>
							))}
						</m.div>

						{/* Divider + drag handle. */}
						<m.div
							className="absolute inset-y-0 w-px -translate-x-1/2 bg-primary/70 pointer-events-none"
							style={{ left: dividerLeft }}
						>
							<button
								aria-label="Drag to compare traditional tools with Proddy"
								aria-valuemax={100}
								aria-valuemin={0}
								aria-valuenow={ariaValue}
								className="pointer-events-auto absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-primary bg-card text-primary shadow-lg cursor-ew-resize transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								onKeyDown={onHandleKeyDown}
								role="slider"
								type="button"
							>
								{!hasInteracted && !shouldReduceMotion && isInView && (
									<span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
								)}
								<GripVertical className="size-5 relative" />
							</button>
						</m.div>
					</m.div>

					<p className="mt-3 text-sm text-muted-foreground">
						Drag the divider — or focus it and use the arrow keys.
					</p>

					<div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
						{comparisons.map((item, index) => (
							<m.div
								animate={
									isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
								}
								className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
								initial={{ opacity: 0, y: 12 }}
								key={item.title}
								transition={{
									duration: shouldReduceMotion ? 0 : 0.35,
									delay: 0.15 + index * 0.06,
								}}
							>
								<div className="text-sm font-semibold text-foreground mb-3">
									{item.title}
								</div>
								<div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
									<X className="size-4 text-destructive mt-0.5 shrink-0" />
									<span>{item.traditional}</span>
								</div>
								<div className="flex items-start gap-2 text-sm text-foreground">
									<Check className="size-4 text-success mt-0.5 shrink-0" />
									<span className="font-medium">{item.proddy}</span>
								</div>
							</m.div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
