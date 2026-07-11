"use client";

import { CheckCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignInCard } from "@/features/auth/components/sign-in-card";
import { useDocumentTitle } from "@/hooks/use-document-title";

const SignInPage = () => {
	// Set document title
	useDocumentTitle("Sign In");

	const searchParams = useSearchParams();
	const [showVerifiedAlert, setShowVerifiedAlert] = useState(false);

	useEffect(() => {
		if (searchParams.get("verified") === "true") {
			setShowVerifiedAlert(true);
			// Auto-hide after 5 seconds
			const timer = setTimeout(() => {
				setShowVerifiedAlert(false);
			}, 5000);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [searchParams]);

	return (
		<div className="flex h-full items-center justify-center bg-background">
			<div className="md:h-auto md:w-[420px] animate-fade-in space-y-4">
				{showVerifiedAlert && (
					<Alert className="bg-success/10 border-success/20 animate-slide-down">
						<CheckCircle className="size-4 text-success" />
						<AlertDescription className="text-success">
							Email verified successfully! You can now sign in with your
							credentials.
						</AlertDescription>
					</Alert>
				)}
				<SignInCard isStandalone />
			</div>
		</div>
	);
};

export default SignInPage;
