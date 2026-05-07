import { create } from "zustand";

import type { Id } from "@/../convex/_generated/dataModel";

interface BoardSearchState {
	isBoardPage: boolean;
	boardSearchQuery: string;
	boardSearchChannelId: Id<"channels"> | null;
	setIsBoardPage: (isBoardPage: boolean) => void;
	setBoardSearchQuery: (query: string) => void;
	setBoardSearchChannelId: (channelId: Id<"channels"> | null) => void;
	clearBoardSearch: () => void;
}

export const useBoardSearchStore = create<BoardSearchState>((set) => ({
	isBoardPage: false,
	boardSearchQuery: "",
	boardSearchChannelId: null,
	setIsBoardPage: (isBoardPage) => set({ isBoardPage }),
	setBoardSearchQuery: (query) => set({ boardSearchQuery: query }),
	setBoardSearchChannelId: (boardSearchChannelId) =>
		set({ boardSearchChannelId }),
	clearBoardSearch: () =>
		set({ boardSearchQuery: "", boardSearchChannelId: null }),
}));
