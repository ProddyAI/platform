"use client";

import { SignUpCard } from "@/features/auth/components/sign-up-card";
import { useDocumentTitle } from "@/hooks/use-document-title";

const SignUpPage = () => {
	// Set document title
	useDocumentTitle("Sign Up");

	return (
		<div className="flex h-full items-center justify-center bg-background">
			<div className="md:h-auto md:w-[420px] animate-fade-in">
				<SignUpCard isStandalone />
			</div>
		</div>
	);
};

export default SignUpPage;
