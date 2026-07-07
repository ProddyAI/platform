"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isPasswordValid } from "../utils/password-validation";
import { PasswordStrengthIndicator } from "./password-strength-indicator";

export const PasswordChangeForm = () => {
	const router = useRouter();
	const { signOut } = useAuthActions();
	const changePassword = useMutation(
		api.authn.passwordManagement.changePassword
	);

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);

		// Validation
		if (!currentPassword || !newPassword || !confirmPassword) {
			setFormError("All fields are required");
			return;
		}

		if (newPassword !== confirmPassword) {
			setFormError("New passwords do not match");
			return;
		}

		if (!isPasswordValid(newPassword)) {
			setFormError("Password does not meet all requirements");
			return;
		}

		if (currentPassword === newPassword) {
			setFormError("New password must be different from current password");
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await changePassword({
				currentPassword,
				newPassword,
			});

			if (result.success) {
				toast.success("Password changed successfully");

				// Clear form
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");

				// If re-authentication is required, sign out and redirect
				if (result.requiresReauth) {
					toast.info("Please sign in with your new password");
					await signOut();
					router.push("/auth/signin");
				}
			}
		} catch (error) {
			console.error("Password change error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to change password"
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card className="bg-muted/50 border-border">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Lock className="h-5 w-5 text-primary" />
					<CardTitle>Change Password</CardTitle>
				</div>
				<CardDescription>
					Update your password to keep your account secure
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="current-password">Current Password</Label>
						<Input
							disabled={isSubmitting}
							id="current-password"
							onChange={(e) => {
								setCurrentPassword(e.target.value);
								setFormError(null);
							}}
							placeholder="Enter current password"
							type="password"
							value={currentPassword}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="new-password">New Password</Label>
						<Input
							disabled={isSubmitting}
							id="new-password"
							onChange={(e) => {
								setNewPassword(e.target.value);
								setFormError(null);
							}}
							placeholder="Enter new password"
							type="password"
							value={newPassword}
						/>
						{newPassword && (
							<PasswordStrengthIndicator
								password={newPassword}
								showRequirements
							/>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirm-password">Confirm Password</Label>
						<Input
							disabled={isSubmitting}
							id="confirm-password"
							onChange={(e) => {
								setConfirmPassword(e.target.value);
								setFormError(null);
							}}
							placeholder="Confirm new password"
							type="password"
							value={confirmPassword}
						/>
						{confirmPassword && newPassword !== confirmPassword && (
							<p className="text-sm text-destructive">Passwords do not match</p>
						)}
					</div>

					{formError && <p className="text-sm text-destructive">{formError}</p>}

					<Button className="w-full" disabled={isSubmitting} type="submit">
						{isSubmitting ? "Changing Password..." : "Change Password"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
};
