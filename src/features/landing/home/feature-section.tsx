"use client";

import { AnimatePresence, m, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import {
	type Feature,
	features,
} from "@/features/landing/features/features-data";
import { cn } from "@/lib/utils";

// One full auto-advance cycle per module, in milliseconds.
const CYCLE_MS = 6500;

// Shared ease-out-quart curve — matches the rest of the landing motion system.
const EASE_OUT = [0.25, 0.1, 0.25, 1.0] as const;

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;

const FeatureScreenshot = ({ feature }: { feature: Feature }) => {
	const [imageError, setImageError] = useState(false);

	if (imageError) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
				<div className={cn("p-3 rounded-lg text-white w-fit", feature.color)}>
					{feature.icon}
				</div>
				<span className="text-sm font-medium text-muted-foreground">
					{feature.name} module preview
				</span>
			</div>
		);
	}

	return (
		<Image
			alt={`${feature.name} module preview`}
			className="object-cover object-right p-4"
			fill
			onError={() => setImageError(true)}
			priority
			src={feature.imageSrc || "/placeholder-feature.png"}
		/>
	);
};

export const FeatureSection = () => {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-100px 0px" });
	// Separate, repeatable in-view signal to gate the auto-advance timer.
	const panelInView = useInView(ref, { margin: "-120px 0px" });
	const shouldReduceMotion = useReducedMotion();
	const [activeTab, setActiveTab] = useState("messaging");

	const activeIndex = Math.max(
		0,
		features.findIndex((f) => f.id === activeTab)
	);
	const activeFeature = features[activeIndex] ?? features[0];
	const visibleFeatures = activeFeature.features.slice(0, 5);
	const hasMoreFeatures =
		activeFeature.features.length > visibleFeatures.length;

	// ── Moving selection highlight ────────────────────────────────────────────
	// domAnimation (strict) forbids the `layout` prop, so we measure the active
	// tab's box and drive an absolutely-positioned pill with a transform instead.
	const listRef = useRef<HTMLDivElement>(null);
	const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
	const [pill, setPill] = useState({ y: 0, height: 0, ready: false });

	const measurePill = useCallback(() => {
		const el = tabRefs.current.get(activeTab);
		if (!el) return;
		setPill({ y: el.offsetTop, height: el.offsetHeight, ready: true });
	}, [activeTab]);

	useIsomorphicLayoutEffect(() => {
		measurePill();
	}, [measurePill]);

	useEffect(() => {
		const container = listRef.current;
		if (!container || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => measurePill());
		observer.observe(container);
		return () => observer.disconnect();
	}, [measurePill]);

	// ── Auto-advance timer with pause-on-interaction ───────────────────────────
	// Elapsed lives in a ref (no per-frame state churn) since there's no visible
	// progress indicator to drive.
	const elapsedRef = useRef(0);
	const hoverRef = useRef(false);
	const focusRef = useRef(false);

	const resetCycle = useCallback(() => {
		elapsedRef.current = 0;
	}, []);

	const autoAdvance = !shouldReduceMotion;

	useEffect(() => {
		if (!autoAdvance || !panelInView) return;
		let raf = 0;
		let last = performance.now();

		const tick = (now: number) => {
			const dt = now - last;
			last = now;
			const paused =
				hoverRef.current ||
				focusRef.current ||
				document.visibilityState !== "visible";

			if (!paused) {
				elapsedRef.current += dt;
				if (elapsedRef.current >= CYCLE_MS) {
					elapsedRef.current = 0;
					setActiveTab((prev) => {
						const i = features.findIndex((f) => f.id === prev);
						return features[(i + 1) % features.length].id;
					});
				}
			}
			raf = requestAnimationFrame(tick);
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [autoAdvance, panelInView]);

	const selectTab = useCallback(
		(id: string) => {
			setActiveTab(id);
			resetCycle();
		},
		[resetCycle]
	);

	const onTabKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const len = features.length;
			const i = features.findIndex((f) => f.id === activeTab);
			let next = i;
			switch (e.key) {
				case "ArrowDown":
				case "ArrowRight":
					next = (i + 1) % len;
					break;
				case "ArrowUp":
				case "ArrowLeft":
					next = (i - 1 + len) % len;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = len - 1;
					break;
				default:
					return;
			}
			e.preventDefault();
			const id = features[next].id;
			selectTab(id);
			tabRefs.current.get(id)?.focus();
		},
		[activeTab, selectTab]
	);

	const pillTransition = shouldReduceMotion
		? { duration: 0 }
		: { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.9 };

	// Text panel content swaps instantly — no entrance animation.
	const instant = { duration: 0 };
	const fadeUp = {
		hidden: { opacity: 1, y: 0 },
		visible: { opacity: 1, y: 0, transition: instant },
	};
	const fadeLeft = fadeUp;
	const popIn = fadeUp;
	const fadeOnly = fadeUp;

	return (
		<section
			className="py-16 md:py-24 bg-muted/30 relative overflow-hidden w-full"
			id="modules"
			ref={ref}
		>
			<div className="w-full px-6 md:px-8 relative z-10">
				<div className="text-center mb-10 max-w-7xl mx-auto">
					<m.h2
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
						className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
						transition={{ duration: 0.35, delay: 0.05 }}
					>
						Powerful <span className="text-primary">Tools</span> for Every Need
					</m.h2>
					<m.p
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
						className="text-lg text-muted-foreground max-w-[800px] mx-auto mb-6"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
						transition={{ duration: 0.35, delay: 0.1 }}
					>
						Each tool works on its own or as part of the integrated ecosystem.
					</m.p>
				</div>

				<div
					className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto h-full"
					onBlurCapture={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
							focusRef.current = false;
						}
					}}
					onFocusCapture={() => {
						focusRef.current = true;
					}}
					onMouseEnter={() => {
						hoverRef.current = true;
					}}
					onMouseLeave={() => {
						hoverRef.current = false;
					}}
				>
					<m.div
						animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
						className="lg:col-span-1 rounded-2xl border bg-card shadow-sm p-6 h-full flex flex-col"
						initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -12 }}
						transition={{ duration: 0.35, delay: 0.15 }}
					>
						<h3
							className="text-lg font-bold mb-4 text-foreground"
							id="modules-heading"
						>
							Modules
						</h3>
						<div
							aria-labelledby="modules-heading"
							className="relative space-y-2 flex-grow"
							onKeyDown={onTabKeyDown}
							ref={listRef}
							role="tablist"
						>
							{/* Sliding highlight pill — a moving background tint, not a
							    side-stripe. Sits behind the buttons (z-0). */}
							<m.div
								animate={{ y: pill.y, height: pill.height }}
								aria-hidden
								className="pointer-events-none absolute inset-x-0 top-0 z-0 rounded-lg bg-primary/[0.07] ring-1 ring-primary/15 shadow-sm"
								initial={false}
								style={{ opacity: pill.ready ? 1 : 0 }}
								transition={pillTransition}
							/>
							{features.map((feature) => {
								const isActive = activeTab === feature.id;
								return (
									<button
										aria-controls="active-module-panel"
										aria-selected={isActive}
										className={cn(
											"relative z-10 w-full flex items-center gap-3 p-3 rounded-lg text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
											isActive
												? "text-primary"
												: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
										)}
										id={`module-tab-${feature.id}`}
										key={feature.id}
										onClick={() => selectTab(feature.id)}
										onMouseEnter={() => selectTab(feature.id)}
										ref={(node) => {
											if (node) tabRefs.current.set(feature.id, node);
											else tabRefs.current.delete(feature.id);
										}}
										role="tab"
										tabIndex={isActive ? 0 : -1}
										type="button"
									>
										<m.div
											animate={
												shouldReduceMotion
													? undefined
													: { scale: isActive ? 1.08 : 1 }
											}
											className={cn(
												"p-2 rounded-lg text-white shadow-sm",
												feature.color
											)}
											transition={{
												type: "spring",
												stiffness: 500,
												damping: 24,
											}}
										>
											{feature.icon}
										</m.div>
										<span className="font-medium">{feature.name}</span>
										{isActive && (
											<ArrowRight
												className="ml-auto size-4 text-primary/70"
												strokeWidth={2.5}
											/>
										)}
									</button>
								);
							})}
						</div>
					</m.div>

					<m.div
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
						aria-labelledby={`module-tab-${activeFeature.id}`}
						className="lg:col-span-2 relative rounded-2xl border bg-card shadow-sm overflow-hidden h-full"
						id="active-module-panel"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
						role="tabpanel"
						tabIndex={0}
						transition={{ duration: 0.35, delay: 0.2 }}
					>
						<div className="grid grid-cols-1 md:grid-cols-2 h-full">
							<div className="p-6 flex flex-col justify-between">
								{/* Keyed wrapper re-plays the stagger on every module switch.
							    Parent animates via variant *labels* so the stagger
							    actually propagates to the children below. */}
								<AnimatePresence mode="wait">
									<m.div
										animate="visible"
										exit="hidden"
										initial="hidden"
										key={activeFeature.id}
										transition={{ duration: 0 }}
										variants={{
											hidden: { opacity: 1 },
											visible: { opacity: 1, transition: { duration: 0 } },
										}}
									>
										<m.div className="relative w-fit mb-4" variants={popIn}>
											{/* Contained halo keyed to the active module's color. */}
											<div
												aria-hidden
												className={cn(
													"absolute inset-0 rounded-lg blur-lg opacity-40 scale-110",
													activeFeature.color
												)}
											/>
											<div
												className={cn(
													"relative p-3 rounded-lg text-white shadow-md",
													activeFeature.color
												)}
											>
												{activeFeature.icon}
											</div>
										</m.div>

										<m.h3
											className="text-xl font-bold mb-3 text-foreground"
											variants={fadeUp}
										>
											{activeFeature.name}
										</m.h3>
										<m.p
											className="text-muted-foreground mb-6"
											variants={fadeUp}
										>
											{activeFeature.description}
										</m.p>

										<m.h4
											className="text-sm font-semibold text-muted-foreground uppercase mb-3"
											variants={fadeUp}
										>
											Key Features
										</m.h4>
										<ul className="space-y-3 mb-4">
											{visibleFeatures.map((feature) => (
												<m.li
													className="flex items-start gap-2"
													key={`${activeFeature.id}-${feature}`}
													variants={fadeLeft}
												>
													<ArrowRight className="size-4 text-primary mt-1 flex-shrink-0" />
													<span className="text-foreground">{feature}</span>
												</m.li>
											))}
										</ul>
										{hasMoreFeatures && (
											<m.div variants={fadeOnly}>
												<Link
													className="group inline-flex items-center gap-1 text-sm font-medium text-primary mb-6 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
													href={`/features?feature=${activeFeature.id}`}
												>
													See all in Features
													<ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
												</Link>
											</m.div>
										)}
									</m.div>
								</AnimatePresence>
							</div>
							<div className="relative bg-muted h-full overflow-hidden">
								{/* Cross-dissolve with a subtle depth push between screenshots. */}
								<AnimatePresence>
									<m.div
										animate={{ opacity: 1, scale: 1 }}
										className="absolute inset-0"
										exit={{ opacity: 0 }}
										initial={{
											opacity: 0,
											scale: shouldReduceMotion ? 1 : 1.05,
										}}
										key={activeFeature.id}
										transition={{
											duration: shouldReduceMotion ? 0 : 0.5,
											ease: EASE_OUT,
										}}
									>
										<FeatureScreenshot feature={activeFeature} />
									</m.div>
								</AnimatePresence>
							</div>
						</div>
					</m.div>
				</div>
			</div>
		</section>
	);
};
