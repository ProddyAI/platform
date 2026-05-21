import type { KeyboardEvent } from "react";

export function handleKeyboardActivation(
	handler: () => void
): (event: KeyboardEvent<HTMLElement>) => void {
	return (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handler();
		}
	};
}
