import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useDeleteAccount = () => {
	return useMutation(api.auth.deleteAccount);
};
