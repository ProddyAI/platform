import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useCallback } from "react";

export const useChangePassword = () => {
	const changePassword = useMutation(api.passwordManagement.changePassword);

	const handleChangePassword = useCallback(
		async (currentPassword: string, newPassword: string) => {
			return await changePassword({ currentPassword, newPassword });
		},
		[changePassword]
	);

	return { changePassword: handleChangePassword };
};
