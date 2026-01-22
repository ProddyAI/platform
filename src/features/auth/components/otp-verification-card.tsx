import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Mail, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { OTPInputCustom } from "@/components/ui/otp-input-custom";

interface OTPVerificationCardProps {
	email: string;
	name?: string;
	password?: string;
	onBack?: () => void;
}

export const OTPVerificationCard = ({
	email,
	name,
	password,
	onBack,
}: OTPVerificationCardProps) => {
	const router = useRouter();
	const { signIn } = useAuthActions();
	const [otp, setOtp] = useState("");
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const [resendCooldown, setResendCooldown] = useState(60);
	const [canResend, setCanResend] = useState(false);

	const verifyOTP = useMutation(api.emailVerification.verifyOTP);

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

	const handleVerify = async () => {
		if (otp.length !== 6) {
			setError("Please enter a 6-digit code");
			return;
		}

		setPending(true);
		setError("");

		try {
			// First verify the OTP
			await verifyOTP({ email, otp });

			// If name and password provided, create the account
			if (name && password) {
				await signIn("password", { name, email, password, flow: "signUp" });
				// Account created and logged in, redirect with success
				router.push("/signin?verified=true");
			} else {
				// Just email verification (for future use cases)
				router.push("/signin?verified=true");
			}
		} catch (err) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Failed to verify OTP. Please try again.");
			}
		} finally {
			setPending(false);
		}
	};

	const handleResend = async () => {
		if (!canResend) return;

		setPending(true);
		setError("");
		setOtp("");

		try {
			const response = await fetch("/api/otp/send", {
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
				<CardTitle className="text-2xl font-semibold">Check your email</CardTitle>
				<CardDescription className="mt-2">
					Enter the verification code sent to
					<br />
					<span className="font-semibold text-primary">{email}</span>
				</CardDescription>
			</CardHeader>

			{!!error && (
				<div className="mb-6 flex items-center gap-x-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					<TriangleAlert className="size-4" />
					<p>{error}</p>
				</div>
			)}

			<CardContent className="space-y-6 px-0 pb-0">
				<div className="flex justify-center">
					<OTPInputCustom
						length={6}
						value={otp}
						onChange={(value) => {
							setOtp(value);
							setError("");
						}}
						disabled={pending}
					/>
				</div>

				<Button
					onClick={handleVerify}
					className="bg-primary w-full transition-all duration-300 hover:shadow-lg hover:bg-primary/90"
					size="lg"
					disabled={pending || otp.length !== 6}
				>
					Verify Code
				</Button>

				<div className="text-center space-y-2">
					<p className="text-sm text-muted-foreground">
						Didn't receive the code?
					</p>
					{canResend ? (
						<button
							onClick={handleResend}
							disabled={pending}
							className="text-sm font-medium text-secondary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
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
						onClick={onBack}
						disabled={pending}
						className="w-full text-center text-xs text-primary hover:text-primary/80 transition-colors disabled:pointer-events-none disabled:opacity-50"
					>
						← Back to signup
					</button>
				)}
			</CardContent>
		</Card>
	);
};
