import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/../convex/_generated/api";

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
