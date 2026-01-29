"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
import { PasswordStrengthIndicator } from "@/features/auth/components/password-strength-indicator";
import { isPasswordValid } from "@/features/auth/utils/password-validation";
import { useDocumentTitle } from "@/hooks/use-document-title";

const ResetPasswordContent = () => {
	useDocumentTitle("Reset Password");

	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const verifyToken = useQuery(
		api.passwordManagement.verifyResetToken,
		token ? { token } : "skip"
	);
	const resetPassword = useMutation(api.passwordManagement.resetPassword);

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!token) {
			toast.error("Invalid reset link");
			router.push("/forgot-password");
		}
	}, [token, router]);

	useEffect(() => {
		if (verifyToken && !verifyToken.valid) {
			toast.error(verifyToken.message || "Invalid or expired reset link");
			setTimeout(() => {
				router.push("/forgot-password");
			}, 2000);
		}
	}, [verifyToken, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!token) {
			toast.error("Invalid reset link");
			return;
		}

		if (!newPassword || !confirmPassword) {
			toast.error("All fields are required");
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error("Passwords do not match");
			return;
		}

		if (!isPasswordValid(newPassword)) {
			toast.error("Password does not meet all requirements");
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await resetPassword({
				token,
				newPassword,
			});

			if (result.success) {
				toast.success("Password reset successfully!");
				toast.info("Please sign in with your new password");

				// Redirect to sign in page
				setTimeout(() => {
					router.push("/signin");
				}, 1500);
			}
		} catch (error) {
			console.error("Password reset error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to reset password"
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Show loading while verifying token
	if (!verifyToken) {
		return (
			<div className="flex h-full items-center justify-center bg-primary">
				<div className="flex flex-col items-center gap-4 text-white">
					<Loader2 className="h-8 w-8 animate-spin" />
					<p className="text-lg">Verifying reset link...</p>
				</div>
			</div>
		);
	}

	// Show error if token is invalid
	if (!verifyToken.valid) {
		return (
			<div className="flex h-full items-center justify-center bg-primary">
				<Card className="md:h-auto md:w-[420px] p-8 shadow-xl">
					<CardHeader className="px-0 pt-0">
						<CardTitle className="text-red-600">Invalid Reset Link</CardTitle>
						<CardDescription>
							{verifyToken.message ||
								"This password reset link is invalid or has expired."}
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0 pb-0">
						<Button
							onClick={() => router.push("/forgot-password")}
							className="w-full bg-primary hover:bg-primary/90"
						>
							Request New Reset Link
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex h-full items-center justify-center bg-primary">
			<div className="md:h-auto md:w-[420px] animate-fade-in">
				<Card className="size-full p-8 shadow-xl border-opacity-30 backdrop-blur-sm animate-slide-up rounded-[10px]">
					<CardHeader className="px-0 pt-0">
						<div className="flex items-center gap-2 mb-2">
							<Lock className="h-6 w-6 text-secondary" />
							<CardTitle>Reset Your Password</CardTitle>
						</div>
						<CardDescription>
							Enter a new password for{" "}
							<strong className="text-secondary">{verifyToken.email}</strong>
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-5 px-0 pb-0">
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="new-password">New Password</Label>
								<Input
									id="new-password"
									type="password"
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									disabled={isSubmitting}
									placeholder="Enter new password"
									required
								/>
								{newPassword && (
									<PasswordStrengthIndicator
										password={newPassword}
										showRequirements={true}
									/>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirm-password">Confirm Password</Label>
								<Input
									id="confirm-password"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									disabled={isSubmitting}
									placeholder="Confirm new password"
									required
								/>
								{confirmPassword && newPassword !== confirmPassword && (
									<p className="text-sm text-red-500">Passwords do not match</p>
								)}
							</div>

							<Button
								type="submit"
								className="bg-primary w-full transition-standard hover:shadow-lg hover:bg-primary/90"
								size="lg"
								disabled={isSubmitting || !isPasswordValid(newPassword)}
							>
								{isSubmitting ? "Resetting Password..." : "Reset Password"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

const ResetPasswordPage = () => {
	return (
		<Suspense
			fallback={
				<div className="flex h-full items-center justify-center bg-primary">
					<Loader2 className="h-8 w-8 animate-spin text-white" />
				</div>
			}
		>
			<ResetPasswordContent />
		</Suspense>
	);
};

export default ResetPasswordPage;
