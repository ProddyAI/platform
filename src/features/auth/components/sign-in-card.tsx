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

interface SignInCardProps {
	setState?: (state: SignInFlow) => void;
	isStandalone?: boolean;
}

export const SignInCard = ({
	setState,
	isStandalone = false,
}: SignInCardProps) => {
	const { signIn } = useAuthActions();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	const handleOAuthSignIn = (value: "github" | "google") => {
		setPending(true);
		signIn(value).finally(() => setPending(false));
	};

	const handleSignIn = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setPending(true);
		setError("");

		signIn("password", { email, password, flow: "signIn" })
			.catch(() => {
				setError("Invalid email or password!");
			})
			.finally(() => setPending(false));
	};

	return (
		<Card className="size-full p-8 shadow-xl border-opacity-30 backdrop-blur-sm animate-slide-up rounded-[10px]">
			<CardHeader className="px-0 pt-0">
				<CardTitle>Login to continue</CardTitle>
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
				<form className="space-y-2.5" onSubmit={handleSignIn}>
					<Input
						disabled={pending}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						required
						type="email"
						value={email}
					/>

					<Input
						disabled={pending}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						required
						type="password"
						value={password}
					/>

					<div className="flex justify-end">
						<Link
							className="text-xs text-muted-foreground hover:text-secondary transition-colors"
							href="/auth/forgot-password"
						>
							Forgot Password?
						</Link>
					</div>

					<Button
						className="bg-primary w-full transition-standard hover:shadow-lg hover:bg-primary/90"
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
						className="relative w-full transition-standard hover:shadow-md group rounded-[10px]"
						disabled={pending}
						onClick={() => handleOAuthSignIn("google")}
						size="lg"
						variant="outline"
					>
						<FcGoogle className="absolute left-2.5 top-3 size-5 transition-transform duration-200 group-hover:scale-110" />
						Continue with Google
					</Button>

					<Button
						className="relative w-full transition-standard hover:shadow-md group rounded-[10px]"
						disabled={pending}
						onClick={() => handleOAuthSignIn("github")}
						size="lg"
						variant="outline"
					>
						<FaGithub className="absolute left-2.5 top-3 size-5 transition-transform duration-200 group-hover:scale-110" />
						Continue with GitHub
					</Button>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Don&apos;t have an account?{" "}
					{isStandalone ? (
						<Link
							className="cursor-pointer font-medium text-secondary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
							href="/auth/signup"
						>
							Sign up
						</Link>
					) : (
						<button
							className="cursor-pointer font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
							disabled={pending}
							onClick={() => setState?.("signUp")}
						>
							Sign up
						</button>
					)}
				</p>
			</CardContent>
		</Card>
	);
};
