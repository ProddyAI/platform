import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Mail, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";

interface OTPVerificationCardProps {
	email: string;
	onBack?: () => void;
}

export const OTPVerificationCard = ({
	email,
	onBack,
}: OTPVerificationCardProps) => {
	const router = useRouter();
	const { signIn } = useAuthActions();
	const [otp, setOtp] = useState("");
	const [error, setError] = useState("");
	const [errorType, setErrorType] = useState<"expired" | "invalid" | "general">(
		"general"
	);
	const [pending, setPending] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(60);
	const [canResend, setCanResend] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	const verifyOTP = useMutation(api.emailVerification.verifyOTP);

	// Track mobile state with resize listener
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.matchMedia("(max-width: 768px)").matches);
		};

		// Initial check
		checkMobile();

		// Add resize listener
		window.addEventListener("resize", checkMobile);

		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Cooldown timer for resend
	useEffect(() => {
		if (resendCooldown > 0) {
			const timer = setTimeout(() => {
				setResendCooldown(resendCooldown - 1);
			}, 1000);
			return () => clearTimeout(timer);
		} else {
			setCanResend(true);
		}
	}, [resendCooldown]);

	const handleVerify = useCallback(async () => {
		if (otp.length !== 6) {
			setError("Please enter a 6-digit code");
			setErrorType("general");
			return;
		}

		setPending(true);
		setError("");
		setErrorType("general");

		try {
			// First verify the OTP
			await verifyOTP({ email, otp });

			// Retrieve credentials from sessionStorage
			const name = sessionStorage.getItem("signup_name");
			const password = sessionStorage.getItem("signup_password");

			// If name and password provided, create the account
			if (name && password) {
				await signIn("password", { name, email, password, flow: "signUp" });

				// Clear sensitive data from sessionStorage
				sessionStorage.removeItem("signup_name");
				sessionStorage.removeItem("signup_password");

				// Account created and logged in, redirect to the authenticated area
				router.push("/");
			} else {
				// Just email verification (for future use cases)
				router.push("/auth/signin?verified=true");
			}
		} catch (err) {
			// Show user-friendly error messages with appropriate type
			if (err instanceof Error) {
				const errorMessage = err.message.toLowerCase();
				if (errorMessage.includes("expired")) {
					setError("Code has expired. Please request a new one.");
					setErrorType("expired");
				} else if (
					errorMessage.includes("invalid") ||
					errorMessage.includes("incorrect") ||
					errorMessage.includes("otp")
				) {
					setError("Incorrect verification code. Please try again.");
					setErrorType("invalid");
				} else if (errorMessage.includes("too many")) {
					setError("Too many failed attempts. Please request a new code.");
					setErrorType("expired");
				} else {
					setError("Verification failed. Please try again.");
					setErrorType("general");
				}
			} else {
				setError("Verification failed. Please try again.");
				setErrorType("general");
			}
			// Clear the OTP input on error for better UX
			setOtp("");
		} finally {
			setPending(false);
		}
	}, [otp, email, verifyOTP, signIn, router]);

	// Auto-submit when OTP is complete (mobile only)
	useEffect(() => {
		if (otp.length === 6 && !pending && isMobile) {
			handleVerify();
		}
	}, [otp, handleVerify, pending, isMobile]);

	const handleResend = async () => {
		if (!canResend) return;

		setPending(true);
		setError("");
		setOtp("");

		try {
			const response = await fetch("/api/account/otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to resend OTP");
			}

			// Reset cooldown
			setResendCooldown(60);
			setCanResend(false);
		} catch (err) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Failed to resend OTP. Please try again.");
			}
		} finally {
			setPending(false);
		}
	};

	return (
		<Card className="size-full p-8 shadow-xl border-opacity-30 backdrop-blur-sm animate-slide-up rounded-[10px]">
			<CardHeader className="px-0 pt-0 flex flex-col items-center text-center">
				<div className="mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
					<Mail className="w-8 h-8 text-primary" />
				</div>
				<CardTitle className="text-2xl font-semibold">
					Check your email
				</CardTitle>
				<CardDescription className="mt-2">
					Enter the verification code sent to
					<br />
					<span className="font-semibold text-primary">{email}</span>
				</CardDescription>
			</CardHeader>

			{!!error && (
				<div
					className={`mb-6 flex items-center gap-x-2 rounded-md p-3 text-sm border ${
						errorType === "expired"
							? "bg-orange-50 border-orange-200 text-orange-700"
							: "bg-red-50 border-red-200 text-red-600"
					}`}
				>
					<TriangleAlert className="size-4 flex-shrink-0" />
					<p>{error}</p>
				</div>
			)}

			<CardContent className="space-y-6 px-0 pb-0">
				<div className="flex justify-center">
					<InputOTP
						autoFocus
						disabled={pending}
						maxLength={6}
						onChange={(value) => {
							setOtp(value);
							setError("");
							setErrorType("general");
						}}
						pattern={REGEXP_ONLY_DIGITS}
						value={otp}
					>
						<InputOTPGroup className="gap-2">
							<InputOTPSlot
								className="w-12 h-12 text-lg border-2 rounded-xl focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200 hover:border-primary/60 hover:bg-primary/5 cursor-text transition-all duration-200"
								index={0}
							/>
							<InputOTPSlot
								className="w-12 h-12 text-lg border-2 rounded-xl focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200 hover:border-primary/60 hover:bg-primary/5 cursor-text transition-all duration-200"
								index={1}
							/>
							<InputOTPSlot
								className="w-12 h-12 text-lg border-2 rounded-xl focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200 hover:border-primary/60 hover:bg-primary/5 cursor-text transition-all duration-200"
								index={2}
							/>
							<InputOTPSlot
								className="w-12 h-12 text-lg border-2 rounded-xl focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200 hover:border-primary/60 hover:bg-primary/5 cursor-text transition-all duration-200"
								index={3}
							/>
							<InputOTPSlot
								className="w-12 h-12 text-lg border-2 rounded-xl focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200 hover:border-primary/60 hover:bg-primary/5 cursor-text transition-all duration-200"
								index={4}
							/>
							<InputOTPSlot
								className="w-12 h-12 text-lg border-2 rounded-xl focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-200 hover:border-primary/60 hover:bg-primary/5 cursor-text transition-all duration-200"
								index={5}
							/>
						</InputOTPGroup>
					</InputOTP>
				</div>

				<Button
					className="bg-primary w-full transition-all duration-300 hover:shadow-lg hover:bg-primary/90"
					disabled={pending || otp.length !== 6}
					onClick={handleVerify}
					size="lg"
				>
					Verify Code
				</Button>

				<div className="text-center space-y-2">
					<p className="text-sm text-muted-foreground">
						Didn't receive the code?
					</p>
					{canResend ? (
						<button
							className="text-sm font-medium text-secondary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
							disabled={pending}
							onClick={handleResend}
						>
							Resend OTP
						</button>
					) : (
						<p className="text-sm text-muted-foreground">
							Resend available in {resendCooldown}s
						</p>
					)}
				</div>

				{onBack && (
					<button
						className="w-full text-center text-xs text-primary hover:text-primary/80 transition-colors disabled:pointer-events-none disabled:opacity-50"
						disabled={pending}
						onClick={onBack}
					>
						← Back to signup
					</button>
				)}
			</CardContent>
		</Card>
	);
};
