import { useEffect } from "react";

export const useDisableScrollBounce = () => {
	useEffect(() => {
		const originalOverflow = document.body.style.overflow;
		const originalHeight = document.body.style.height;
		const originalTouchAction = document.documentElement.style.touchAction;

		document.body.style.overflow = "hidden";
		document.body.style.height = "100%";
		document.documentElement.style.touchAction = "none";

		return () => {
			document.body.style.overflow = originalOverflow;
			document.body.style.height = originalHeight;
			document.documentElement.style.touchAction = originalTouchAction;
		};
	}, []);
};
