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

			{!!error && (
				<div className="mb-6 flex items-center gap-x-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					<TriangleAlert className="size-4" />
					<p>{error}</p>
				</div>
			)}

			<CardContent className="space-y-5 px-0 pb-0">
				<form onSubmit={handleSignIn} className="space-y-2.5">
					<Input
						disabled={pending}
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						type="email"
						required
					/>

					<Input
						disabled={pending}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						type="password"
						required
					/>

					<Button
						type="submit"
						className="bg-primary w-full transition-standard hover:shadow-lg hover:bg-primary/90"
						size="lg"
						disabled={pending}
					>
						Continue
					</Button>
				</form>

				<Separator />

				<div className="flex flex-col gap-y-2.5">
					<Button
						disabled={pending}
						onClick={() => handleOAuthSignIn("google")}
						variant="outline"
						size="lg"
						className="relative w-full transition-standard hover:shadow-md group rounded-[10px]"
					>
						<FcGoogle className="absolute left-2.5 top-3 size-5 transition-transform duration-200 group-hover:scale-110" />
						Continue with Google
					</Button>

					<Button
						disabled={pending}
						onClick={() => handleOAuthSignIn("github")}
						variant="outline"
						size="lg"
						className="relative w-full transition-standard hover:shadow-md group rounded-[10px]"
					>
						<FaGithub className="absolute left-2.5 top-3 size-5 transition-transform duration-200 group-hover:scale-110" />
						Continue with GitHub
					</Button>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					Don&apos;t have an account?{" "}
					{isStandalone ? (
						<Link
							href="/signup"
							className="cursor-pointer font-medium text-secondary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
						>
							Sign up
						</Link>
					) : (
						<button
							disabled={pending}
							onClick={() => setState?.("signUp")}
							className="cursor-pointer font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50 transition-all duration-200 hover:text-secondary/80"
						>
							Sign up
						</button>
					)}
				</p>
			</CardContent>
		</Card>
	);
};
