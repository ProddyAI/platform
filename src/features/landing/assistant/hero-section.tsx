"use client";

import {
	m,
	useInView,
	useReducedMotion,
	useScroll,
	useTransform,
} from "framer-motion";
import {
	ArrowRight,
	Bot,
	Calendar,
	Check,
	CheckSquare,
	FileText,
	LayoutGrid,
	Loader2,
	Lock,
	MessageSquare,
	MessagesSquare,
	Send,
	Sparkles,
	Zap,
} from "lucide-react";
import Link from "next/link";
import {
	Fragment,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Icon = typeof Bot;
type ToolState = "pending" | "active" | "done";

type Segment = { t: string; b?: boolean; br?: number };
type Unit = { text: string; bold: boolean; brAfter: number; space: boolean };

type Scenario = {
	question: string;
	tools: { icon: Icon; label: string }[];
	answer: Segment[];
	citations: { icon: Icon; label: string }[];
	units: Unit[];
};

/** Expand answer segments into stream-able word/space units that keep bold + line-break metadata. */
function expand(answer: Segment[]): Unit[] {
	const units: Unit[] = [];
	for (const seg of answer) {
		const parts = seg.t.split(/(\s+)/).filter((p) => p.length > 0);
		parts.forEach((p, i) => {
			units.push({
				text: p,
				bold: Boolean(seg.b),
				brAfter: i === parts.length - 1 ? (seg.br ?? 0) : 0,
				space: /^\s+$/.test(p),
			});
		});
	}
	return units;
}

const RAW_SCENARIOS: Omit<Scenario, "units">[] = [
	{
		question: "How's my day looking?",
		tools: [
			{ icon: Calendar, label: "Calendar" },
			{ icon: CheckSquare, label: "Tasks" },
		],
		answer: [
			{ t: "Morning! Here's your day ahead.", br: 2 },
			{ t: "📅 " },
			{ t: "3 meetings", b: true },
			{
				t: " — sprint planning at 10, a 1:1 with Priya at 2, and design review at 4.",
				br: 2,
			},
			{ t: "✅ " },
			{ t: "4 tasks", b: true },
			{ t: " due today · 1 overdue (Update onboarding flow)." },
		],
		citations: [
			{ icon: Calendar, label: "Calendar" },
			{ icon: CheckSquare, label: "Tasks" },
		],
	},
	{
		question: "Summarize #product-launch since yesterday",
		tools: [{ icon: MessageSquare, label: "Messages" }],
		answer: [
			{ t: "14 new messages", b: true },
			{ t: " in the last 24 hours.", br: 2 },
			{
				t: "Priya flagged a blocker on the pricing-page copy, and Marcus confirmed the launch checklist is on track for ",
			},
			{ t: "Friday", b: true },
			{ t: "." },
		],
		citations: [{ icon: MessageSquare, label: "#product-launch" }],
	},
	{
		question: "What's blocking the Canvas release?",
		tools: [
			{ icon: LayoutGrid, label: "Board" },
			{ icon: FileText, label: "Docs" },
		],
		answer: [
			{ t: "Nothing critical.", b: true },
			{ t: " Canvas is " },
			{ t: "85% complete", b: true },
			{
				t: " and in final testing — no open blockers, and design signed off last week.",
				br: 2,
			},
			{ t: "On track to ship " },
			{ t: "Oct 15", b: true },
			{ t: "." },
		],
		citations: [
			{ icon: LayoutGrid, label: "Product Roadmap" },
			{ icon: FileText, label: "Engineering Board" },
		],
	},
	{
		question: "Draft my standup update",
		tools: [{ icon: Sparkles, label: "Drafting" }],
		answer: [
			{ t: "Yesterday:", b: true },
			{
				t: " shipped the onboarding flow and cleared the overdue task.",
				br: 2,
			},
			{ t: "Today:", b: true },
			{ t: " sprint planning, then design review.", br: 2 },
			{ t: "Blockers:", b: true },
			{ t: " none." },
		],
		citations: [
			{ icon: CheckSquare, label: "Tasks" },
			{ icon: Calendar, label: "Calendar" },
		],
	},
];

const SCENARIOS: Scenario[] = RAW_SCENARIOS.map((s) => ({
	...s,
	units: expand(s.answer),
}));

const VALUE_PROPS = [
	{
		icon: Zap,
		title: "Instant answers",
		body: "Grounded responses in seconds — not another search.",
	},
	{
		icon: Lock,
		title: "Private by design",
		body: "Reads only what it needs. Never trained on your data.",
	},
	{
		icon: MessagesSquare,
		title: "Just conversation",
		body: "Ask in plain language. No commands to learn.",
	},
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ToolChip({
	icon: Icon,
	label,
	state,
}: {
	icon: Icon;
	label: string;
	state: ToolState;
}) {
	return (
		<m.span
			animate={{ opacity: 1, y: 0 }}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
				state === "pending"
					? "border-border bg-card text-muted-foreground opacity-60"
					: "border-primary/25 bg-primary/5 text-foreground"
			)}
			initial={{ opacity: 0, y: 6 }}
			transition={{ type: "spring", stiffness: 420, damping: 28 }}
		>
			{state === "active" ? (
				<Loader2 className="size-3 animate-spin text-primary" />
			) : state === "done" ? (
				<Check className="size-3 text-primary" />
			) : (
				<Icon className="size-3" />
			)}
			<span>{label}</span>
		</m.span>
	);
}

/**
 * The streaming demo panel. Isolated from HeroSection so the per-character /
 * per-word setState during playback re-renders ONLY this subtree — not the
 * headline, mesh, or value props. That's what keeps the page from flickering.
 */
function LiveDemo({ reduceMotion }: { reduceMotion: boolean }) {
	const panelRef = useRef<HTMLDivElement>(null);
	const inView = useInView(panelRef, { amount: 0.25 });

	// Initial frame = scenario 0 fully answered (SSR-safe, reduced-motion-safe,
	// never blank). The player takes over on mount.
	const [scenarioIndex, setScenarioIndex] = useState(0);
	const [phase, setPhase] = useState<
		"idle" | "typing" | "sent" | "thinking" | "streaming" | "citations"
	>("citations");
	const [inputText, setInputText] = useState("");
	const [sentQuestion, setSentQuestion] = useState<string | null>(
		SCENARIOS[0].question
	);
	const [toolStates, setToolStates] = useState<ToolState[]>(
		SCENARIOS[0].tools.map(() => "done")
	);
	const [answerCount, setAnswerCount] = useState(SCENARIOS[0].units.length);
	const [showCitations, setShowCitations] = useState(true);
	const [leaving, setLeaving] = useState(false);

	const current = SCENARIOS[scenarioIndex];
	const revealed = current.units.slice(0, answerCount);

	// Live visibility flag so the player pauses off-screen / on hidden tabs.
	const visibleRef = useRef(true);
	useEffect(() => {
		visibleRef.current = inView;
	}, [inView]);

	const cancelledRef = useRef(false);
	useEffect(() => {
		if (reduceMotion) return; // static initial frame stays.
		cancelledRef.current = false;
		const stopped = () => cancelledRef.current;

		const waitVisible = async () => {
			while (!stopped() && (!visibleRef.current || document.hidden)) {
				await sleep(220);
			}
		};

		// Type the next question into the composer while the CURRENT answer stays
		// on screen — no empty panel between turns.
		const typeQuestion = async (q: string) => {
			setPhase("typing");
			for (let i = 1; i <= q.length; i++) {
				if (stopped()) return;
				setInputText(q.slice(0, i));
				await sleep(24 + Math.random() * 46);
			}
		};

		// Think, then stream the answer for the now-active scenario.
		const answer = async (idx: number) => {
			const s = SCENARIOS[idx];

			setPhase("thinking");
			for (let i = 0; i < s.tools.length; i++) {
				if (stopped()) return;
				setToolStates((prev) => prev.map((v, k) => (k === i ? "active" : v)));
				await sleep(380);
			}
			await sleep(280);

			setPhase("streaming");
			const total = s.units.length;
			for (let c = 1; c <= total; c++) {
				if (stopped()) return;
				setAnswerCount(c);
				const doneCount = Math.min(
					s.tools.length,
					Math.ceil((c / total) * s.tools.length)
				);
				setToolStates((prev) =>
					prev.map((v, k) => (k < doneCount ? "done" : v))
				);
				const u = s.units[c - 1];
				await sleep(u.space ? 12 : 24 + Math.random() * 30);
			}
			if (stopped()) return;
			setToolStates(s.tools.map(() => "done"));
			await sleep(340);

			setPhase("citations");
			setShowCitations(true);
		};

		const run = async () => {
			let idx = 0; // scenario 0 is already fully shown.
			while (!stopped()) {
				await waitVisible();
				if (stopped()) return;
				await sleep(2000); // hold the completed answer.
				if (stopped()) return;

				// Type the next question while the current exchange remains visible.
				const next = (idx + 1) % SCENARIOS.length;
				await typeQuestion(SCENARIOS[next].question);
				if (stopped()) return;
				await sleep(280);

				// Send: fade out the old exchange, then swap in the new question.
				setLeaving(true);
				await sleep(300);
				if (stopped()) return;
				idx = next;
				setScenarioIndex(idx);
				setSentQuestion(SCENARIOS[idx].question);
				setInputText("");
				setShowCitations(false);
				setAnswerCount(0);
				setToolStates(SCENARIOS[idx].tools.map(() => "pending"));
				setPhase("sent");
				setLeaving(false);
				await sleep(220);

				await answer(idx);
			}
		};

		run();
		return () => {
			cancelledRef.current = true;
		};
	}, [reduceMotion]);

	const streaming = phase === "streaming";
	// Data-driven so the completed exchange stays on screen while the next
	// question is typed into the composer (phase === "typing").
	const showAiTurn =
		Boolean(sentQuestion) &&
		(phase === "thinking" || answerCount > 0 || showCitations);

	return (
		<div
			className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
			ref={panelRef}
		>
			{/* Window header */}
			<div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
				<div className="flex items-center gap-2.5">
					<span className="grid size-7 place-items-center rounded-lg bg-primary/10">
						<Bot className="size-4 text-primary" />
					</span>
					<span className="font-semibold text-foreground">Proddy AI</span>
				</div>
				<span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
					<span className="relative flex size-2">
						<span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
						<span className="relative inline-flex size-2 rounded-full bg-primary" />
					</span>
					live
				</span>
			</div>

			{/* Conversation body. `contain` scopes layout/paint so streaming
				reflow never repaints the rest of the page. */}
			<div
				className={cn(
					"flex min-h-[300px] flex-col gap-4 px-5 py-6 transition-opacity duration-500 [contain:layout_paint] md:min-h-[320px]",
					leaving ? "opacity-0" : "opacity-100"
				)}
			>
				{sentQuestion && (
					<m.div
						animate={{ opacity: 1, y: 0, scale: 1 }}
						className="flex justify-end"
						initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
						transition={{ type: "spring", stiffness: 460, damping: 30 }}
					>
						<p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
							{sentQuestion}
						</p>
					</m.div>
				)}

				{showAiTurn && (
					<div className="flex gap-3">
						<span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
							<Bot className="size-4 text-primary" />
						</span>
						<div className="min-w-0 flex-1 space-y-2.5">
							{/* Tool calls */}
							<div className="flex flex-wrap items-center gap-2">
								{current.tools.map((tool, i) => (
									<ToolChip
										icon={tool.icon}
										key={tool.label}
										label={tool.label}
										state={toolStates[i] ?? "pending"}
									/>
								))}
							</div>

							{phase === "thinking" && (
								<p className="text-sm italic text-muted-foreground">
									Searching your workspace…
								</p>
							)}

							{/* Streaming answer */}
							{answerCount > 0 && (
								<div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
									{revealed.map((u, i) => (
										<Fragment key={i}>
											<span className={u.bold ? "font-semibold" : undefined}>
												{u.text}
											</span>
											{u.brAfter > 0 &&
												Array.from({ length: u.brAfter }).map((_, k) => (
													<br key={k} />
												))}
										</Fragment>
									))}
									{streaming && <span className="hero-caret" />}
								</div>
							)}

							{/* Grounded sources */}
							{showCitations && (
								<div className="flex flex-wrap items-center gap-2 pt-0.5">
									<span className="text-xs text-muted-foreground">Sources</span>
									{current.citations.map((c, i) => (
										<m.span
											animate={{ opacity: 1, y: 0, scale: 1 }}
											className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-xs text-foreground"
											initial={
												reduceMotion ? false : { opacity: 0, y: 6, scale: 0.9 }
											}
											key={c.label}
											transition={{
												type: "spring",
												stiffness: 440,
												damping: 26,
												delay: reduceMotion ? 0 : i * 0.08,
											}}
										>
											<c.icon className="size-3 text-primary" />
											{c.label}
										</m.span>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Composer + progress */}
			<div className="border-t border-border bg-card px-4 py-3">
				<div className="flex items-center gap-2">
					<div className="flex h-10 flex-1 items-center rounded-lg border border-input bg-background px-3 text-sm">
						{inputText ? (
							<span className="truncate text-foreground">
								{inputText}
								{phase === "typing" && <span className="hero-caret" />}
							</span>
						) : (
							<span className="text-muted-foreground">
								Ask about your workspace…
							</span>
						)}
					</div>
					<Button
						aria-label="Send message"
						className="bg-primary hover:bg-primary/90"
						disabled
						size="icon"
					>
						{phase === "thinking" ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Send className="size-4" />
						)}
					</Button>
				</div>
				<div className="mt-3 flex items-center justify-center gap-1.5">
					{SCENARIOS.map((s, i) => (
						<span
							className={cn(
								"h-1.5 rounded-full transition-all duration-300",
								i === scenarioIndex ? "w-5 bg-primary" : "w-1.5 bg-border"
							)}
							key={s.question}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export const HeroSection = () => {
	const heroRef = useRef<HTMLElement>(null);
	const reduceMotion = useReducedMotion();

	// Parallax on the workspace grid (cheap: transform only).
	const { scrollYProgress } = useScroll({
		target: heroRef,
		offset: ["start start", "end start"],
	});
	const gridY = useTransform(scrollYProgress, [0, 1], [0, 64]);

	// Pointer-reactive mesh: rAF-throttled CSS custom properties.
	const rafRef = useRef(0);
	const posRef = useRef({ x: 50, y: 26 });
	const handlePointer = useCallback(
		(e: ReactPointerEvent<HTMLElement>) => {
			if (reduceMotion) return;
			const el = heroRef.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			posRef.current = {
				x: ((e.clientX - r.left) / r.width) * 100,
				y: ((e.clientY - r.top) / r.height) * 100,
			};
			if (!rafRef.current) {
				rafRef.current = requestAnimationFrame(() => {
					rafRef.current = 0;
					el.style.setProperty("--hero-mx", `${posRef.current.x.toFixed(2)}%`);
					el.style.setProperty("--hero-my", `${posRef.current.y.toFixed(2)}%`);
				});
			}
		},
		[reduceMotion]
	);
	useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

	return (
		<section
			className="hero-live relative w-full overflow-hidden bg-background pt-32 pb-20 md:pt-40 md:pb-28"
			onPointerMove={handlePointer}
			ref={heroRef}
		>
			{/* Ambient, cursor-reactive workspace field. */}
			<div aria-hidden className="hero-mesh">
				<m.div
					className="hero-grid"
					style={reduceMotion ? undefined : { y: gridY }}
				/>
			</div>

			<div className="container relative z-10 mx-auto max-w-6xl px-6 md:px-8">
				{/* Headline */}
				<m.div
					animate={{ opacity: 1, y: 0 }}
					className="mx-auto max-w-3xl text-center"
					initial={reduceMotion ? false : { opacity: 0, y: 16 }}
					transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
				>
					<span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-muted-foreground shadow-sm">
						<Bot className="size-4 text-primary" />
						Meet Proddy AI
					</span>
					<h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-6xl">
						Just Ask, <span className="text-primary">Proddy Knows</span>
					</h1>
					<p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
						Your workspace, answered. Proddy reads your messages, tasks, docs,
						and calendar — then replies with grounded answers and sources, in
						seconds.
					</p>
					<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
						<Button
							asChild
							className="gap-2 rounded-full bg-primary px-6 text-primary-foreground shadow-md hover:bg-primary/90"
							size="lg"
						>
							<Link href="/auth/signup">
								Try Proddy AI <ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button
							asChild
							className="gap-2 rounded-full border-border bg-card px-6 text-foreground hover:bg-accent"
							size="lg"
							variant="outline"
						>
							<Link href="#features">See how it works</Link>
						</Button>
					</div>
				</m.div>

				{/* The Living Answer — a demo that performs the product. */}
				<m.div
					animate={{ opacity: 1, y: 0 }}
					className="mx-auto mt-14 max-w-3xl"
					initial={reduceMotion ? false : { opacity: 0, y: 28 }}
					transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
				>
					<LiveDemo reduceMotion={Boolean(reduceMotion)} />
				</m.div>

				{/* Supporting value props */}
				<div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
					{VALUE_PROPS.map((prop, i) => (
						<m.div
							animate={{ opacity: 1, y: 0 }}
							className="rounded-xl border border-border bg-card/60 p-4"
							initial={reduceMotion ? false : { opacity: 0, y: 12 }}
							key={prop.title}
							transition={{
								duration: 0.4,
								delay: reduceMotion ? 0 : 0.3 + i * 0.08,
								ease: [0.16, 1, 0.3, 1],
							}}
						>
							<prop.icon className="size-5 text-primary" />
							<h3 className="mt-2.5 font-semibold text-foreground">
								{prop.title}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">{prop.body}</p>
						</m.div>
					))}
				</div>
			</div>
		</section>
	);
};
