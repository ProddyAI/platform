"use client";

import { SignInCard } from "@/features/auth/components/sign-in-card";
import { useDocumentTitle } from "@/hooks/use-document-title";

const SignInPage = () => {
	// Set document title
	useDocumentTitle("Sign In");

	return (
		<div className="flex h-full items-center justify-center bg-primary">
			<div className="md:h-auto md:w-[420px] animate-fade-in">
				<SignInCard isStandalone={true} />
			</div>
		</div>
	);
};

export default SignInPage;
