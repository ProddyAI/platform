"use client";

import { usePathname } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import type { Id } from "../../../../convex/_generated/dataModel";

interface MessageSelectionContextType {
	selectedMessages: Id<"messages">[];
	toggleMessageSelection: (id: Id<"messages">) => void;
	clearSelectedMessages: () => void;
	isMessageSelected: (id: Id<"messages">) => boolean;
}

const MessageSelectionContext = createContext<
	MessageSelectionContextType | undefined
>(undefined);

export const MessageSelectionProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const [selectedMessages, setSelectedMessages] = useState<Id<"messages">[]>(
		[]
	);
	const _pathname = usePathname();

	// Clear selected messages when navigating away from chat pages
	useEffect(() => {
		// Clear selections when path changes (navigating to different pages)
		setSelectedMessages([]);
	}, []);

	const toggleMessageSelection = (id: Id<"messages">) => {
		setSelectedMessages((prev) => {
			if (prev.includes(id)) {
				return prev.filter((messageId) => messageId !== id);
			} else {
				return [...prev, id];
			}
		});
	};

	const clearSelectedMessages = () => {
		setSelectedMessages([]);
		// Also close any open context menus when clearing selections
		if (typeof window !== "undefined") {
			document.dispatchEvent(new CustomEvent("clearContextMenu"));
		}
	};

	const isMessageSelected = (id: Id<"messages">) => {
		return selectedMessages.includes(id);
	};

	return (
		<MessageSelectionContext.Provider
			value={{
				selectedMessages,
				toggleMessageSelection,
				clearSelectedMessages,
				isMessageSelected,
			}}
		>
			{children}
		</MessageSelectionContext.Provider>
	);
};

export const useMessageSelection = () => {
	const context = useContext(MessageSelectionContext);
	if (context === undefined) {
		throw new Error(
			"useMessageSelection must be used within a MessageSelectionProvider"
		);
	}
	return context;
};
