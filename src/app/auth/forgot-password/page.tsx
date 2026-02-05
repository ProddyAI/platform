"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

const COOLDOWN_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

const ForgotPasswordPage = () => {
	useDocumentTitle("Forgot Password");

	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [emailSent, setEmailSent] = useState(false);
	const [lastSentTimestamp, setLastSentTimestamp] = useState<number | null>(
		null
	);
	const [remainingCooldown, setRemainingCooldown] = useState(0);

	// Handle cooldown timer
	useEffect(() => {
		if (!lastSentTimestamp) return;

		const updateCooldown = () => {
			const now = Date.now();
			const elapsed = now - lastSentTimestamp;
			const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);

			setRemainingCooldown(remaining);

			if (remaining === 0) {
				setLastSentTimestamp(null);
			}
		};

		updateCooldown();
		const interval = setInterval(updateCooldown, 1000);

		return () => clearInterval(interval);
	}, [lastSentTimestamp]);

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
			// Call the API route directly - token generation happens server-side
			// This prevents token exposure to the client and eliminates spoofing risk
			const response = await fetch("/api/account/reset", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: email.toLowerCase().trim(),
				}),
			});

		const result = await response.json();

		if (response.ok && result.success) {
			// Always show success message regardless of whether email was sent
			// This prevents attackers from knowing if an email exists in the system
			const now = Date.now();
			setEmailSent(true);
			setLastSentTimestamp(now);
			// Initialize cooldown immediately to prevent fast "Try again" bypass
			setRemainingCooldown(COOLDOWN_DURATION);
			toast.success(
				"If an account exists with this email, a password reset link will be sent"
			);
		} else if (response.status === 404 && result.reason === "user_not_found") {
			// User doesn't exist - redirect to signup
			toast.error("No account found with this email address", {
				duration: 4000,
			});
			setTimeout(() => {
				window.location.href = "/auth/signup";
			}, 2000);
		} else if (response.status === 400 && result.reason === "oauth_only") {
			// User has OAuth only
			toast.error(
				result.error ||
					"This account uses social login. Please sign in with Google or GitHub.",
				{
					duration: 5000,
				}
			);
		} else if (response.status === 429) {
			// Handle rate limiting with detailed message
			const errorMessage =
				result.error || "Too many requests. Please try again later.";
			toast.error(errorMessage, {
				duration: 5000,
			});
			console.error("Rate limit error:", errorMessage);
		} else {
			throw new Error(result.error || "Failed to send reset email");
		}
		} catch (error) {
			console.error("Password reset request error:", error);
			toast.error("An error occurred. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleTryAgain = () => {
		if (remainingCooldown > 0) {
			const seconds = Math.ceil(remainingCooldown / 1000);
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = seconds % 60;
			toast.error(
				`Please wait ${minutes}:${remainingSeconds.toString().padStart(2, "0")} before trying again`
			);
			return;
		}
		setEmailSent(false);
	};

	const formatCooldownTime = () => {
		const seconds = Math.ceil(remainingCooldown / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
							<form className="space-y-4" onSubmit={handleSubmit}>
								<div className="space-y-2">
									<Label htmlFor="email">Email Address</Label>
									<Input
										disabled={isSubmitting}
										id="email"
										onChange={(e) => setEmail(e.target.value)}
										placeholder="Enter your email"
										required
										type="email"
										value={email}
									/>
								</div>

								<Button
									className="bg-primary w-full transition-standard hover:shadow-lg hover:bg-primary/90"
									disabled={isSubmitting}
									size="lg"
									type="submit"
								>
									{isSubmitting ? "Sending..." : "Send Reset Link"}
								</Button>
							</form>
						) : (
							<div className="space-y-4">
								<div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
									<p className="font-medium mb-1">Email Sent Successfully!</p>
									<p>
										We've sent a password reset link to <strong>{email}</strong>
										. Please check your inbox and follow the instructions.
									</p>
								</div>

								<p className="text-sm text-muted-foreground text-center">
									Didn't receive the email? Check your spam folder or{" "}
									<button
										className={`font-medium transition-colors ${remainingCooldown > 0
											? "text-muted-foreground cursor-not-allowed"
											: "text-secondary hover:underline"
											}`}
										disabled={remainingCooldown > 0}
										onClick={handleTryAgain}
										type="button"
									>
										{remainingCooldown > 0
											? `Try again (${formatCooldownTime()})`
											: "Try again"}
									</button>
								</p>
							</div>
						)}

						<div className="pt-4">
							<Link
								className="flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors justify-center"
								href="/auth/signin"
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
