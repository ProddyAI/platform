import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useCallback } from "react";

export const useRequestPasswordReset = () => {
	const requestReset = useMutation(api.passwordManagement.requestPasswordReset);

	const handleRequestReset = useCallback(
		async (email: string) => {
			return await requestReset({ email });
		},
		[requestReset]
	);

	return { requestPasswordReset: handleRequestReset };
};

export const useVerifyResetToken = (token: string | null) => {
	const result = useQuery(
		api.passwordManagement.verifyResetToken,
		token ? { token } : "skip"
	);

	return result;
};

export const useResetPassword = () => {
	const resetPassword = useMutation(api.passwordManagement.resetPassword);

	const handleResetPassword = useCallback(
		async (token: string, newPassword: string) => {
			return await resetPassword({ token, newPassword });
		},
		[resetPassword]
	);

	return { resetPassword: handleResetPassword };
};
