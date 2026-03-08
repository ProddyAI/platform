import { create } from "zustand";

interface BoardSearchState {
	isBoardPage: boolean;
	boardSearchQuery: string;
	setIsBoardPage: (isBoardPage: boolean) => void;
	setBoardSearchQuery: (query: string) => void;
	clearBoardSearch: () => void;
}

export const useBoardSearchStore = create<BoardSearchState>((set) => ({
	isBoardPage: false,
	boardSearchQuery: "",
	setIsBoardPage: (isBoardPage) => set({ isBoardPage }),
	setBoardSearchQuery: (query) => set({ boardSearchQuery: query }),
	clearBoardSearch: () => set({ boardSearchQuery: "" }),
}));
