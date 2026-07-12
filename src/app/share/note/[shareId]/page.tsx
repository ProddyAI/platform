"use client";

import { useQuery } from "convex/react";
import { ArrowRight, FileText, Loader2, Lock, ShieldAlert } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PublicNoteViewer = dynamic(
	() =>
		import("@/features/notes/components/public-note-viewer").then(
			(m) => m.PublicNoteViewer
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex min-h-[240px] items-center justify-center">
				<Loader2 className="size-6 animate-spin text-primary" />
			</div>
		),
	}
);

const formatDate = (ts: number) =>
	new Date(ts).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

const PageShell = ({ children }: { children: React.ReactNode }) => (
	<div className="flex min-h-screen flex-col bg-muted/30">
		{/* Top bar */}
		<header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
			<div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
				<Link className="flex items-center gap-2" href="/home">
					<Image
						alt="Proddy"
						className="size-7"
						height={28}
						src="/logo-nobg.png"
						width={28}
					/>
					<span className="text-sm font-semibold">Proddy</span>
				</Link>
				<Button asChild size="sm" variant="outline">
					<Link href="/home">
						Try Proddy
						<ArrowRight className="ml-1.5 size-3.5" />
					</Link>
				</Button>
			</div>
		</header>

		<main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
			{children}
		</main>

		<footer className="border-t bg-card/50 py-6">
			<div className="mx-auto w-full max-w-3xl px-4 text-center text-xs text-muted-foreground">
				Shared with{" "}
				<Link className="font-medium text-primary hover:underline" href="/home">
					Proddy
				</Link>{" "}
				— the smart work management suite.
			</div>
		</footer>
	</div>
);

const CenteredCard = ({ children }: { children: React.ReactNode }) => (
	<div className="mx-auto mt-8 max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
		{children}
	</div>
);

export default function SharedNotePage() {
	const params = useParams<{ shareId: string }>();
	const shareId = params?.shareId ?? "";

	// Password the viewer has submitted (empty until they try).
	const [submittedPassword, setSubmittedPassword] = useState<string>("");
	const [passwordDraft, setPasswordDraft] = useState("");

	const result = useQuery(api.content.notesShare.getPublicNote, {
		shareId,
		password: submittedPassword || undefined,
	});

	// Loading
	if (result === undefined) {
		return (
			<PageShell>
				<div className="flex min-h-[240px] items-center justify-center">
					<Loader2 className="size-6 animate-spin text-primary" />
				</div>
			</PageShell>
		);
	}

	// Not found / revoked
	if (result.status === "not_found") {
		return (
			<PageShell>
				<CenteredCard>
					<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
						<FileText className="size-7 text-muted-foreground" />
					</div>
					<h1 className="text-lg font-semibold">Note not available</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						This link is invalid or the note is no longer shared publicly.
					</p>
					<Button asChild className="mt-6" variant="outline">
						<Link href="/home">Go to Proddy</Link>
					</Button>
				</CenteredCard>
			</PageShell>
		);
	}

	// Password gate
	if (
		result.status === "password_required" ||
		result.status === "password_incorrect"
	) {
		const isError = result.status === "password_incorrect";
		return (
			<PageShell>
				<CenteredCard>
					<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
						<Lock className="size-7 text-primary" />
					</div>
					<h1 className="text-lg font-semibold">
						{result.title || "Protected note"}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						This note is password protected. Enter the password to view it.
					</p>
					<form
						className="mt-6 space-y-3 text-left"
						onSubmit={(e) => {
							e.preventDefault();
							setSubmittedPassword(passwordDraft);
						}}
					>
						<Input
							autoFocus
							onChange={(e) => setPasswordDraft(e.target.value)}
							placeholder="Password"
							type="password"
							value={passwordDraft}
						/>
						{isError && (
							<p className="flex items-center gap-1.5 text-xs text-destructive">
								<ShieldAlert className="size-3.5" />
								Incorrect password. Try again.
							</p>
						)}
						<Button
							className="w-full"
							disabled={passwordDraft.trim().length === 0}
							type="submit"
						>
							Unlock note
						</Button>
					</form>
				</CenteredCard>
			</PageShell>
		);
	}

	// Authorized — render the note
	return (
		<PageShell>
			<article className="rounded-2xl border bg-card p-6 shadow-sm md:p-10">
				<header className="mb-6 border-b pb-6">
					<h1 className="text-2xl font-bold tracking-tight md:text-3xl">
						{result.title || "Untitled note"}
					</h1>
					<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
						<span>Updated {formatDate(result.updatedAt)}</span>
						{result.tags.length > 0 && (
							<div className="flex flex-wrap items-center gap-1.5">
								{result.tags.map((tag) => (
									<Badge key={tag} variant="secondary">
										{tag}
									</Badge>
								))}
							</div>
						)}
					</div>
				</header>

				<div className="prose-sm max-w-none">
					<PublicNoteViewer noteId={result.noteId} />
				</div>
			</article>
		</PageShell>
	);
}
