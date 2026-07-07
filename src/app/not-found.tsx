"use client";

import { ArrowLeft, Home } from "lucide-react";
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
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<section className="w-full max-w-md text-center">
				<h1 className="text-2xl font-semibold text-foreground md:text-3xl">
					Page not found
				</h1>

				<p className="mt-2 text-sm text-muted-foreground">
					The page you're looking for doesn't exist or may have moved.
				</p>

				<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button onClick={handleGoBack} type="button" variant="outline">
						<ArrowLeft className="mr-2 size-4" />
						Go back
					</Button>

					<Button asChild variant="primary">
						<Link href="/home">
							<Home className="mr-2 size-4" />
							Home
						</Link>
					</Button>
				</div>
			</section>
		</main>
	);
};

export default NotFoundPage;
