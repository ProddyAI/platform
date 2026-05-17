"use client";

import { useAction, useQuery } from "convex/react";
import { AlertTriangle, Crown, MessageSquare, Plus, Users } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { api } from "../../../../convex/_generated/api";
import { useInviteMemberModal } from "../store/use-invite-member-modal";

const getErrorMessage = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export const InviteMemberModal = () => {
	const workspaceId = useWorkspaceId();
	const [open, setOpen] = useInviteMemberModal();
	const workspace = useQuery(
		api.workspaces.getById,
		workspaceId ? { id: workspaceId } : "skip"
	);

	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"admin" | "member">("member");
	const [comment, setComment] = useState("");
	const [inviteLoading, setInviteLoading] = useState(false);
	const [addingSeats, setAddingSeats] = useState(false);
	const [seatChangePending, setSeatChangePending] = useState(false);

	const updateQuantity = useAction(api.payments.updateSubscriptionQuantity);

	const seatUsage = useQuery(
		api.workspaceInvites.getSeatUsage,
		workspaceId ? { workspaceId } : "skip"
	);

	const totalSeats =
		(seatUsage?.plan === "enterprise"
			? seatUsage.enterpriseSeats
			: seatUsage?.proSeats) ?? 0;
	const usedSeats =
		(seatUsage?.occupiedSeats ?? 0) + (seatUsage?.pendingInvites ?? 0);
	const isPlanPaid =
		seatUsage?.plan === "pro" || seatUsage?.plan === "enterprise";
	const isSeatsFull = isPlanPaid && usedSeats >= totalSeats;

	useEffect(() => {
		if (!isSeatsFull) {
			setSeatChangePending(false);
		}
	}, [isSeatsFull]);

	const handleAddSeat = async () => {
		if (!workspaceId) return;
		setAddingSeats(true);
		try {
			const result = await updateQuantity({
				workspaceId,
				newQuantity: totalSeats + 1,
			});
			const billingResult = result as {
				status?: string;
				message?: string;
				paymentUrl?: string | null;
			};
			if (
				billingResult.status === "billing_permission_required" ||
				billingResult.status === "billing_provider_error" ||
				billingResult.status === "previous_payment_pending"
			) {
				toast.error(
					billingResult.message || "Billing permissions need updating."
				);
				return;
			}
			if (billingResult.status === "payment_required") {
				if (billingResult.paymentUrl) {
					window.location.href = billingResult.paymentUrl;
					return;
				}
				setSeatChangePending(true);
				toast.info(
					billingResult.message ||
						"Complete the payment flow. The seat will be available after payment succeeds."
				);
				return;
			}
			if (billingResult.status === "pending_plan_change") {
				setSeatChangePending(true);
				toast.info(
					billingResult.message || "A seat change is already processing."
				);
				return;
			}
			toast.success("Seat added successfully!");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Failed to add seat"));
		} finally {
			setAddingSeats(false);
		}
	};

	const handleClose = () => {
		setOpen(false);
		setEmail("");
		setRole("member");
		setComment("");
		setInviteLoading(false);
		setSeatChangePending(false);
	};

	const sendInvite = async () => {
		if (!email) {
			toast.error("Please enter an email address");
			return;
		}

		setInviteLoading(true);
		try {
			const response = await fetch("/api/account/invite", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					workspaceId,
					email,
					role,
					comment,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to send invite");
			}

			toast.success(`Invite sent to ${email}`);
			handleClose();
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Failed to send invite"));
		} finally {
			setInviteLoading(false);
		}
	};

	return (
		<Dialog onOpenChange={handleClose} open={open}>
			<DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
				<div className="bg-gradient-to-br from-[#4a0a4f] via-[#7c3aed] to-[#ec4899] p-8 text-white relative overflow-hidden">
					<div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
					<div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl" />

					<div className="relative z-10 flex flex-col items-center text-center">
						<div className="size-16 bg-white rounded-2xl flex items-center justify-center mb-4 border border-white/30 shadow-xl ring-4 ring-white/10 animate-in zoom-in duration-500">
							<Image
								alt="Proddy"
								className="object-contain"
								height={45}
								src="/logo.png"
								width={45}
							/>
						</div>
						<DialogTitle className="text-3xl font-bold tracking-tight text-white mb-2">
							Grow Your Team
						</DialogTitle>
						<DialogDescription className="text-purple-100 text-lg max-w-[280px]">
							Invite new members to collaborate on your projects.
						</DialogDescription>
					</div>
				</div>

				<div className="p-8 space-y-6 bg-white dark:bg-zinc-950">
					<div className="space-y-4">
						<div className="space-y-2">
							<Label
								className="text-sm font-semibold flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
								htmlFor="email"
							>
								<Users className="size-4 text-[#7c3aed]" />
								Colleague&apos;s Email
							</Label>
							<Input
								className="h-12 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-[#7c3aed] transition-all text-base"
								id="email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="colleague@example.com"
								type="email"
								value={email}
							/>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-semibold flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
								<Crown className="size-4 text-amber-500" />
								Workspace Role
							</Label>
							<Select
								onValueChange={(v: "admin" | "member") => setRole(v)}
								value={role}
							>
								<SelectTrigger className="h-14 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 transition-all font-medium text-lg">
									<SelectValue placeholder="Select Role" />
								</SelectTrigger>
								<SelectContent className="border-none shadow-xl rounded-xl p-2">
									<SelectItem
										className="py-4 cursor-pointer rounded-lg hover:bg-zinc-100 transition-colors"
										value="member"
									>
										<div className="flex items-center gap-4">
											<div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
												<Users className="size-5" />
											</div>
											<div className="flex flex-col">
												<span className="font-bold text-base">Member</span>
												<span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
													Standard access to workspace features
												</span>
											</div>
										</div>
									</SelectItem>

									<SelectItem
										className="py-4 cursor-pointer rounded-lg hover:bg-purple-50 transition-colors"
										value="admin"
									>
										<div className="flex items-center gap-4">
											<div className="size-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
												<Crown className="size-5" />
											</div>
											<div className="flex flex-col">
												<span className="font-bold text-base">Admin</span>
												<span className="text-[11px] text-purple-600 uppercase tracking-wider font-bold">
													Full management and settings access
												</span>
											</div>
										</div>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{isSeatsFull && (
							<div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
								<div className="flex items-center gap-3">
									<div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600">
										<AlertTriangle className="size-5" />
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-bold text-amber-900 dark:text-amber-100">
											{seatChangePending ? "Billing Pending" : "Seats Finished"}
										</span>
										<span className="text-[12px] text-amber-700 dark:text-amber-300">
											{seatChangePending
												? "Your new seat is processing."
												: "You've reached your seat limit."}
										</span>
									</div>
								</div>
								<Button
									className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
									disabled={addingSeats || seatChangePending}
									onClick={handleAddSeat}
									size="sm"
								>
									{addingSeats ? (
										<div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									) : (
										<div className="flex items-center gap-1">
											<Plus className="size-4" />
											{seatChangePending ? "Pending" : "Add Seat"}
										</div>
									)}
								</Button>
							</div>
						)}

						<div className="space-y-2">
							<Label
								className="text-sm font-semibold flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
								htmlFor="comment"
							>
								<MessageSquare className="size-4 text-pink-500" />
								Invitation Note
							</Label>
							<Textarea
								className="min-h-[80px] border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:ring-2 focus:ring-[#7c3aed] resize-none transition-all"
								id="comment"
								onChange={(e) => setComment(e.target.value)}
								placeholder="Let them know why you're inviting them..."
								value={comment}
							/>
						</div>
					</div>

					<div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-900">
						<div className="flex flex-col">
							<span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
								Workspace
							</span>
							<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								{workspace?.name ?? "Workspace"}
							</span>
						</div>
						<div className="flex gap-3">
							<Button
								className="px-6 h-11 font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
								onClick={handleClose}
								variant="ghost"
							>
								Cancel
							</Button>
							<Button
								className="px-8 h-11 bg-gradient-to-r from-[#7c3aed] to-[#ec4899] hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
								disabled={inviteLoading || !email || isSeatsFull}
								onClick={sendInvite}
							>
								{inviteLoading ? (
									<div className="flex items-center gap-2">
										<div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
										Sending...
									</div>
								) : (
									"Send Invite"
								)}
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
