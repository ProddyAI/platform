"use client";

import { ArrowLeft, Compass, Home, LifeBuoy, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
	const router = useRouter();

	const handleGoBack = () => {
		if (typeof window !== "undefined" && window.history.length > 1) {
			router.back();
			return;
		}

		router.push("/home");
	};

	return (
		<main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(326_100%_97%),transparent_38%),radial-gradient(circle_at_80%_10%,hsl(280_77%_94%),transparent_36%),linear-gradient(180deg,hsl(0_0%_100%),hsl(210_40%_98%))] px-4 py-12">
			<div className="pointer-events-none absolute -left-20 top-16 h-52 w-52 rounded-full bg-secondary/20 blur-3xl" />
			<div className="pointer-events-none absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />

			<section className="relative z-10 w-full max-w-3xl rounded-3xl border border-primary/10 bg-white/80 p-6 shadow-xl backdrop-blur-sm md:p-10">
				<div className="mb-5 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
					Error 404: Route escaped containment
				</div>

				<h1 className="text-4xl font-bold leading-tight text-foreground md:text-6xl">
					This page took a coffee break and never came back.
				</h1>

				<p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
					We searched the workspace, checked the channels, and interrogated the
					breadcrumbs. Verdict: this URL does not exist.
				</p>

				<div className="mt-6 rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-4">
					<p className="text-sm font-semibold text-foreground">
						Possible causes:
					</p>
					<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
						<li>1) A typo snuck into the URL.</li>
						<li>2) The link moved and forgot to leave a forwarding address.</li>
						<li>3) Reality glitched for exactly one route.</li>
					</ul>
				</div>

				<div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<Button
						className="w-full"
						onClick={handleGoBack}
						type="button"
						variant="outline"
					>
						<ArrowLeft className="mr-2 size-4" />
						Go Back
					</Button>

					<Button asChild className="w-full" variant="primary">
						<Link href="/home">
							<Home className="mr-2 size-4" />
							Go Home
						</Link>
					</Button>

					<Button asChild className="w-full" variant="outline">
						<Link href="/pricing">
							<Compass className="mr-2 size-4" />
							See Pricing
						</Link>
					</Button>

					<Button asChild className="w-full" variant="outline">
						<Link href="/contact">
							<LifeBuoy className="mr-2 size-4" />
							Contact Us
						</Link>
					</Button>

					<Button asChild className="w-full" variant="outline">
						<Link href="/auth/signin">
							<LogIn className="mr-2 size-4" />
							Sign In
						</Link>
					</Button>
				</div>

				<p className="mt-6 text-xs text-muted-foreground">
					Still lost? Double-check the URL. If this came from our app, report
					the broken link and we will patch the timeline.
				</p>
			</section>
		</main>
	);
};

export default NotFoundPage;
