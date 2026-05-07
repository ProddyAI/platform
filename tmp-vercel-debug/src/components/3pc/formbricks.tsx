"use client";

import formbricks from "@formbricks/js";
import { useEffect } from "react";

export const Formbricks = () => {
	useEffect(() => {
		if (typeof window !== "undefined") {
			const environmentId = process.env.NEXT_PUBLIC_FORMBRICKS_ID;

			if (environmentId) {
				formbricks.setup({
					environmentId,
					appUrl: "https://app.formbricks.com",
				});
			}
		}
	}, []);

	return null;
};
