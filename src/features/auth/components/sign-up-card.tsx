import { useAuthActions } from "@convex-dev/auth/react";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import type { SignInFlow } from "../types";
import { isPasswordValid } from "../utils/password-validation";
import { OTPVerificationCard } from "./otp-verification-card";
import { PasswordStrengthIndicator } from "./password-strength-indicator";

interface SignUpCardProps {
	setState?: (state: SignInFlow) => void;
	isStandalone?: boolean;
}

export const SignUpCard = ({
	setState,
	isStandalone = false,
}: SignUpCardProps) => {
	const { signIn } = useAuthActions();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const [showOTPVerification, setShowOTPVerification] = useState(false);
	const [pendingEmail, setPendingEmail] = useState("");

	const handleOAuthSignUp = (value: "github" | "google") => {
		setPending(true);
		signIn(value).finally(() => setPending(false));
	};

	const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const validateEmail = (email: string) => {
			return String(email)
				.toLowerCase()
				.match(
					/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
				);
		};

		if (!validateEmail(email)) return setError("Invalid email address.");
		if (!isPasswordValid(password))
			return setError("Password does not meet all requirements.");
		if (password !== confirmPassword) return setError("Passwords don't match.");

		setPending(true);
		setError("");

		try {
			// Send OTP to email
			const response = await fetch("/api/account/otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to send OTP");
			}

			// Store credentials securely in sessionStorage (not in component state)
			// This prevents exposure in React DevTools
			sessionStorage.setItem("signup_name", name);
			sessionStorage.setItem("signup_password", password);
			setPendingEmail(email);

			// Show OTP verification screen
			setShowOTPVerification(true);
		} catch (err) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Something went wrong!");
			}
		} finally {
			setPending(false);
		}
	};

	// Show OTP verification screen if needed
	if (showOTPVerification) {
		return (
			<OTPVerificationCard
				email={pendingEmail}
				onBack={() => {
					// Clear sessionStorage when going back
					sessionStorage.removeItem("signup_name");
					sessionStorage.removeItem("signup_password");
					setShowOTPVerification(false);
				}}
			/>
		);
	}

	return (
		<Card className="size-full p-8 shadow-xl border-opacity-30 backdrop-blur-sm animate-slide-up rounded-[10px]">
			<CardHeader className="px-0 pt-0">
				<CardTitle>Sign up to continue</CardTitle>
				<CardDescription>
					Use your email or another service to continue.
				</CardDescription>
			</CardHeader>

			{Boolean(error) && (
				<div className="mb-6 flex items-center gap-x-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					<TriangleAlert className="size-4" />
					<p>{error}</p>
				</div>
			)}

			<CardContent className="space-y-5 px-0 pb-0">
				<form className="space-y-2.5" onSubmit={handleSignUp}>
					<Input
						disabled={pending}
						maxLength={50}
						minLength={3}
						onChange={(e) => setName(e.target.value)}
						placeholder="Full Name"
						required
						value={name}
					/>

					<Input
						disabled={pending}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						required
						type="email"
						value={email}
					/>
					<div className="space-y-2">
						<Input
							disabled={pending}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Password"
							required
							type="password"
							value={password}
						/>
						<PasswordStrengthIndicator password={password} />
					</div>

					<Input
						disabled={pending}
						onChange={(e) => setConfirmPassword(e.target.value)}
						placeholder="Confirm Password"
						required
						type="password"
						value={confirmPassword}
					/>

					<Button
						className="bg-primary w-full transition-all duration-300 hover:shadow-lg hover:bg-primary/90"
						disabled={pending}
						size="lg"
						type="submit"
					>
						Continue
					</Button>
				</form>

				<Separator />

				<div className="flex flex-col gap-y-2.5">
					<Button
						className="relative w-full transition-all duration-300 hover:shadow-md group"
						disabled={pending}
						onClick={() => handleOAuthSignUp("google")}
						size="lg"
						variant="outline"
					>
						<FcGoogle className="absolute left-2.5 top-3 size-5 transition-transform duration-200 group-hover:scale-110" />
						Continue with Google
					</Button>

					<Button
						className="relative w-full transition-all duration-300 hover:shadow-md group"
						disabled={pending}
						onClick={() => {
							handleOAuthSignUp("github");
						}}
						size="lg"
						variant="outline"
					>
						<FaGithub className="absolute left-2.5 top-3 size-5 transition-transform duration-200 group-hover:scale-110" />
						Continue with GitHub
					</Button>
				</div>

				<p className="text-center text-xs text-primary">
					Already have an account?{" "}
					{isStandalone ? (
						<Link
							className="text-secondary cursor-pointer font-medium hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
							href="/auth/signin"
						>
							Sign in
						</Link>
					) : (
						<button
							className="cursor-pointer font-medium text-secondary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
							disabled={pending}
							onClick={() => setState?.("signIn")}
						>
							Sign in
						</button>
					)}
				</p>
			</CardContent>
		</Card>
	);
};
