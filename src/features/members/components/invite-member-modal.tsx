"use client";

import { useAction, useQuery } from "convex/react";
import {
	AlertTriangle,
	ChevronDown,
	Crown,
	MessageSquare,
	Minus,
	Plus,
	Users,
} from "lucide-react";
import Image from "next/image";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
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

const InviteModalHeader = () => {
	return (
		<div className="bg-gradient-to-br from-primary via-primary to-secondary p-8 text-white relative overflow-hidden">
			<div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
			<div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-secondary/25 rounded-full blur-3xl" />

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
				<DialogDescription className="text-white/85 text-lg max-w-[280px]">
					Invite new members to collaborate on your projects.
				</DialogDescription>
			</div>
		</div>
	);
};

type WorkspaceInviteRole = "owner" | "admin" | "member";

interface WorkspaceRoleSelectProps {
	role: WorkspaceInviteRole;
	setRole: (role: WorkspaceInviteRole) => void;
}

const WorkspaceRoleSelect = ({ role, setRole }: WorkspaceRoleSelectProps) => {
	return (
		<div className="space-y-2">
			<Label className="text-sm font-semibold flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
				<Crown className="size-4 text-secondary" />
				Workspace Role
			</Label>
			<Select
				onValueChange={(v: WorkspaceInviteRole) => setRole(v)}
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
							<div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary dark:bg-primary/25 dark:text-purple-200">
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
						className="py-4 cursor-pointer rounded-lg hover:bg-secondary/10 transition-colors"
						value="owner"
					>
						<div className="flex items-center gap-4">
							<div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary dark:bg-secondary/20">
								<Crown className="size-5" />
							</div>
							<div className="flex flex-col">
								<span className="font-bold text-base">Owner</span>
								<span className="text-[11px] text-secondary uppercase tracking-wider font-bold">
									Full billing, workspace, and role control
								</span>
							</div>
						</div>
					</SelectItem>

					<SelectItem
						className="py-4 cursor-pointer rounded-lg hover:bg-primary/10 transition-colors"
						value="admin"
					>
						<div className="flex items-center gap-4">
							<div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary dark:bg-primary/25 dark:text-purple-200">
								<Crown className="size-5" />
							</div>
							<div className="flex flex-col">
								<span className="font-bold text-base">Admin</span>
								<span className="text-[11px] text-primary dark:text-purple-200 uppercase tracking-wider font-bold">
									Full management and settings access
								</span>
							</div>
						</div>
					</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
};

interface SeatFullWarningBannerProps {
	isSeatsFull: boolean;
	addingSeats: boolean;
	seatChangePending: boolean;
	seatsToAdd: number;
	newTotalSeats: number;
	setSeatsToAdd: (seats: number) => void;
	handleAddSeat: () => void;
}

const SeatWarningHeader = () => {
	return (
		<div className="flex items-center gap-3">
			<div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600">
				<AlertTriangle className="size-5" />
			</div>
			<div className="flex flex-col">
				<span className="text-sm font-bold text-amber-900 dark:text-amber-100">
					Seats Finished
				</span>
				<span className="text-[12px] text-amber-700 dark:text-amber-300">
					You&apos;ve reached your seat limit.
				</span>
			</div>
		</div>
	);
};

const SeatFullWarningBanner = ({
	isSeatsFull,
	addingSeats,
	seatChangePending,
	seatsToAdd,
	newTotalSeats,
	setSeatsToAdd,
	handleAddSeat,
}: SeatFullWarningBannerProps) => {
	if (!isSeatsFull) return null;

	const updateSeatsToAdd = (value: number) => {
		setSeatsToAdd(Math.max(1, Math.floor(value) || 1));
	};
	const buttonLabel = seatChangePending
		? "Pending"
		: `Add ${seatsToAdd} Seat${seatsToAdd === 1 ? "" : "s"}`;

	return (
		<div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
			<SeatWarningHeader />
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-1">
					<Label className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
						Seats to add
					</Label>
					<div className="flex items-center gap-2">
						<Button
							aria-label="Decrease seats to add"
							className="size-9 rounded-lg"
							disabled={addingSeats || seatChangePending || seatsToAdd <= 1}
							onClick={() => updateSeatsToAdd(seatsToAdd - 1)}
							size="icon"
							type="button"
							variant="outline"
						>
							<Minus className="size-4" />
						</Button>
						<Input
							className="h-9 w-20 text-center font-semibold bg-white dark:bg-zinc-950"
							min={1}
							onChange={(event) => updateSeatsToAdd(Number(event.target.value))}
							type="number"
							value={seatsToAdd}
						/>
						<Button
							aria-label="Increase seats to add"
							className="size-9 rounded-lg"
							disabled={addingSeats || seatChangePending}
							onClick={() => updateSeatsToAdd(seatsToAdd + 1)}
							size="icon"
							type="button"
							variant="outline"
						>
							<Plus className="size-4" />
						</Button>
					</div>
					<p className="text-xs text-amber-700 dark:text-amber-300">
						New Dodo quantity: {newTotalSeats} seats
					</p>
				</div>
				<Button
					className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm"
					disabled={addingSeats || seatChangePending}
					onClick={handleAddSeat}
					size="sm"
					type="button"
				>
					{addingSeats ? (
						<div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
					) : (
						<div className="flex items-center gap-1">
							<Plus className="size-4" />
							{buttonLabel}
						</div>
					)}
				</Button>
			</div>
		</div>
	);
};

interface InviteModalFooterProps {
	workspaceName: string;
	inviteLoading: boolean;
	email: string;
	isSeatsFull: boolean;
	handleClose: () => void;
	sendInvite: () => void;
}

const InviteModalFooter = ({
	workspaceName,
	inviteLoading,
	email,
	isSeatsFull,
	handleClose,
	sendInvite,
}: InviteModalFooterProps) => {
	return (
		<div className="flex items-center justify-between">
			<div className="flex flex-col">
				<span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
					Workspace
				</span>
				<span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
					{workspaceName}
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
					className="px-8 h-11 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
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
	);
};

interface InviteMemberFieldsProps {
	email: string;
	role: WorkspaceInviteRole;
	comment: string;
	isSeatsFull: boolean;
	addingSeats: boolean;
	seatChangePending: boolean;
	seatsToAdd: number;
	newTotalSeats: number;
	setEmail: (email: string) => void;
	setRole: (role: WorkspaceInviteRole) => void;
	setComment: (comment: string) => void;
	setSeatsToAdd: (seats: number) => void;
	handleAddSeat: () => void;
}

const EmailField = ({
	email,
	setEmail,
}: Pick<InviteMemberFieldsProps, "email" | "setEmail">) => {
	return (
		<div className="space-y-2">
			<Label
				className="text-sm font-semibold flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
				htmlFor="email"
			>
				<Users className="size-4 text-primary" />
				Colleague&apos;s Email
			</Label>
			<Input
				className="h-12 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-secondary transition-all text-base"
				id="email"
				onChange={(e) => setEmail(e.target.value)}
				placeholder="colleague@example.com"
				type="email"
				value={email}
			/>
		</div>
	);
};

const InvitationNoteField = ({
	comment,
	setComment,
}: Pick<InviteMemberFieldsProps, "comment" | "setComment">) => {
	return (
		<div className="space-y-2">
			<Label
				className="text-sm font-semibold flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
				htmlFor="comment"
			>
				<MessageSquare className="size-4 text-secondary" />
				Invitation Note
			</Label>
			<Textarea
				className="min-h-[80px] border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-secondary resize-none transition-all"
				id="comment"
				onChange={(e) => setComment(e.target.value)}
				placeholder="Let them know why you're inviting them..."
				value={comment}
			/>
		</div>
	);
};

const InviteMemberFields = ({
	email,
	role,
	comment,
	isSeatsFull,
	addingSeats,
	seatChangePending,
	seatsToAdd,
	newTotalSeats,
	setEmail,
	setRole,
	setComment,
	setSeatsToAdd,
	handleAddSeat,
}: InviteMemberFieldsProps) => {
	return (
		<div className="space-y-4">
			<EmailField email={email} setEmail={setEmail} />
			<WorkspaceRoleSelect role={role} setRole={setRole} />
			<SeatFullWarningBanner
				addingSeats={addingSeats}
				handleAddSeat={handleAddSeat}
				isSeatsFull={isSeatsFull}
				newTotalSeats={newTotalSeats}
				seatChangePending={seatChangePending}
				seatsToAdd={seatsToAdd}
				setSeatsToAdd={setSeatsToAdd}
			/>
			<InvitationNoteField comment={comment} setComment={setComment} />
		</div>
	);
};

interface InviteModalBodyProps extends InviteMemberFieldsProps {
	scrollContainerRef: RefObject<HTMLDivElement>;
}

const InviteModalBody = ({
	scrollContainerRef,
	...fieldsProps
}: InviteModalBodyProps) => {
	return (
		<div
			className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950"
			ref={scrollContainerRef}
		>
			<div className="p-6 sm:p-8 space-y-6">
				<InviteMemberFields {...fieldsProps} />
			</div>
		</div>
	);
};

interface ScrollToActionsButtonProps {
	hasMoreBelow: boolean;
	scrollToActions: () => void;
}

const ScrollToActionsButton = ({
	hasMoreBelow,
	scrollToActions,
}: ScrollToActionsButtonProps) => {
	if (!hasMoreBelow) return null;

	return (
		<Button
			aria-label="Scroll to invite actions"
			className="absolute bottom-24 right-6 z-20 size-9 rounded-full bg-white text-secondary border border-secondary/20 shadow-lg hover:bg-secondary hover:text-white dark:bg-zinc-900 dark:hover:bg-secondary"
			onClick={scrollToActions}
			size="icon"
			type="button"
			variant="outline"
		>
			<ChevronDown className="size-4" />
		</Button>
	);
};

interface InviteDialogContentProps extends InviteMemberFieldsProps {
	handleClose: () => void;
	hasMoreBelow: boolean;
	inviteLoading: boolean;
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollToActions: () => void;
	sendInvite: () => void;
	workspaceName: string;
}

const InviteDialogContent = ({
	handleClose,
	hasMoreBelow,
	inviteLoading,
	scrollContainerRef,
	scrollToActions,
	sendInvite,
	workspaceName,
	...fieldsProps
}: InviteDialogContentProps) => {
	return (
		<DialogContent className="sm:max-w-[500px] max-h-[calc(100vh-2rem)] p-0 overflow-hidden border-none shadow-2xl rounded-2xl flex flex-col">
			<InviteModalHeader />
			<InviteModalBody
				scrollContainerRef={scrollContainerRef}
				{...fieldsProps}
			/>
			<div className="sticky bottom-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur px-6 sm:px-8 py-4 border-t border-zinc-100 dark:border-zinc-900">
				<InviteModalFooter
					email={fieldsProps.email}
					handleClose={handleClose}
					inviteLoading={inviteLoading}
					isSeatsFull={fieldsProps.isSeatsFull}
					sendInvite={sendInvite}
					workspaceName={workspaceName}
				/>
			</div>
			<ScrollToActionsButton
				hasMoreBelow={hasMoreBelow}
				scrollToActions={scrollToActions}
			/>
		</DialogContent>
	);
};

export const InviteMemberModal = () => {
	const workspaceId = useWorkspaceId();
	const [open, setOpen] = useInviteMemberModal();
	const workspace = useQuery(
		api.workspaces.getById,
		workspaceId ? { id: workspaceId } : "skip"
	);

	const [email, setEmail] = useState("");
	const [role, setRole] = useState<WorkspaceInviteRole>("member");
	const [comment, setComment] = useState("");
	const [inviteLoading, setInviteLoading] = useState(false);
	const [addingSeats, setAddingSeats] = useState(false);
	const [seatChangePending, setSeatChangePending] = useState(false);
	const [seatsToAdd, setSeatsToAdd] = useState(1);
	const [hasMoreBelow, setHasMoreBelow] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

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
	const newTotalSeats = totalSeats + seatsToAdd;

	useEffect(() => {
		if (!isSeatsFull) {
			setSeatChangePending(false);
		}
	}, [isSeatsFull]);

	useEffect(() => {
		const scrollContainer = scrollContainerRef.current;
		if (!open || !scrollContainer) return undefined;

		const updateScrollButton = () => {
			const remainingScroll =
				scrollContainer.scrollHeight -
				scrollContainer.scrollTop -
				scrollContainer.clientHeight;
			setHasMoreBelow(remainingScroll > 24);
		};

		updateScrollButton();
		const frameId = window.requestAnimationFrame(updateScrollButton);
		scrollContainer.addEventListener("scroll", updateScrollButton);
		window.addEventListener("resize", updateScrollButton);

		return function cleanupScrollButton() {
			window.cancelAnimationFrame(frameId);
			scrollContainer.removeEventListener("scroll", updateScrollButton);
			window.removeEventListener("resize", updateScrollButton);
		};
	}, [open]);

	const scrollToActions = () => {
		const scrollContainer = scrollContainerRef.current;
		if (!scrollContainer) return;

		scrollContainer.scrollTo({
			behavior: "smooth",
			top: scrollContainer.scrollHeight,
		});
	};

	const handleClose = () => {
		setOpen(false);
		setEmail("");
		setRole("member");
		setComment("");
		setInviteLoading(false);
		setAddingSeats(false);
		setSeatChangePending(false);
		setSeatsToAdd(1);
	};

	const handleAddSeat = async () => {
		if (!workspaceId) return;
		setAddingSeats(true);
		try {
			const result = await updateQuantity({
				workspaceId,
				newQuantity: newTotalSeats,
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
			if (
				billingResult.status === "payment_required" ||
				billingResult.status === "pending_payment"
			) {
				if (billingResult.paymentUrl) {
					window.location.href = billingResult.paymentUrl;
					return;
				}
				setSeatChangePending(false);
				toast.info(
					billingResult.message ||
						"Complete the pending billing step to activate the new seat."
				);
				return;
			}
			if (billingResult.status === "pending_plan_change") {
				setSeatChangePending(false);
				toast.info(
					billingResult.message ||
						"A billing change is already pending for this workspace."
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

	const sendInvite = async () => {
		if (!email) {
			toast.error("Please enter an email address");
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email.trim())) {
			toast.error("Please enter a valid email address");
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
			<InviteDialogContent
				addingSeats={addingSeats}
				comment={comment}
				email={email}
				handleAddSeat={handleAddSeat}
				handleClose={handleClose}
				hasMoreBelow={hasMoreBelow}
				inviteLoading={inviteLoading}
				isSeatsFull={isSeatsFull}
				newTotalSeats={newTotalSeats}
				role={role}
				scrollContainerRef={scrollContainerRef}
				scrollToActions={scrollToActions}
				seatChangePending={seatChangePending}
				seatsToAdd={seatsToAdd}
				sendInvite={sendInvite}
				setComment={setComment}
				setEmail={setEmail}
				setRole={setRole}
				setSeatsToAdd={setSeatsToAdd}
				workspaceName={workspace?.name ?? "Workspace"}
			/>
		</Dialog>
	);
};
