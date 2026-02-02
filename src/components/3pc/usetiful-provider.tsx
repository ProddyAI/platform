"use client";

import { useEffect } from "react";
import { loadUsetifulScript, setUsetifulTags } from "usetiful-sdk";
import { useCurrentUser } from "@/features/auth/api/use-current-user";

interface UsetifulProviderProps {
	children: React.ReactNode;
}

export const UsetifulProvider = ({ children }: UsetifulProviderProps) => {
	const { data: currentUser, isLoading } = useCurrentUser();

	useEffect(() => {
		// Get token from environment variable
		const token = process.env.NEXT_PUBLIC_USETIFUL_TOKEN;

		// Only load Usetiful if token is provided
		if (!token) {
			console.warn(
				"Usetiful token not provided. Skipping Usetiful initialization."
			);
			return;
		}

		// Load the Usetiful script
		loadUsetifulScript(token);

		// Set user identification if user is authenticated and data is available
		if (currentUser && !isLoading) {
			const userTags: Record<string, string> = {};

			// Use the user ID from Convex
			if (currentUser._id) {
				userTags.userId = currentUser._id;
			}

			// Extract first and last name from the name field
			if (currentUser.name) {
				const nameParts = currentUser.name.trim().split(" ");
				if (nameParts.length > 0) {
					userTags.firstName = nameParts[0];
				}
				if (nameParts.length > 1) {
					userTags.lastName = nameParts.slice(1).join(" ");
				}
			}

			// Add email if available
			if (currentUser.email) {
				userTags.email = currentUser.email;
			}

			// Only set tags if we have at least one piece of user data
			if (Object.keys(userTags).length > 0) {
				setUsetifulTags(userTags);
			}
		}
	}, [currentUser, isLoading]);

	return <>{children}</>;
};
