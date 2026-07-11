"use client";

import { useAction, useQuery } from "convex/react";
import { AlertTriangle, MessageSquare, Minus, Plus } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
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
import { useCurrentMember } from "@/features/members/api/use-current-member";
import type { WorkspaceRole } from "@/features/members/lib/roles";
import { INVITE_ROLES, ROLE_META } from "@/features/members/lib/roles";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { api } from "../../../../convex/_generated/api";
import { useInviteMemberModal } from "../store/use-invite-member-modal";

const getErrorMessage = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WorkspaceInviteRole = Exclude<WorkspaceRole, "viewer">;

interface WorkspaceRoleSelectProps {
	role: WorkspaceInviteRole;
	setRole: (role: WorkspaceInviteRole) => void;
	currentUserRole: WorkspaceRole | undefined;
}

const WorkspaceRoleSelect = ({
	role,
	setRole,
	currentUserRole,
}: WorkspaceRoleSelectProps) => {
	const offeredRoles = INVITE_ROLES.filter(
		(value) => value !== "owner" || currentUserRole === "owner"
	) as WorkspaceInviteRole[];

	return (
		<div className="space-y-2">
			<Label className="text-sm font-semibold" htmlFor="role">
				Workspace Role
			</Label>
			<Select
				onValueChange={(v: WorkspaceInviteRole) => setRole(v)}
				value={role}
			>
				<SelectTrigger id="role">
					<SelectValue placeholder="Select role" />
				</SelectTrigger>
				<SelectContent>
					{offeredRoles.map((value) => {
						const { label, description, icon: Icon } = ROLE_META[value];
						return (
							<SelectItem key={value} value={value}>
								<div className="flex items-center gap-2">
									<Icon className="size-4 text-muted-foreground" />
									<div className="flex flex-col">
										<span className="font-medium">{label}</span>
										<span className="text-xs text-muted-foreground">
											{description}
										</span>
									</div>
								</div>
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>
		</div>
	);
};

interface SeatFullWarningBannerProps {
	isSeatsFull: boolean;
	seatChangePending: boolean;
	addingSeats: boolean;
	seatsToAdd: number;
	setSeatsToAdd: (seats: number) => void;
	newTotalSeats: number;
	handleAddSeat: () => void;
}

interface SeatWarningHeaderProps {
	seatChangePending: boolean;
}

const SeatWarningHeader = ({ seatChangePending }: SeatWarningHeaderProps) => {
	return (
		<div className="flex items-center gap-3">
			<div className="size-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
				<AlertTriangle className="size-5" />
			</div>
			<div className="flex flex-col">
				<span className="text-sm font-semibold text-foreground">
					{seatChangePending ? "Billing pending" : "You're out of seats"}
				</span>
				<span className="text-[12px] text-muted-foreground">
					{seatChangePending
						? "Your new seat is processing."
						: "You've reached your seat limit."}
				</span>
			</div>
		</div>
	);
};

interface SeatStepperProps {
	addingSeats: boolean;
	seatChangePending: boolean;
	seatsToAdd: number;
	updateSeatsToAdd: (value: number) => void;
}

const SeatStepper = ({
	addingSeats,
	seatChangePending,
	seatsToAdd,
	updateSeatsToAdd,
}: SeatStepperProps) => {
	return (
		<div className="flex items-center gap-2">
			<Button
				aria-label="Decrease seats to add"
				disabled={addingSeats || seatChangePending || seatsToAdd <= 1}
				onClick={() => updateSeatsToAdd(seatsToAdd - 1)}
				size="iconSm"
				type="button"
				variant="outline"
			>
				<Minus className="size-4" />
			</Button>
			<Input
				aria-label="Number of seats to add"
				className="h-8 w-20 text-center font-semibold"
				min={1}
				onChange={(event) => updateSeatsToAdd(Number(event.target.value))}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.preventDefault();
				}}
				type="number"
				value={seatsToAdd}
			/>
			<Button
				aria-label="Increase seats to add"
				disabled={addingSeats || seatChangePending}
				onClick={() => updateSeatsToAdd(seatsToAdd + 1)}
				size="iconSm"
				type="button"
				variant="outline"
			>
				<Plus className="size-4" />
			</Button>
		</div>
	);
};

interface SeatQuantityControlsProps {
	addingSeats: boolean;
	seatChangePending: boolean;
	seatsToAdd: number;
	newTotalSeats: number;
	updateSeatsToAdd: (value: number) => void;
}

const SeatQuantityControls = ({
	addingSeats,
	seatChangePending,
	seatsToAdd,
	newTotalSeats,
	updateSeatsToAdd,
}: SeatQuantityControlsProps) => {
	return (
		<div className="space-y-1">
			<Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warning">
				Seats to add
			</Label>
			<SeatStepper
				addingSeats={addingSeats}
				seatChangePending={seatChangePending}
				seatsToAdd={seatsToAdd}
				updateSeatsToAdd={updateSeatsToAdd}
			/>
			<p className="text-xs text-muted-foreground">
				Your plan will have {newTotalSeats} seats
			</p>
		</div>
	);
};

interface AddSeatsButtonProps {
	addingSeats: boolean;
	seatChangePending: boolean;
	seatsToAdd: number;
	handleAddSeat: () => void;
}

const AddSeatsButton = ({
	addingSeats,
	seatChangePending,
	seatsToAdd,
	handleAddSeat,
}: AddSeatsButtonProps) => {
	const buttonLabel = seatChangePending
		? "Pending"
		: `Add ${seatsToAdd} seat${seatsToAdd === 1 ? "" : "s"}`;

	return (
		<Button
			className="bg-warning hover:bg-warning/90 text-warning-foreground font-semibold"
			disabled={addingSeats || seatChangePending}
			loading={addingSeats}
			onClick={handleAddSeat}
			size="sm"
			type="button"
		>
			{!addingSeats && <Plus className="mr-2 size-4" />}
			{buttonLabel}
		</Button>
	);
};

const SeatFullWarningBanner = ({
	isSeatsFull,
	seatChangePending,
	addingSeats,
	seatsToAdd,
	setSeatsToAdd,
	newTotalSeats,
	handleAddSeat,
}: SeatFullWarningBannerProps) => {
	if (!isSeatsFull) return null;

	const updateSeatsToAdd = (value: number) => {
		setSeatsToAdd(Math.max(1, Math.floor(value) || 1));
	};

	return (
		<div className="p-4 bg-warning/10 border border-warning/30 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-slow motion-reduce:animate-none">
			<SeatWarningHeader seatChangePending={seatChangePending} />
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<SeatQuantityControls
					addingSeats={addingSeats}
					newTotalSeats={newTotalSeats}
					seatChangePending={seatChangePending}
					seatsToAdd={seatsToAdd}
					updateSeatsToAdd={updateSeatsToAdd}
				/>
				<AddSeatsButton
					addingSeats={addingSeats}
					handleAddSeat={handleAddSeat}
					seatChangePending={seatChangePending}
					seatsToAdd={seatsToAdd}
				/>
			</div>
		</div>
	);
};

interface InviteMemberFieldsProps {
	email: string;
	emailError: string | null;
	role: WorkspaceInviteRole;
	currentUserRole: WorkspaceRole | undefined;
	comment: string;
	addingSeats: boolean;
	seatChangePending: boolean;
	seatsToAdd: number;
	isSeatsFull: boolean;
	newTotalSeats: number;
	setEmail: (email: string) => void;
	setRole: (role: WorkspaceInviteRole) => void;
	setComment: (comment: string) => void;
	setSeatsToAdd: (seats: number) => void;
	handleAddSeat: () => void;
}

const EmailField = ({
	email,
	emailError,
	setEmail,
}: Pick<InviteMemberFieldsProps, "email" | "emailError" | "setEmail">) => {
	return (
		<div className="space-y-2">
			<Label className="text-sm font-semibold" htmlFor="email">
				Colleague&apos;s Email
			</Label>
			<Input
				aria-describedby={emailError ? "email-error" : undefined}
				aria-invalid={Boolean(emailError)}
				id="email"
				onChange={(e) => setEmail(e.target.value)}
				placeholder="colleague@example.com"
				type="email"
				value={email}
			/>
			{emailError && (
				<p className="text-sm text-destructive" id="email-error">
					{emailError}
				</p>
			)}
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
				className="flex items-center gap-2 text-sm font-semibold"
				htmlFor="comment"
			>
				<MessageSquare className="size-4" />
				Invitation Note
			</Label>
			<Textarea
				className="min-h-[80px] resize-none"
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
	emailError,
	role,
	currentUserRole,
	comment,
	addingSeats,
	seatChangePending,
	seatsToAdd,
	isSeatsFull,
	newTotalSeats,
	setEmail,
	setRole,
	setComment,
	setSeatsToAdd,
	handleAddSeat,
}: InviteMemberFieldsProps) => {
	return (
		<div className="space-y-4 py-4">
			<EmailField email={email} emailError={emailError} setEmail={setEmail} />
			<WorkspaceRoleSelect
				currentUserRole={currentUserRole}
				role={role}
				setRole={setRole}
			/>
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

interface InviteModalActionsProps {
	inviteLoading: boolean;
	email: string;
	isSeatsFull: boolean;
	handleClose: () => void;
}

const InviteModalActions = ({
	inviteLoading,
	email,
	isSeatsFull,
	handleClose,
}: InviteModalActionsProps) => {
	return (
		<DialogFooter>
			<Button onClick={handleClose} type="button" variant="outline">
				Cancel
			</Button>
			<Button
				disabled={inviteLoading || !email || isSeatsFull}
				loading={inviteLoading}
				type="submit"
			>
				{inviteLoading ? "Sending..." : "Send Invite"}
			</Button>
		</DialogFooter>
	);
};

interface InviteDialogContentProps extends InviteMemberFieldsProps {
	handleClose: () => void;
	handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
	inviteLoading: boolean;
	workspaceName: string;
}

const InviteDialogContent = ({
	handleClose,
	handleSubmit,
	inviteLoading,
	workspaceName,
	...fieldsProps
}: InviteDialogContentProps) => {
	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle className="truncate">
					Invite to {workspaceName}
				</DialogTitle>
				<DialogDescription>
					Invite a teammate to collaborate in this workspace.
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<InviteMemberFields {...fieldsProps} />
				<InviteModalActions
					email={fieldsProps.email}
					handleClose={handleClose}
					inviteLoading={inviteLoading}
					isSeatsFull={fieldsProps.isSeatsFull}
				/>
			</form>
		</DialogContent>
	);
};

export const InviteMemberModal = () => {
	const workspaceId = useWorkspaceId();
	const [open, setOpen] = useInviteMemberModal();
	const workspace = useQuery(
		api.workspace.workspaces.getById,
		workspaceId ? { id: workspaceId } : "skip"
	);
	const { data: currentMember } = useCurrentMember({ workspaceId });

	const [email, setEmail] = useState("");
	const [emailError, setEmailError] = useState<string | null>(null);
	const [role, setRole] = useState<WorkspaceInviteRole>("member");
	const [comment, setComment] = useState("");
	const [inviteLoading, setInviteLoading] = useState(false);
	const [addingSeats, setAddingSeats] = useState(false);
	const [seatChangePending, setSeatChangePending] = useState(false);
	const [seatsToAdd, setSeatsToAdd] = useState(1);

	const updateQuantity = useAction(
		api.billing.payments.updateSubscriptionQuantity
	);

	const seatUsage = useQuery(
		api.workspace.invites.getSeatUsage,
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

	const handleEmailChange = (value: string) => {
		setEmail(value);
		if (emailError) setEmailError(null);
	};

	const handleAddSeat = async () => {
		if (!workspaceId) return;
		setAddingSeats(true);
		setSeatChangePending(true);
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
				toast.info(
					billingResult.message ||
						"We're processing your prorated charge. The seat will be available once payment succeeds."
				);
				return;
			}
			if (billingResult.status === "pending_plan_change") {
				toast.info(
					billingResult.message || "A seat change is already processing."
				);
				return;
			}
			toast.success("Seat added.");
		} catch (error: unknown) {
			toast.error(getErrorMessage(error, "Failed to add seat"));
		} finally {
			setAddingSeats(false);
			setSeatChangePending(false);
		}
	};

	const handleClose = () => {
		setOpen(false);
		setEmail("");
		setEmailError(null);
		setRole("member");
		setComment("");
		setInviteLoading(false);
		setSeatChangePending(false);
		setSeatsToAdd(1);
	};

	const sendInvite = async () => {
		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			setEmailError("Enter an email address");
			return;
		}
		if (!EMAIL_PATTERN.test(trimmedEmail)) {
			setEmailError("Enter a valid email address");
			return;
		}
		setEmailError(null);

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

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		sendInvite();
	};

	return (
		<Dialog onOpenChange={handleClose} open={open}>
			<InviteDialogContent
				addingSeats={addingSeats}
				comment={comment}
				currentUserRole={currentMember?.role}
				email={email}
				emailError={emailError}
				handleAddSeat={handleAddSeat}
				handleClose={handleClose}
				handleSubmit={handleSubmit}
				inviteLoading={inviteLoading}
				isSeatsFull={isSeatsFull}
				newTotalSeats={newTotalSeats}
				role={currentMember?.role === "owner" ? role : "member"}
				seatChangePending={seatChangePending}
				seatsToAdd={seatsToAdd}
				setComment={setComment}
				setEmail={handleEmailChange}
				setRole={setRole}
				setSeatsToAdd={setSeatsToAdd}
				workspaceName={workspace?.name ?? "Workspace"}
			/>
		</Dialog>
	);
};
