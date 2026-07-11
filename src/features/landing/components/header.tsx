"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
	BarChart,
	Calendar,
	CheckSquare,
	ChevronDown,
	ExternalLink,
	FileText,
	LayoutDashboard,
	LayoutGrid,
	Menu,
	MessageSquare,
	PaintBucket,
	X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { cn } from "@/lib/utils";

// Define module types for the mega menu
interface Module {
	name: string;
	description: string;
	icon: LucideIcon;
	href: string;
}

// Map feature IDs to tab IDs
const featureToTabMap: Record<string, string> = {
	messaging: "communication",
	canvas: "communication",
	tasks: "taskManagement",
	boards: "taskManagement",
	calendar: "planning",
	notes: "planning",
	reports: "analytics",
	dashboard: "analytics",
};

const modules: Module[] = [
	{
		name: "Messaging",
		description: "Real-time team communication",
		icon: MessageSquare,
		href: `/features?tab=${featureToTabMap.messaging}&feature=messaging`,
	},
	{
		name: "Tasks",
		description: "Organize and track work",
		icon: CheckSquare,
		href: `/features?tab=${featureToTabMap.tasks}&feature=tasks`,
	},
	{
		name: "Calendar",
		description: "Schedule and manage events",
		icon: Calendar,
		href: `/features?tab=${featureToTabMap.calendar}&feature=calendar`,
	},
	{
		name: "Boards",
		description: "Visual project management",
		icon: LayoutGrid,
		href: `/features?tab=${featureToTabMap.boards}&feature=boards`,
	},
	{
		name: "Canvas",
		description: "Collaborative whiteboarding",
		icon: PaintBucket,
		href: `/features?tab=${featureToTabMap.canvas}&feature=canvas`,
	},
	{
		name: "Notes",
		description: "Document and share knowledge",
		icon: FileText,
		href: `/features?tab=${featureToTabMap.notes}&feature=notes`,
	},
	{
		name: "Reports",
		description: "Analytics and insights",
		icon: BarChart,
		href: `/features?tab=${featureToTabMap.reports}&feature=reports`,
	},
	{
		name: "Dashboard",
		description: "Your workspace command center",
		icon: LayoutDashboard,
		href: `/features?tab=${featureToTabMap.dashboard}&feature=dashboard`,
	},
];

export const Header = () => {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isModulesOpen, setIsModulesOpen] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);
	const { data: currentUser } = useCurrentUser();

	// Handle scroll effect for sticky header
	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 10);
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const toggleMenu = () => {
		setIsMenuOpen(!isMenuOpen);
	};

	const modulesCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);

	// Small close delay so moving the pointer from the trigger into the mega
	// menu (hover-intent) doesn't cause it to flicker shut.
	const openModules = () => {
		if (modulesCloseTimeoutRef.current) {
			clearTimeout(modulesCloseTimeoutRef.current);
			modulesCloseTimeoutRef.current = null;
		}
		setIsModulesOpen(true);
	};

	const closeModulesWithIntent = () => {
		modulesCloseTimeoutRef.current = setTimeout(() => {
			setIsModulesOpen(false);
		}, 150);
	};

	useEffect(() => {
		return () => {
			if (modulesCloseTimeoutRef.current) {
				clearTimeout(modulesCloseTimeoutRef.current);
			}
		};
	}, []);

	return (
		<header
			className={cn(
				"fixed top-0 left-0 right-0 z-50 transition-all duration-300",
				isScrolled ? "bg-background shadow-sm py-3" : "bg-transparent py-5"
			)}
		>
			<div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-full">
					{/* Logo */}
					<Link className="flex items-center gap-2 group" href="/home">
						<div className="relative size-10 overflow-hidden">
							<Image
								alt="Proddy Logo"
								className="object-contain"
								fill
								src="/logo-nobg.png"
							/>
						</div>
						<span className="text-xl font-bold text-foreground transition-colors duration-300">
							Proddy
						</span>
					</Link>

					{/* Desktop Navigation */}
					<nav className="hidden md:flex items-center gap-8">
						{/* Features dropdown */}

						<div
							className="relative"
							onBlur={() => setIsModulesOpen(false)}
							onFocus={openModules}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									setIsModulesOpen(false);
								}
							}}
							onMouseEnter={openModules}
							onMouseLeave={closeModulesWithIntent}
						>
							<Link
								aria-controls="features-mega-menu"
								aria-expanded={isModulesOpen}
								aria-haspopup="true"
								className={cn(
									"flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary",
									isModulesOpen && "text-primary"
								)}
								href="/features"
							>
								<span>Features</span>
								<ChevronDown
									className={cn(
										"size-4 transition-transform duration-200",
										isModulesOpen && "rotate-180"
									)}
								/>
							</Link>

							{/* Mega menu dropdown */}
							<AnimatePresence>
								{isModulesOpen && (
									<motion.div
										animate={{ opacity: 1, y: 0 }}
										className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-[600px] bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50"
										exit={{ opacity: 0, y: 10 }}
										id="features-mega-menu"
										initial={{ opacity: 0, y: 10 }}
										transition={{ duration: 0.2 }}
									>
										<div className="p-6">
											<div className="grid grid-cols-2 gap-4 mb-4">
												{modules.map((module) => (
													<Link
														className="flex items-start p-3 rounded-lg hover:bg-muted transition-colors duration-150"
														href={module.href}
														key={module.name}
													>
														<div className="flex-shrink-0 flex items-center justify-center size-10 rounded-md bg-primary/5">
															<module.icon className="size-5 text-primary" />
														</div>
														<div className="ml-4">
															<p className="text-sm font-medium text-foreground">
																{module.name}
															</p>
															<p className="mt-1 text-xs text-muted-foreground">
																{module.description}
															</p>
														</div>
													</Link>
												))}
											</div>

											{/* Special Assistant Feature */}
											<div className="mt-4 pt-4 border-t border-border">
												<Link
													className="flex items-start p-4 rounded-lg bg-primary/5 hover:bg-primary/10 transition-all duration-200"
													href="/assistant"
												>
													<div className="flex-shrink-0 flex items-center justify-center size-12 rounded-md bg-primary/20 text-2xl">
														🤖
													</div>
													<div className="ml-4">
														<div className="flex items-center gap-2">
															<p className="text-base font-medium text-foreground">
																Proddy AI Assistant
															</p>
															<Badge variant="primarySoft">New</Badge>
														</div>
														<p className="mt-1 text-sm text-muted-foreground">
															Your intelligent workspace companion powered by AI
														</p>
													</div>
												</Link>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
						{/* <Link
              href="/why-proddy"
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                isScrolled ? "text-muted-foreground hover:text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              Why Proddy?
            </Link> */}
						<Link
							className="text-sm font-medium text-muted-foreground transition-colors duration-200 flex items-center gap-1 hover:text-primary"
							href="/assistant"
						>
							<span>AI Assistant</span>
							<Badge variant="primarySoft">New</Badge>
						</Link>
						<Link
							className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
							href="/pricing"
						>
							Pricing
						</Link>
						<Link
							className="text-sm font-medium text-muted-foreground transition-colors duration-200 flex items-center gap-1 hover:text-primary"
							href={process.env.NEXT_PUBLIC_GITHUB_URL || "#"}
							rel="noopener noreferrer"
							target="_blank"
						>
							GitHub <ExternalLink className="size-3" />
						</Link>
					</nav>

					{/* CTA Button */}
					<div className="hidden md:flex items-center gap-3">
						{currentUser ? (
							<Button
								asChild
								className={cn(
									"rounded-full transition-all duration-300 flex items-center gap-2",
									isScrolled
										? "bg-primary hover:bg-primary/90 text-white shadow-sm"
										: "bg-primary hover:bg-primary/90 text-white shadow-md"
								)}
							>
								<Link href="/workspace">
									<LayoutDashboard className="size-4" />
									Dashboard
								</Link>
							</Button>
						) : (
							<>
								<Button
									asChild
									className="rounded-full border-border hover:border-primary/50 hover:text-primary"
									variant="outline"
								>
									<Link href="/auth/signin">Sign In</Link>
								</Button>
								<Button
									asChild
									className={cn(
										"rounded-full transition-all duration-300",
										isScrolled
											? "bg-primary hover:bg-primary/90 text-white shadow-sm"
											: "bg-primary hover:bg-primary/90 text-white shadow-md"
									)}
								>
									<Link href="/auth/signup">Get Started</Link>
								</Button>
							</>
						)}
					</div>

					{/* Mobile CTA + Menu Button */}
					<div className="flex items-center gap-2 md:hidden">
						<Button asChild className="rounded-full" size="sm">
							<Link href={currentUser ? "/workspace" : "/auth/signup"}>
								{currentUser ? "Dashboard" : "Get Started"}
							</Link>
						</Button>
						<button
							aria-label={isMenuOpen ? "Close menu" : "Open menu"}
							className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
							onClick={toggleMenu}
							type="button"
						>
							{isMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
						</button>
					</div>
				</div>
			</div>

			{/* Mobile Menu */}
			<AnimatePresence>
				{isMenuOpen && (
					<motion.div
						animate={{ opacity: 1, height: "auto" }}
						className="md:hidden bg-background border-t border-border shadow-lg"
						exit={{ opacity: 0, height: 0 }}
						initial={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.3 }}
					>
						<div className="px-5 py-6 space-y-6">
							<div className="space-y-4">
								{/* Features with submenu */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<Link
											className="block text-base font-medium text-muted-foreground hover:text-primary transition-colors"
											href="/features"
											onClick={() => setIsMenuOpen(false)}
										>
											Features
										</Link>
									</div>

									<div className="pl-4 grid grid-cols-2 gap-3">
										{modules.map((module) => (
											<Link
												className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
												href={module.href}
												key={module.name}
												onClick={() => setIsMenuOpen(false)}
											>
												<module.icon className="size-4" />
												<span>{module.name}</span>
											</Link>
										))}

										{/* Special Assistant Feature for mobile */}
										<Link
											className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors col-span-2 mt-2 bg-primary/5 p-2 rounded-md"
											href="/assistant"
											onClick={() => setIsMenuOpen(false)}
										>
											<span className="text-lg">🤖</span>
											<div>
												<span>Proddy AI Assistant</span>
												<Badge className="ml-2" variant="primarySoft">
													New
												</Badge>
											</div>
										</Link>
									</div>
								</div>
								{/* <Link
                  href="/why-proddy"
                  className="block text-base font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Why Proddy?
                </Link> */}

								<Link
									className="block text-base font-medium text-muted-foreground hover:text-primary transition-colors"
									href="/pricing"
									onClick={() => setIsMenuOpen(false)}
								>
									Pricing
								</Link>

								<Link
									className="flex items-center gap-1 text-base font-medium text-muted-foreground hover:text-primary transition-colors"
									href={process.env.NEXT_PUBLIC_GITHUB_URL || "#"}
									onClick={() => setIsMenuOpen(false)}
									rel="noopener noreferrer"
									target="_blank"
								>
									GitHub <ExternalLink className="size-3" />
								</Link>
							</div>
							<div className="pt-4 border-t border-border space-y-3">
								{currentUser ? (
									<Button
										asChild
										className="w-full rounded-full flex items-center justify-center gap-2"
									>
										<Link
											href="/workspace"
											onClick={() => setIsMenuOpen(false)}
										>
											<LayoutDashboard className="size-4" />
											Dashboard
										</Link>
									</Button>
								) : (
									<>
										<Button
											asChild
											className="w-full rounded-full"
											variant="outline"
										>
											<Link
												href="/auth/signin"
												onClick={() => setIsMenuOpen(false)}
											>
												Sign In
											</Link>
										</Button>
										<Button asChild className="w-full rounded-full">
											<Link
												href="/auth/signup"
												onClick={() => setIsMenuOpen(false)}
											>
												Get Started
											</Link>
										</Button>
									</>
								)}
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</header>
	);
};
