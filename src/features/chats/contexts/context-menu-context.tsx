"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { Id } from "../../../../convex/_generated/dataModel";

interface ContextMenuState {
	show: boolean;
	x: number;
	y: number;
	messageId?: Id<"messages">;
}

interface ContextMenuContextType {
	contextMenu: ContextMenuState;
	openContextMenu: (x: number, y: number, messageId?: Id<"messages">) => void;
	closeContextMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(
	undefined
);

interface ContextMenuProviderProps {
	children: ReactNode;
}

export const ContextMenuProvider = ({ children }: ContextMenuProviderProps) => {
	const [contextMenu, setContextMenu] = useState<ContextMenuState>({
		show: false,
		x: 0,
		y: 0,
	});

	const closeContextMenu = useCallback(() => {
		setContextMenu({
			show: false,
			x: 0,
			y: 0,
		});
	}, []);

	// Close context menu when clicking outside or pressing escape
	useEffect(() => {
		const handleClickOutside = () => {
			if (contextMenu.show) {
				closeContextMenu();
			}
		};

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && contextMenu.show) {
				closeContextMenu();
			}
		};

		const handleClearContextMenu = () => {
			closeContextMenu();
		};

		if (contextMenu.show) {
			document.addEventListener("click", handleClickOutside);
			document.addEventListener("keydown", handleEscape);
		}

		// Always listen for the clear context menu event
		document.addEventListener("clearContextMenu", handleClearContextMenu);

		return () => {
			document.removeEventListener("click", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
			document.removeEventListener("clearContextMenu", handleClearContextMenu);
		};
	}, [contextMenu.show, closeContextMenu]);

	const openContextMenu = useCallback(
		(x: number, y: number, messageId?: Id<"messages">) => {
			// Close any existing context menu first
			if (contextMenu.show) {
				closeContextMenu();
				// Small delay to ensure the previous menu is closed before opening new one
				setTimeout(() => {
					openNewContextMenu(x, y, messageId);
				}, 10);
			} else {
				openNewContextMenu(x, y, messageId);
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[contextMenu.show, closeContextMenu]
	);

	const openNewContextMenu = useCallback(
		(x: number, y: number, messageId?: Id<"messages">) => {
			// Calculate menu dimensions (approximate)
			const menuWidth = 180;
			const menuHeight = 240;

			// Get viewport dimensions
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Calculate position to keep menu within viewport
			let adjustedX = x;
			let adjustedY = y;

			// Default: position menu below and slightly to the right of cursor
			adjustedY = y + 5;
			adjustedX = x + 5;

			// If menu would go off-screen horizontally, position it to the left of cursor instead
			if (adjustedX + menuWidth > viewportWidth - 10) {
				adjustedX = x - menuWidth - 5; // Position to the left
			}

			// If menu would go off-screen vertically, position it above cursor instead
			if (adjustedY + menuHeight > viewportHeight - 10) {
				adjustedY = y - menuHeight - 5; // Position above
			}

			// Ensure minimum distance from edges
			adjustedX = Math.max(
				10,
				Math.min(adjustedX, viewportWidth - menuWidth - 10)
			);
			adjustedY = Math.max(
				10,
				Math.min(adjustedY, viewportHeight - menuHeight - 10)
			);

			setContextMenu({
				show: true,
				x: adjustedX,
				y: adjustedY,
				messageId,
			});
		},
		[]
	);

	return (
		<ContextMenuContext.Provider
			value={{
				contextMenu,
				openContextMenu,
				closeContextMenu,
			}}
		>
			{children}
		</ContextMenuContext.Provider>
	);
};

export const useContextMenu = () => {
	const context = useContext(ContextMenuContext);
	if (context === undefined) {
		throw new Error("useContextMenu must be used within a ContextMenuProvider");
	}
	return context;
};
