"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PasswordStrengthIndicator } from "./password-strength-indicator";
import { isPasswordValid } from "../utils/password-validation";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

export const PasswordChangeForm = () => {
	const router = useRouter();
	const { signOut } = useAuthActions();
	const changePassword = useMutation(api.passwordManagement.changePassword);

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validation
		if (!currentPassword || !newPassword || !confirmPassword) {
			toast.error("All fields are required");
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("New passwords do not match");
			return;
		}

		if (!isPasswordValid(newPassword)) {
			toast.error("Password does not meet all requirements");
			return;
		}

		if (currentPassword === newPassword) {
			toast.error("New password must be different from current password");
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
					router.push("/signin");
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
					<Lock className="h-5 w-5 text-purple-500" />
					<CardTitle>Change Password</CardTitle>
				</div>
				<CardDescription>
					Update your password to keep your account secure
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="current-password">
							Current Password
						</Label>
						<Input
							id="current-password"
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							disabled={isSubmitting}
							placeholder="Enter current password"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="new-password">
							New Password
						</Label>
						<Input
							id="new-password"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							disabled={isSubmitting}
							placeholder="Enter new password"
						/>
						{newPassword && (
							<PasswordStrengthIndicator
								password={newPassword}
								showRequirements={true}
							/>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirm-password">
							Confirm Password
						</Label>
						<Input
							id="confirm-password"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							disabled={isSubmitting}
							placeholder="Confirm new password"
						/>
						{confirmPassword && newPassword !== confirmPassword && (
							<p className="text-sm text-destructive">Passwords do not match</p>
						)}
					</div>

					<Button
						type="submit"
						disabled={isSubmitting}
						className="w-full bg-purple-600 hover:bg-purple-700 text-white"
					>
						{isSubmitting ? "Changing Password..." : "Change Password"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
};
