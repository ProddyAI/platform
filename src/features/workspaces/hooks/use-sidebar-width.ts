import { useCallback, useEffect, useRef, useState } from "react";

// Adjustable sidebar width, persisted in localStorage (per browser, not
// per-workspace — the collapse state is Convex-backed, but width is a
// lightweight local preference that doesn't warrant a schema/backend change).
const STORAGE_KEY = "proddy:sidebar-width";

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 280;

const clamp = (value: number) =>
	Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));

export const useSidebarWidth = () => {
	const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
	const [isResizing, setIsResizing] = useState(false);

	// Rehydrate persisted width after mount so the server and first client
	// render agree (avoids a hydration mismatch on the sidebar width).
	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return;
		}
		const parsed = Number.parseInt(raw, 10);
		if (!Number.isNaN(parsed)) {
			setWidth(clamp(parsed));
		}
	}, []);

	const persist = useCallback((next: number) => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STORAGE_KEY, String(next));
		}
	}, []);

	// Begin a drag from the right edge. Width tracks the pointer's x-position
	// because the sidebar's left edge sits at viewport x=0.
	const startResizing = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			setIsResizing(true);

			const onMouseMove = (moveEvent: MouseEvent) => {
				setWidth(clamp(moveEvent.clientX));
			};

			const onMouseUp = () => {
				setIsResizing(false);
				setWidth((current) => {
					persist(current);
					return current;
				});
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
				document.body.style.removeProperty("cursor");
				document.body.style.removeProperty("user-select");
			};

			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);
			// Keep the resize cursor and suppress text selection for the whole
			// drag, even when the pointer leaves the thin handle.
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
		},
		[persist]
	);

	// Double-click the handle to snap back to the default width.
	const resetWidth = useCallback(() => {
		setWidth(SIDEBAR_DEFAULT_WIDTH);
		persist(SIDEBAR_DEFAULT_WIDTH);
	}, [persist]);

	const cleanupRef = useRef(() => {
		if (typeof document !== "undefined") {
			document.body.style.removeProperty("cursor");
			document.body.style.removeProperty("user-select");
		}
	});

	// Guard against unmounting mid-drag leaving the body styles stuck.
	useEffect(() => {
		const cleanup = cleanupRef.current;
		return () => cleanup();
	}, []);

	return { width, isResizing, startResizing, resetWidth };
};
