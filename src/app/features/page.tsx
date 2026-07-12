"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ArrowRight, Boxes, Check, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import { CTASection } from "@/features/landing/components/cta-section";
import { Footer } from "@/features/landing/components/footer";
import { Header } from "@/features/landing/components/header";
import {
	type Feature,
	featureGroups,
	features,
} from "@/features/landing/features/features-data";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Brand-locked accent map. Every module borrows a token from the fintech
// palette (globals.css) — no ad-hoc blue/green/indigo. `class` drives the icon
// chip (static strings so Tailwind's JIT keeps them); `varName` feeds the
// spotlight/rail via inline CSS so we can tint arbitrary gradients on brand.
// ---------------------------------------------------------------------------
const ACCENT: Record<string, { class: string; varName: string }> = {
	"bg-primary": { class: "bg-primary", varName: "--primary" },
	"bg-secondary": { class: "bg-secondary", varName: "--secondary" },
	"bg-chart-1": { class: "bg-chart-1", varName: "--chart-1" },
	"bg-chart-2": { class: "bg-chart-2", varName: "--chart-2" },
	"bg-chart-3": { class: "bg-chart-3", varName: "--chart-3" },
	"bg-chart-4": { class: "bg-chart-4", varName: "--chart-4" },
	"bg-chart-5": { class: "bg-chart-5", varName: "--chart-5" },
};

const accentFor = (colorClass: string) =>
	ACCENT[colorClass] ?? ACCENT["bg-primary"];

interface Chapter extends Feature {
	category: string;
	categoryBlurb: string;
	isCategoryStart: boolean;
	actIndex: number;
}

// Flatten the four groups into one ordered reel, tagging the first module of
// each group so we can drop an "act" header in front of it.
const buildChapters = (): Chapter[] => {
	const byId = new Map(features.map((f) => [f.id, f]));
	const chapters: Chapter[] = [];
	featureGroups.forEach((group, actIndex) => {
		group.features.forEach((id, i) => {
			const feature = byId.get(id);
			if (!feature) return;
			chapters.push({
				...feature,
				category: group.title,
				categoryBlurb: group.description,
				isCategoryStart: i === 0,
				actIndex,
			});
		});
	});
	return chapters;
};

// ---------------------------------------------------------------------------
// Faux product window — makes each raw screenshot read as a live surface.
// ---------------------------------------------------------------------------
const BrowserFrame = ({
	children,
	label,
	className,
	style,
}: {
	children: ReactNode;
	label: string;
	className?: string;
	style?: CSSProperties;
}) => (
	<div
		className={cn(
			"overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
			className
		)}
		style={style}
	>
		<div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-2.5">
			<span className="size-2.5 rounded-full bg-destructive/40" />
			<span className="size-2.5 rounded-full bg-warning/50" />
			<span className="size-2.5 rounded-full bg-success/50" />
			<span className="ml-3 truncate text-xs font-medium text-muted-foreground">
				proddy · {label.toLowerCase()}
			</span>
		</div>
		<div className="relative aspect-[16/10] w-full">{children}</div>
	</div>
);

// A single module screenshot (or a branded fallback when none exists).
const ModuleShot = ({ feature }: { feature: Chapter }) => {
	const accent = accentFor(feature.color);
	if (!feature.imageSrc) {
		return (
			<div
				className="flex size-full items-center justify-center"
				style={{
					background: `radial-gradient(circle at 50% 40%, hsl(var(${accent.varName}) / 0.18), hsl(var(--card)) 70%)`,
				}}
			>
				<div
					className={cn(
						"flex size-20 items-center justify-center rounded-2xl text-white shadow-lg",
						accent.class
					)}
				>
					<span className="[&>svg]:size-9">{feature.icon}</span>
				</div>
			</div>
		);
	}
	return (
		<Image
			alt={`${feature.name} — Proddy product view`}
			className="object-cover object-top"
			fill
			sizes="(max-width: 1024px) 100vw, 640px"
			src={feature.imageSrc}
		/>
	);
};

const FeaturesPage = () => {
	const searchParams = useSearchParams();
	const prefersReduced = useReducedMotion();

	const chapters = useMemo(buildChapters, []);

	const cinemaRef = useRef<HTMLElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const glowRef = useRef<HTMLDivElement>(null);
	const chapterRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const [activeId, setActiveId] = useState<string>(chapters[0]?.id ?? "");
	const activeIndex = Math.max(
		0,
		chapters.findIndex((c) => c.id === activeId)
	);
	const activeChapter = chapters[activeIndex] ?? chapters[0];
	const activeAccent = accentFor(activeChapter?.color ?? "bg-primary");

	// Reel progress → animated rail fill.
	const { scrollYProgress } = useScroll({
		target: cinemaRef,
		offset: ["start 40%", "end 65%"],
	});
	const railFill = useSpring(scrollYProgress, {
		stiffness: 120,
		damping: 30,
		restDelta: 0.001,
	});

	// Center-band observer: whichever chapter is crossing the viewport's
	// middle owns the sticky stage.
	useEffect(() => {
		const nodes = Array.from(chapterRefs.current.values());
		if (nodes.length === 0) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const hit = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				if (hit?.target instanceof HTMLElement) {
					const id = hit.target.dataset.module;
					if (id) setActiveId(id);
				}
			},
			{ rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.5, 1] }
		);
		for (const node of nodes) observer.observe(node);
		return () => observer.disconnect();
	}, []);

	// Pointer spotlight — write coordinates straight to CSS vars (no re-render).
	const handleStageMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (prefersReduced || !glowRef.current || !stageRef.current) return;
			const rect = stageRef.current.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 100;
			const y = ((e.clientY - rect.top) / rect.height) * 100;
			glowRef.current.style.setProperty("--mx", `${x}%`);
			glowRef.current.style.setProperty("--my", `${y}%`);
		},
		[prefersReduced]
	);

	const scrollToChapter = useCallback((id: string) => {
		chapterRefs.current
			.get(id)
			?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, []);

	// Preserve legacy deep-links: ?feature=<id> and ?tab=<group>.
	useEffect(() => {
		const featureParam = searchParams.get("feature");
		const tabParam = searchParams.get("tab");
		const tabToId: Record<string, string> = {
			communication: "messaging",
			taskManagement: "tasks",
			planning: "notes",
			analytics: "reports",
		};
		const target = featureParam ?? (tabParam ? tabToId[tabParam] : undefined);
		if (!target) return;
		const timer = setTimeout(() => {
			setActiveId(target);
			scrollToChapter(target);
		}, 400);
		return () => clearTimeout(timer);
	}, [searchParams, scrollToChapter]);

	const registerChapter = useCallback(
		(id: string) => (node: HTMLDivElement | null) => {
			if (node) chapterRefs.current.set(id, node);
			else chapterRefs.current.delete(id);
		},
		[]
	);

	return (
		<div className="flex min-h-screen flex-col bg-background">
			<Header />

			{/* ─────────────────────────  HERO  ───────────────────────── */}
			<section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24">
				{/* one restrained, brand-tinted wash — not a floating blob */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-10"
					style={{
						background:
							"radial-gradient(60% 55% at 78% 12%, hsl(var(--secondary) / 0.07), transparent 60%), radial-gradient(50% 50% at 8% 8%, hsl(var(--primary) / 0.06), transparent 55%)",
					}}
				/>
				<div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
					<div>
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-sm"
							initial={{ opacity: 0, y: 8 }}
							transition={{ duration: 0.4 }}
						>
							<Boxes className="size-4 text-primary" />
							Nine modules, one workspace
						</motion.div>

						<motion.h1
							animate={{ opacity: 1, y: 0 }}
							className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl"
							initial={{ opacity: 0, y: 12 }}
							style={{ textWrap: "balance" } as CSSProperties}
							transition={{ duration: 0.5, delay: 0.05 }}
						>
							Every part of the work.{" "}
							<span className="relative whitespace-nowrap text-primary">
								One surface.
								<span className="absolute -bottom-1 left-0 h-3 w-full rounded-full bg-secondary/20" />
							</span>
						</motion.h1>

						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl"
							initial={{ opacity: 0, y: 12 }}
							transition={{ duration: 0.5, delay: 0.15 }}
						>
							Messaging, tasks, planning, and analytics that share one context —
							so work moves from talk to done without switching tools.
						</motion.p>

						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="mt-8 flex flex-wrap gap-3"
							initial={{ opacity: 0, y: 12 }}
							transition={{ duration: 0.5, delay: 0.25 }}
						>
							<Button
								asChild
								className="gap-2 rounded-full bg-primary px-6 text-base shadow-md hover:bg-primary/90"
								size="lg"
							>
								<Link href="#tour">
									Take the tour <ArrowRight className="size-4" />
								</Link>
							</Button>
							<Button
								asChild
								className="rounded-full px-6 text-base"
								size="lg"
								variant="outline"
							>
								<Link href="/auth/signup">Get started free</Link>
							</Button>
						</motion.div>
					</div>

					{/* hero preview — the workspace at a glance */}
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="relative mx-auto w-full max-w-lg lg:max-w-none"
						initial={{ opacity: 0, y: prefersReduced ? 0 : 24 }}
						transition={{ duration: 0.6, delay: 0.2 }}
					>
						<BrowserFrame label="dashboard">
							<Image
								alt="The Proddy dashboard bringing messaging, tasks and calendar into one view"
								className="object-cover object-top"
								fill
								priority
								sizes="(max-width: 1024px) 100vw, 560px"
								src="/dashboard.png"
							/>
						</BrowserFrame>

						{/* two floating module chips for life, not decoration */}
						<motion.div
							animate={prefersReduced ? undefined : { y: [0, -8, 0] }}
							className="absolute -left-4 top-10 hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:flex"
							transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
						>
							<span className="flex size-7 items-center justify-center rounded-lg bg-primary text-white [&>svg]:size-4">
								{features[0].icon}
							</span>
							<span className="text-sm font-medium text-foreground">
								New thread summarized
							</span>
						</motion.div>
						<motion.div
							animate={prefersReduced ? undefined : { y: [0, 8, 0] }}
							className="absolute -right-3 bottom-10 hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg sm:flex"
							transition={{
								duration: 4.5,
								repeat: Infinity,
								ease: "easeInOut",
								delay: 0.6,
							}}
						>
							<span className="flex size-7 items-center justify-center rounded-lg bg-chart-2 text-white [&>svg]:size-4">
								<Check className="size-4" />
							</span>
							<span className="text-sm font-medium text-foreground">
								Task added to board
							</span>
						</motion.div>
					</motion.div>
				</div>
			</section>

			{/* ─────────────────────────  THE TOUR  ───────────────────────── */}
			<section
				className="relative border-t border-border bg-background py-16 md:py-24"
				id="tour"
				ref={cinemaRef}
			>
				<div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
					<div className="mx-auto mb-14 max-w-2xl text-center md:mb-20">
						<h2
							className="text-3xl font-bold tracking-tight text-foreground md:text-5xl"
							style={{ textWrap: "balance" } as CSSProperties}
						>
							Scroll the whole workspace
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Every module, one continuous surface. The view on the right
							follows you down.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-x-16 lg:grid-cols-[1fr_1.05fr]">
						{/* LEFT — scrolling chapters */}
						<div className="order-2 lg:order-1">
							{chapters.map((chapter, i) => {
								const accent = accentFor(chapter.color);
								const isLast = i === chapters.length - 1;
								return (
									<div key={chapter.id}>
										<div
											className={cn(
												"flex flex-col py-12",
												isLast
													? ""
													: "min-h-[60vh] justify-center lg:min-h-[72vh]"
											)}
											data-module={chapter.id}
											id={chapter.id}
											ref={registerChapter(chapter.id)}
										>
											{/* inline shot — mobile only (sticky stage is desktop) */}
											<div className="mb-7 lg:hidden">
												<BrowserFrame label={chapter.name}>
													<ModuleShot feature={chapter} />
												</BrowserFrame>
											</div>

											<div className="flex items-center gap-3">
												<span
													className={cn(
														"flex size-11 items-center justify-center rounded-xl text-white shadow-sm [&>svg]:size-5",
														accent.class
													)}
												>
													{chapter.icon}
												</span>
												<h3 className="text-2xl font-bold text-foreground md:text-3xl">
													{chapter.name}
												</h3>
											</div>

											<p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/90 md:text-lg">
												{chapter.detailedDescription}
											</p>

											<ul className="mt-7 grid max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
												{chapter.features.slice(0, 6).map((item) => (
													<li className="flex items-start gap-2.5" key={item}>
														<span
															className="mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full"
															style={{
																backgroundColor: `hsl(var(${accent.varName}) / 0.14)`,
															}}
														>
															<Check
																className="size-3.5"
																style={{ color: `hsl(var(${accent.varName}))` }}
															/>
														</span>
														<span className="text-sm text-foreground">
															{item}
														</span>
													</li>
												))}
											</ul>

											{i === 0 && (
												<div className="mt-8">
													<Button
														asChild
														className="gap-2 rounded-full px-5"
														variant="outline"
													>
														<Link href="/auth/signup">
															Try it free <ArrowRight className="size-4" />
														</Link>
													</Button>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>

						{/* RIGHT — sticky media stage (desktop) */}
						<div className="order-1 hidden lg:order-2 lg:block">
							<div className="sticky top-0 flex h-screen flex-col justify-center">
								<div className="flex gap-5">
									{/* module navigator rail */}
									<nav
										aria-label="Modules"
										className="relative flex w-4 flex-col items-center pt-2"
									>
										<div className="absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-border" />
										<motion.div
											className="absolute left-1/2 top-2 w-px origin-top -translate-x-1/2"
											style={{
												scaleY: railFill,
												height: "calc(100% - 1rem)",
												backgroundColor: `hsl(var(${activeAccent.varName}))`,
											}}
										/>
										<div className="relative flex flex-1 flex-col items-center justify-between gap-1 py-1">
											{chapters.map((chapter) => {
												const isActive = chapter.id === activeId;
												const accent = accentFor(chapter.color);
												return (
													<button
														aria-current={isActive ? "true" : undefined}
														className="group relative flex w-4 items-center justify-center"
														key={chapter.id}
														onClick={() => scrollToChapter(chapter.id)}
														type="button"
													>
														<span
															className={cn(
																"z-10 block rounded-full border-2 border-background transition-all duration-300",
																isActive ? "size-3.5" : "size-2.5"
															)}
															style={{
																backgroundColor: isActive
																	? `hsl(var(${accent.varName}))`
																	: "hsl(var(--muted-foreground) / 0.4)",
															}}
														/>
														<span
															className={cn(
																"pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-all duration-200",
																isActive
																	? "text-foreground opacity-100"
																	: "text-muted-foreground opacity-0 group-hover:opacity-100"
															)}
														>
															{chapter.name}
														</span>
													</button>
												);
											})}
										</div>
									</nav>

									{/* the morphing stage */}
									<div
										className="relative flex-1"
										onMouseMove={handleStageMove}
										ref={stageRef}
									>
										{/* pointer + accent glow */}
										<div
											aria-hidden
											className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl transition-opacity duration-500"
											ref={glowRef}
											style={{
												background: `radial-gradient(45% 45% at var(--mx, 50%) var(--my, 30%), hsl(var(${activeAccent.varName}) / 0.28), transparent 70%)`,
											}}
										/>

										<div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
											<div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-2.5">
												<span className="size-2.5 rounded-full bg-destructive/40" />
												<span className="size-2.5 rounded-full bg-warning/50" />
												<span className="size-2.5 rounded-full bg-success/50" />
												<span className="ml-3 text-xs font-medium text-muted-foreground">
													proddy · {activeChapter?.name.toLowerCase()}
												</span>
											</div>
											<div className="relative h-[calc(100%-2.75rem)] w-full">
												{chapters.map((chapter) => {
													const isActive = chapter.id === activeId;
													return (
														<motion.div
															animate={{
																opacity: isActive ? 1 : 0,
																scale: isActive || prefersReduced ? 1 : 1.03,
															}}
															className="absolute inset-0"
															initial={false}
															key={chapter.id}
															style={{
																pointerEvents: isActive ? "auto" : "none",
																filter: isActive ? "none" : "blur(6px)",
															}}
															transition={{
																duration: prefersReduced ? 0.15 : 0.55,
																ease: [0.22, 1, 0.36, 1],
															}}
														>
															<ModuleShot feature={chapter} />
														</motion.div>
													);
												})}
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* live caption — full width, clear of the navigator rail */}
							<div className="mt-4 flex items-center gap-2 pl-9 text-sm text-muted-foreground">
								<Sparkles
									className="size-4"
									style={{ color: `hsl(var(${activeAccent.varName}))` }}
								/>
								<span className="font-medium text-foreground">
									{activeChapter?.name}
								</span>
								<span aria-hidden>·</span>
								<span>{activeChapter?.category}</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			<CTASection />
			<Footer />
		</div>
	);
};

export default FeaturesPage;
