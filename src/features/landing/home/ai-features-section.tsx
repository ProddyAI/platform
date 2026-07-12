"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import {
	Check,
	FileAudio,
	ListChecks,
	ListPlus,
	MessagesSquare,
	Mic,
	NotebookPen,
	Reply,
	Search,
	Sunrise,
	Waypoints,
	Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Signal-thread choreography
 *
 * When the section scrolls into view a single "signal" travels a thread
 * that connects four AI tools. As the pulse reaches each node, that node
 * lights up and its card runs a live micro-demo — showing the tool doing
 * real work rather than describing it. Every timing derives from the two
 * constants below so the rail, the node glow, and the demo stay in sync.
 * ------------------------------------------------------------------ */

const START = 0.2; // seconds before the signal leaves the first node
const TRAVEL = 2.2; // seconds for the signal to cross the whole thread

// Delay at which node `i` of `count` lights up (0-indexed).
const nodeDelay = (i: number, count: number) =>
	START + (i / (count - 1)) * TRAVEL;

type ToolKey = "reply" | "meeting" | "diagram" | "notes";

interface Tool {
	key: ToolKey;
	title: string;
	description: string;
	icon: React.ReactNode;
}

const TOOLS: Tool[] = [
	{
		key: "reply",
		title: "Reply Suggestions",
		description:
			"AI reads the conversation and drafts a reply in your voice — respond in one tap instead of one paragraph.",
		icon: <Reply className="size-4" />,
	},
	{
		key: "meeting",
		title: "Meeting Summaries",
		description:
			"Records and transcribes your call, then hands back a summary, the decisions, and action items you can turn into tasks.",
		icon: <FileAudio className="size-4" />,
	},
	{
		key: "diagram",
		title: "Text to Diagram",
		description:
			"Describe a flow in plain words and watch it become a clean, editable diagram — no dragging boxes around.",
		icon: <Workflow className="size-4" />,
	},
	{
		key: "notes",
		title: "Notes Formatter",
		description:
			"Drop in raw meeting notes and get back structured headings, bullets, and extracted action items.",
		icon: <ListChecks className="size-4" />,
	},
];

// Tier 2 — the rest of the AI woven through the workspace. Same signal wave,
// compact treatment: icon + name + one line, no bespoke demo stage.
interface MoreTool {
	title: string;
	description: string;
	icon: React.ReactNode;
}

const MORE_TOOLS: MoreTool[] = [
	{
		title: "Daily Recap",
		description:
			"A morning digest of what moved while you were away — messages, decisions, and what's due — waiting on your dashboard.",
		icon: <Sunrise className="size-4" />,
	},
	{
		title: "AI Search",
		description:
			"Ask a question in plain English and get one answer pulled from messages, notes, tasks, and events — with its sources.",
		icon: <Search className="size-4" />,
	},
	{
		title: "Task Drafting",
		description:
			"Describe work in a sentence and AI drafts the task — title, assignee, priority, and due date already filled in.",
		icon: <ListPlus className="size-4" />,
	},
	{
		title: "Blocker Analysis",
		description:
			"Spots blocked issues, suggests the dependency links behind them, and lays out the steps to clear the path.",
		icon: <Waypoints className="size-4" />,
	},
	{
		title: "Chat to Notes",
		description:
			"Roll a channel's conversation over any time range into clean, structured notes — nothing to copy or paste.",
		icon: <NotebookPen className="size-4" />,
	},
	{
		title: "Channel Summaries",
		description:
			"Catch up on a busy channel in a tap with a tight summary of everything you missed while you were away.",
		icon: <MessagesSquare className="size-4" />,
	},
];

/* ------------------------------------------------------------------ *
 * Hooks
 * ------------------------------------------------------------------ */

// Flips true `delaySec` after `active` becomes true — the latch that keeps
// the node lit and the demo playing once the signal has passed.
function useDelayedActive(active: boolean, delaySec: number, reduced: boolean) {
	const [on, setOn] = useState(false);
	useEffect(() => {
		if (!active) {
			setOn(false);
			return;
		}
		if (reduced) {
			setOn(true);
			return;
		}
		const id = setTimeout(() => setOn(true), delaySec * 1000);
		return () => clearTimeout(id);
	}, [active, delaySec, reduced]);
	return on;
}

// Reveals `text` character-by-character once `active`. Reduced motion and
// inactive states resolve to the full string / empty string respectively.
function useTypewriter(
	text: string,
	active: boolean,
	reduced: boolean,
	speed = 32
) {
	const [count, setCount] = useState(0);
	useEffect(() => {
		if (!active) {
			setCount(0);
			return;
		}
		if (reduced) {
			setCount(text.length);
			return;
		}
		setCount(0);
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setCount(i);
			if (i >= text.length) clearInterval(id);
		}, speed);
		return () => clearInterval(id);
	}, [active, reduced, text, speed]);
	return { shown: text.slice(0, count), done: count >= text.length };
}

/* ------------------------------------------------------------------ *
 * Micro-demos — each shows its tool doing real work
 * ------------------------------------------------------------------ */

const demoTransition = (delay: number, reduced: boolean) => ({
	duration: reduced ? 0 : 0.4,
	delay: reduced ? 0 : delay,
	ease: [0.22, 1, 0.36, 1] as const, // ease-out-quint
});

function ReplyDemo({ active, reduced }: { active: boolean; reduced: boolean }) {
	const reply = "On it — sending the Q3 deck now.";
	const { shown, done } = useTypewriter(reply, active, reduced, 28);

	return (
		<div className="flex h-full flex-col justify-center gap-2.5">
			<m.div
				animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
				className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs leading-snug text-foreground"
				initial={{ opacity: 0, y: reduced ? 0 : 6 }}
				transition={demoTransition(0.05, reduced)}
			>
				Can you share the Q3 deck before the sync?
			</m.div>

			<m.div
				animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
				className="max-w-[90%] self-end"
				initial={{ opacity: 0, y: reduced ? 0 : 6 }}
				transition={demoTransition(0.35, reduced)}
			>
				<span className="mb-1 block text-right text-[10px] font-medium uppercase tracking-wide text-primary">
					Suggested reply
				</span>
				<div className="rounded-2xl rounded-tr-sm border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-snug text-foreground">
					{shown}
					{active && !done && !reduced ? (
						<span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-primary align-middle" />
					) : null}
				</div>
			</m.div>
		</div>
	);
}

// Deterministic "waveform" heights so the render is stable (no Math.random).
const WAVE = [
	0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.45, 0.65, 0.85, 0.4, 0.7, 0.95, 0.55, 0.8,
	0.5, 0.9, 0.6, 0.4,
];

function MeetingDemo({
	active,
	reduced,
}: {
	active: boolean;
	reduced: boolean;
}) {
	return (
		<div className="flex h-full flex-col justify-center gap-2.5">
			{/* transcription: a live waveform being captured */}
			<div className="flex items-center gap-2">
				<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
					<Mic className="size-3" />
				</span>
				<div className="flex h-5 flex-1 items-center gap-[3px]">
					{WAVE.map((h, i) => (
						<m.span
							animate={
								active && !reduced
									? { scaleY: [h * 0.5, h, h * 0.6, h * 0.95, h * 0.5] }
									: { scaleY: reduced ? h : 0.3 }
							}
							className="h-4 w-[3px] shrink-0 origin-center rounded-full bg-primary/40"
							key={i}
							transition={
								active && !reduced
									? {
											duration: 1.1,
											repeat: Number.POSITIVE_INFINITY,
											ease: "easeInOut",
											delay: (i % 6) * 0.09,
										}
									: { duration: 0 }
							}
						/>
					))}
				</div>
			</div>

			{/* the generated summary + an extracted action item */}
			<m.div
				animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
				className="rounded-lg border border-border/60 bg-card p-2.5"
				initial={{ opacity: 0, y: reduced ? 0 : 6 }}
				transition={demoTransition(0.45, reduced)}
			>
				<span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-primary">
					Summary
				</span>
				<div className="space-y-1">
					<span className="block h-1.5 w-full rounded-full bg-muted-foreground/25" />
					<span className="block h-1.5 w-3/4 rounded-full bg-muted-foreground/25" />
				</div>
				<div className="mt-2 flex items-center gap-1.5">
					<span className="flex size-3.5 shrink-0 items-center justify-center rounded-[4px] bg-success/15 text-success">
						<Check className="size-2.5" strokeWidth={3} />
					</span>
					<span className="truncate text-[11px] text-foreground">
						Send the recap to the team
					</span>
				</div>
			</m.div>
		</div>
	);
}

function DiagramDemo({
	active,
	reduced,
}: {
	active: boolean;
	reduced: boolean;
}) {
	const nodes = [
		{ x: 4, label: "Idea" },
		{ x: 74, label: "Draft" },
		{ x: 144, label: "Ship" },
	];

	return (
		<div className="flex h-full items-center justify-center">
			<svg
				aria-hidden
				className="w-full max-w-[220px]"
				fill="none"
				viewBox="0 0 200 60"
			>
				<title>Text turning into a flow diagram</title>
				{/* connectors draw first-node → last-node */}
				{[64, 134].map((cx, i) => (
					<m.line
						animate={
							active ? { strokeDashoffset: 0 } : { strokeDashoffset: 12 }
						}
						initial={{ strokeDashoffset: reduced ? 0 : 12 }}
						key={cx}
						stroke="hsl(var(--primary))"
						strokeDasharray="12"
						strokeLinecap="round"
						strokeWidth="1.75"
						transition={{
							duration: reduced ? 0 : 0.3,
							delay: reduced ? 0 : 0.4 + i * 0.4,
							ease: "easeInOut",
						}}
						x1={cx}
						x2={cx + 10}
						y1={30}
						y2={30}
					/>
				))}
				{nodes.map((node, i) => (
					<m.g
						animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
						initial={{ opacity: 0, y: reduced ? 0 : 6 }}
						key={node.label}
						transition={demoTransition(0.15 + i * 0.4, reduced)}
					>
						<rect
							fill="hsl(var(--card))"
							height={28}
							rx={7}
							stroke="hsl(var(--primary))"
							strokeWidth="1.5"
							width={52}
							x={node.x}
							y={16}
						/>
						<text
							fill="hsl(var(--primary))"
							fontSize="11"
							fontWeight="600"
							textAnchor="middle"
							x={node.x + 26}
							y={34}
						>
							{node.label}
						</text>
					</m.g>
				))}
			</svg>
		</div>
	);
}

function NotesDemo({ active, reduced }: { active: boolean; reduced: boolean }) {
	const items = ["Fix onboarding bug", "Ship billing v2", "Review PR #184"];

	return (
		<div className="relative flex h-full flex-col justify-center gap-2">
			{/* raw, unstructured lines that dissolve as structure takes over */}
			<m.div
				animate={active ? { opacity: 0 } : { opacity: 0.7 }}
				className="pointer-events-none absolute inset-x-0 top-1 space-y-1.5"
				initial={{ opacity: reduced ? 0 : 0.7 }}
				transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : 0.25 }}
			>
				<span className="block h-1.5 w-11/12 rounded-full bg-muted-foreground/25" />
				<span className="block h-1.5 w-4/5 rounded-full bg-muted-foreground/25" />
				<span className="block h-1.5 w-2/3 rounded-full bg-muted-foreground/25" />
			</m.div>

			<m.p
				animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
				className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
				initial={{ opacity: 0, y: reduced ? 0 : 6 }}
				transition={demoTransition(0.3, reduced)}
			>
				Standup · Action items
			</m.p>
			{items.map((item, i) => (
				<m.div
					animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
					className="flex items-center gap-2"
					initial={{ opacity: 0, y: reduced ? 0 : 6 }}
					key={item}
					transition={demoTransition(0.42 + i * 0.14, reduced)}
				>
					<span className="flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-success/15 text-success">
						<Check className="size-3" strokeWidth={3} />
					</span>
					<span className="truncate text-xs text-foreground">{item}</span>
				</m.div>
			))}
		</div>
	);
}

const DEMOS: Record<
	ToolKey,
	(props: { active: boolean; reduced: boolean }) => React.ReactNode
> = {
	reply: ReplyDemo,
	meeting: MeetingDemo,
	diagram: DiagramDemo,
	notes: NotesDemo,
};

/* ------------------------------------------------------------------ *
 * Node dot — the point on the thread that lights when the signal arrives
 * ------------------------------------------------------------------ */

function NodeDot({ lit }: { lit: boolean }) {
	return (
		<span className="relative flex size-4 items-center justify-center">
			<span
				className={cn(
					"absolute inset-0 rounded-full bg-primary/30 blur-[2px]",
					lit ? "scale-150 opacity-100" : "scale-0 opacity-0"
				)}
				style={{
					transition: "transform 300ms ease-out, opacity 300ms ease-out",
				}}
			/>
			<span
				className={cn(
					"relative size-2.5 rounded-full border",
					lit
						? "border-transparent bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15),0_0_14px_hsl(var(--primary)/0.5)]"
						: "border-border bg-card"
				)}
				style={{
					transition:
						"background-color 250ms ease-out, box-shadow 250ms ease-out, border-color 250ms ease-out",
				}}
			/>
		</span>
	);
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

function ToolCard({
	tool,
	active,
	reduced,
	delay,
}: {
	tool: Tool;
	active: boolean;
	reduced: boolean;
	delay: number;
}) {
	const lit = useDelayedActive(active, delay, reduced);
	const Demo = DEMOS[tool.key];

	return (
		<m.article
			animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
			className={cn(
				"group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5",
				"transition-[box-shadow,border-color,transform] duration-300 ease-out",
				"hover:-translate-y-1 hover:shadow-lg",
				lit ? "border-primary/30 shadow-md" : "border-border shadow-sm"
			)}
			initial={{ opacity: 0, y: reduced ? 0 : 16 }}
			transition={{
				duration: reduced ? 0 : 0.45,
				delay: reduced ? 0 : Math.max(0, delay - 0.15),
				ease: [0.22, 1, 0.36, 1],
			}}
		>
			{/* header: icon + title */}
			<div className="mb-3 flex items-center gap-2.5">
				<span
					className={cn(
						"flex size-8 items-center justify-center rounded-lg",
						lit
							? "bg-primary/10 text-primary"
							: "bg-muted text-muted-foreground",
						"transition-colors duration-300"
					)}
				>
					{tool.icon}
				</span>
				<h3 className="text-sm font-semibold text-foreground">{tool.title}</h3>
			</div>

			{/* live demo stage — fixed height so the card never reflows */}
			<div
				aria-hidden
				className="mb-3 h-32 rounded-xl border border-border/60 bg-muted/30 p-3"
			>
				<Demo active={lit} reduced={reduced} />
			</div>

			<p className="text-xs leading-relaxed text-muted-foreground">
				{tool.description}
			</p>
		</m.article>
	);
}

// Compact Tier-2 card. Reveals on the same wave; the icon chip lights when
// the signal reaches it, echoing the thread without a full demo stage.
function MoreToolCard({
	tool,
	active,
	reduced,
	delay,
}: {
	tool: MoreTool;
	active: boolean;
	reduced: boolean;
	delay: number;
}) {
	const lit = useDelayedActive(active, delay, reduced);

	return (
		<m.article
			animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
			className={cn(
				"group flex items-start gap-3.5 rounded-xl border bg-card p-4 shadow-sm",
				"transition-[box-shadow,border-color,transform] duration-300 ease-out",
				"hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
				lit ? "border-primary/20" : "border-border"
			)}
			initial={{ opacity: 0, y: reduced ? 0 : 16 }}
			transition={{
				duration: reduced ? 0 : 0.45,
				delay: reduced ? 0 : delay,
				ease: [0.22, 1, 0.36, 1],
			}}
		>
			<span
				className={cn(
					"flex size-9 shrink-0 items-center justify-center rounded-lg",
					"transition-[color,background-color,box-shadow] duration-300",
					lit
						? "bg-primary/10 text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
						: "bg-muted text-muted-foreground"
				)}
			>
				{tool.icon}
			</span>
			<div className="min-w-0">
				<h4 className="text-sm font-semibold text-foreground">{tool.title}</h4>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					{tool.description}
				</p>
			</div>
		</m.article>
	);
}

/* ------------------------------------------------------------------ *
 * Section
 * ------------------------------------------------------------------ */

export const AIFeaturesSection = () => {
	const sectionRef = useRef<HTMLDivElement>(null);
	const isActive = useInView(sectionRef, { once: true, margin: "-120px 0px" });
	const reduced = useReducedMotion() ?? false;
	const count = TOOLS.length;

	// Signal is "present" once it has left the first node (reduced motion
	// resolves everything immediately).
	const signalOn = reduced ? true : isActive;

	// Tier-2 grid gets its own in-view trigger so its reveal wave fires when
	// the reader reaches it, independent of the thread's travel timing.
	const moreRef = useRef<HTMLDivElement>(null);
	const moreInView = useInView(moreRef, { once: true, margin: "-80px 0px" });
	const moreOn = reduced ? true : moreInView;

	return (
		<section
			className="relative overflow-hidden bg-background py-16 md:py-24"
			ref={sectionRef}
		>
			<div className="container relative z-10 mx-auto max-w-7xl px-6 md:px-8">
				{/* Header */}
				<div className="mb-14 text-center">
					<m.h2
						animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
						className="text-3xl font-bold tracking-tight text-foreground text-balance md:text-4xl"
						initial={{ opacity: 0, y: reduced ? 0 : 12 }}
						transition={{ duration: 0.4, delay: 0.05 }}
					>
						AI Tools That{" "}
						<span className="text-primary">Handle the Busywork</span>
					</m.h2>
					<m.p
						animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
						className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground"
						initial={{ opacity: 0, y: reduced ? 0 : 12 }}
						transition={{ duration: 0.4, delay: 0.12 }}
					>
						One signal runs through your workspace — watch each tool pick up the
						busywork as it reaches it.
					</m.p>
				</div>

				{/* ---------- Desktop: horizontal thread + row of nodes ---------- */}
				<div className="hidden lg:block">
					{/* Thread rail. Endpoints land on the outer card centres:
						 half a column (12.5%) minus half the 24px grid gap (9px). */}
					<div className="relative mb-6 h-4">
						<div
							className="absolute top-1/2 h-px -translate-y-1/2 bg-border"
							style={{
								left: "calc(12.5% - 9px)",
								right: "calc(12.5% - 9px)",
							}}
						>
							{/* travelling fill */}
							<m.div
								animate={signalOn ? { scaleX: 1 } : { scaleX: 0 }}
								className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-primary/60 to-primary"
								initial={{ scaleX: reduced ? 1 : 0 }}
								transition={{
									duration: reduced ? 0 : TRAVEL,
									delay: reduced ? 0 : START,
									ease: "linear",
								}}
							/>
							{/* glowing pulse head riding the leading edge */}
							{!reduced && (
								<m.span
									animate={
										isActive ? { left: "100%", opacity: [0, 1, 1, 0] } : {}
									}
									className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary shadow-[0_0_12px_4px_hsl(var(--secondary)/0.6)]"
									initial={{ left: "0%", opacity: 0 }}
									transition={{
										duration: TRAVEL,
										delay: START,
										ease: "linear",
										opacity: { times: [0, 0.04, 0.92, 1], duration: TRAVEL },
									}}
								/>
							)}
						</div>

						{/* node dots, one centred per column */}
						<div className="absolute inset-0 grid grid-cols-4 gap-6">
							{TOOLS.map((tool, i) => (
								<div
									className="flex items-center justify-center"
									key={tool.key}
								>
									<NodeDelayedDot
										active={signalOn}
										delay={nodeDelay(i, count)}
										reduced={reduced}
									/>
								</div>
							))}
						</div>
					</div>

					<div className="grid grid-cols-4 gap-6">
						{TOOLS.map((tool, i) => (
							<ToolCard
								active={signalOn}
								delay={nodeDelay(i, count)}
								key={tool.key}
								reduced={reduced}
								tool={tool}
							/>
						))}
					</div>
				</div>

				{/* ---------- Mobile / tablet: vertical thread ---------- */}
				<div className="relative lg:hidden">
					{/* vertical rail in the left gutter */}
					<div className="absolute bottom-4 left-[7px] top-4 w-px bg-border">
						<m.div
							animate={signalOn ? { scaleY: 1 } : { scaleY: 0 }}
							className="absolute inset-x-0 top-0 h-full origin-top bg-gradient-to-b from-primary/60 to-primary"
							initial={{ scaleY: reduced ? 1 : 0 }}
							transition={{
								duration: reduced ? 0 : TRAVEL,
								delay: reduced ? 0 : START,
								ease: "linear",
							}}
						/>
					</div>

					<div className="space-y-5">
						{TOOLS.map((tool, i) => (
							<div className="flex gap-4" key={tool.key}>
								<div className="relative z-10 mt-5 shrink-0">
									<NodeDelayedDot
										active={signalOn}
										delay={nodeDelay(i, count)}
										reduced={reduced}
									/>
								</div>
								<div className="min-w-0 flex-1">
									<ToolCard
										active={signalOn}
										delay={nodeDelay(i, count)}
										reduced={reduced}
										tool={tool}
									/>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* ---------- Tier 2: the rest of the AI, everywhere ---------- */}
				<div className="mt-16 md:mt-20" ref={moreRef}>
					<div className="mb-8 flex items-center gap-4">
						<h3 className="shrink-0 text-lg font-semibold text-foreground">
							More AI, woven through your workspace
						</h3>
						<span className="h-px flex-1 bg-border" />
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{MORE_TOOLS.map((tool, i) => (
							<MoreToolCard
								active={moreOn}
								delay={0.08 + i * 0.07}
								key={tool.title}
								reduced={reduced}
								tool={tool}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};

// Small wrapper that lights a NodeDot on the shared node schedule.
function NodeDelayedDot({
	active,
	delay,
	reduced,
}: {
	active: boolean;
	delay: number;
	reduced: boolean;
}) {
	const lit = useDelayedActive(active, delay, reduced);
	return <NodeDot lit={lit} />;
}
