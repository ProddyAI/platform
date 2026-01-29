"use client";

import { useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
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
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";

const ForgotPasswordPage = () => {
	useDocumentTitle("Forgot Password");

	const requestPasswordReset = useMutation(
		api.passwordManagement.requestPasswordReset
	);

	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [emailSent, setEmailSent] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email) {
			toast.error("Please enter your email address");
			return;
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			toast.error("Please enter a valid email address");
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await requestPasswordReset({ email });

			if (result.success) {
				// Send email via API route
				const response = await fetch("/api/password-reset/send", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						email: result.email,
						token: result.token,
					}),
				});

				if (response.ok) {
					setEmailSent(true);
					toast.success("Password reset link sent to your email");
				} else {
					toast.error("Failed to send reset email. Please try again.");
				}
			}
		} catch (error) {
			console.error("Password reset request error:", error);
			toast.error("An error occurred. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex h-full items-center justify-center bg-primary">
			<div className="md:h-auto md:w-[420px] animate-fade-in">
				<Card className="size-full p-8 shadow-xl border-opacity-30 backdrop-blur-sm animate-slide-up rounded-[10px]">
					<CardHeader className="px-0 pt-0">
						<div className="flex items-center gap-2 mb-2">
							<Mail className="h-6 w-6 text-secondary" />
							<CardTitle>Forgot Password?</CardTitle>
						</div>
						<CardDescription>
							{emailSent
								? "Check your email for a password reset link."
								: "Enter your email address and we'll send you a link to reset your password."}
						</CardDescription>
					</CardHeader>

					<CardContent className="space-y-5 px-0 pb-0">
						{!emailSent ? (
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email Address</Label>
									<Input
										id="email"
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										disabled={isSubmitting}
										placeholder="Enter your email"
										required
									/>
								</div>

								<Button
									type="submit"
									className="bg-primary w-full transition-standard hover:shadow-lg hover:bg-primary/90"
									size="lg"
									disabled={isSubmitting}
								>
									{isSubmitting ? "Sending..." : "Send Reset Link"}
								</Button>
							</form>
						) : (
							<div className="space-y-4">
								<div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
									<p className="font-medium mb-1">Email Sent Successfully!</p>
									<p>
										We've sent a password reset link to <strong>{email}</strong>.
										Please check your inbox and follow the instructions.
									</p>
								</div>

								<p className="text-sm text-muted-foreground text-center">
									Didn't receive the email? Check your spam folder or{" "}
									<button
										type="button"
										onClick={() => setEmailSent(false)}
										className="text-secondary hover:underline font-medium"
									>
										try again
									</button>
								</p>
							</div>
						)}

						<div className="pt-4">
							<Link
								href="/signin"
								className="flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors justify-center"
							>
								<ArrowLeft className="h-4 w-4" />
								Back to Sign In
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default ForgotPasswordPage;
