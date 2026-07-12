"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Check,
	Copy,
	Globe,
	Link2,
	Loader2,
	Lock,
	ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ShareNoteDialogProps {
	isOpen: boolean;
	onClose: () => void;
	noteId: Id<"notes">;
	noteTitle: string;
}

export const ShareNoteDialog = ({
	isOpen,
	onClose,
	noteId,
	noteTitle,
}: ShareNoteDialogProps) => {
	const settings = useQuery(
		api.content.notesShare.getShareSettings,
		isOpen ? { noteId } : "skip"
	);

	const enableSharing = useMutation(api.content.notesShare.enableSharing);
	const disableSharing = useMutation(api.content.notesShare.disableSharing);
	const setSharePassword = useMutation(api.content.notesShare.setSharePassword);

	const [isBusy, setIsBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [passwordEnabled, setPasswordEnabled] = useState(false);
	const [passwordInput, setPasswordInput] = useState("");

	// Sync the local password toggle with the server state whenever the dialog
	// opens or the settings load.
	useEffect(() => {
		if (settings) {
			setPasswordEnabled(settings.hasPassword);
			setPasswordInput("");
		}
	}, [settings]);

	const isPublic = settings?.isPublic ?? false;
	const shareId = settings?.publicShareId ?? null;

	const shareUrl =
		shareId && typeof window !== "undefined"
			? `${window.location.origin}/share/note/${shareId}`
			: "";

	const handleTogglePublic = async (next: boolean) => {
		setIsBusy(true);
		try {
			if (next) {
				await enableSharing({ noteId });
				toast.success("Public link enabled");
			} else {
				await disableSharing({ noteId });
				toast.success("Sharing turned off");
			}
		} catch (error) {
			console.error("Failed to update sharing:", error);
			toast.error("Couldn't update sharing");
		} finally {
			setIsBusy(false);
		}
	};

	const handleCopy = async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			toast.success("Link copied to clipboard");
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy link:", error);
			toast.error("Couldn't copy link");
		}
	};

	const handleTogglePassword = (next: boolean) => {
		setPasswordEnabled(next);
		if (!next && settings?.hasPassword) {
			// Immediately clear a stored password when the switch is turned off.
			setIsBusy(true);
			setSharePassword({ noteId, password: null })
				.then(() => toast.success("Password removed"))
				.catch((error) => {
					console.error("Failed to remove password:", error);
					toast.error("Couldn't remove password");
					setPasswordEnabled(true);
				})
				.finally(() => setIsBusy(false));
		}
	};

	const handleSavePassword = async () => {
		const trimmed = passwordInput.trim();
		if (trimmed.length < 4) {
			toast.error("Use at least 4 characters");
			return;
		}
		setIsBusy(true);
		try {
			await setSharePassword({ noteId, password: trimmed });
			setPasswordInput("");
			toast.success("Password set");
		} catch (error) {
			console.error("Failed to set password:", error);
			toast.error("Couldn't set password");
		} finally {
			setIsBusy(false);
		}
	};

	const isLoading = settings === undefined;

	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Globe className="size-5 text-primary" />
						Share note
					</DialogTitle>
					<DialogDescription>
						Publish &quot;{noteTitle || "Untitled"}&quot; as a read-only page
						anyone can open with the link.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-5">
						{/* Public toggle */}
						<div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
							<div className="space-y-0.5">
								<Label
									className="flex items-center gap-2 text-sm font-semibold"
									htmlFor="public-toggle"
								>
									<Link2 className="size-4 text-primary" />
									Anyone with the link
								</Label>
								<p className="text-xs text-muted-foreground">
									Turn this on to create a public, read-only link.
								</p>
							</div>
							<Switch
								checked={isPublic}
								disabled={isBusy}
								id="public-toggle"
								onCheckedChange={handleTogglePublic}
							/>
						</div>

						{isPublic && shareUrl && (
							<div className="space-y-5">
								{/* Copyable link */}
								<div className="space-y-2">
									<Label className="text-xs font-medium text-muted-foreground">
										Public link
									</Label>
									<div className="flex items-center gap-2">
										<Input
											className="font-mono text-xs"
											onFocus={(e) => e.currentTarget.select()}
											readOnly
											value={shareUrl}
										/>
										<Button
											className="shrink-0"
											onClick={handleCopy}
											size="sm"
											variant={copied ? "default" : "outline"}
										>
											{copied ? (
												<Check className="size-4 md:mr-2" />
											) : (
												<Copy className="size-4 md:mr-2" />
											)}
											<span className="hidden md:inline">
												{copied ? "Copied" : "Copy"}
											</span>
										</Button>
									</div>
								</div>

								{/* Password protection */}
								<div className="space-y-3 rounded-lg border bg-card p-4">
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-0.5">
											<Label
												className="flex items-center gap-2 text-sm font-semibold"
												htmlFor="password-toggle"
											>
												<Lock className="size-4 text-primary" />
												Password protection
											</Label>
											<p className="text-xs text-muted-foreground">
												Require a password before the note can be viewed.
											</p>
										</div>
										<Switch
											checked={passwordEnabled}
											disabled={isBusy}
											id="password-toggle"
											onCheckedChange={handleTogglePassword}
										/>
									</div>

									{passwordEnabled && (
										<div className="space-y-2 pt-1">
											{settings?.hasPassword && (
												<div className="flex items-center gap-1.5 text-xs text-success">
													<ShieldCheck className="size-3.5" />
													This link is password protected.
												</div>
											)}
											<div className="flex items-center gap-2">
												<Input
													disabled={isBusy}
													onChange={(e) => setPasswordInput(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === "Enter") handleSavePassword();
													}}
													placeholder={
														settings?.hasPassword
															? "Enter a new password"
															: "Choose a password"
													}
													type="password"
													value={passwordInput}
												/>
												<Button
													className="shrink-0"
													disabled={isBusy || passwordInput.trim().length === 0}
													onClick={handleSavePassword}
													size="sm"
												>
													{settings?.hasPassword ? "Update" : "Set"}
												</Button>
											</div>
											<p className="text-[11px] text-muted-foreground">
												Share the password separately — viewers will need it to
												open the note.
											</p>
										</div>
									)}
								</div>
							</div>
						)}

						{!isPublic && (
							<div
								className={cn(
									"flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground"
								)}
							>
								<Lock className="size-4 shrink-0" />
								This note is private. Only workspace members can see it.
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};
