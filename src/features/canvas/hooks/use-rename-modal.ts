import { create } from "zustand";

type RenameModalStore = {
	isOpen: boolean;
	id?: string;
	title?: string;
	onOpen: (id: string, title: string) => void;
	onClose: () => void;
};

export const useRenameModal = create<RenameModalStore>((set) => ({
	isOpen: false,
	id: undefined,
	title: undefined,
	onOpen: (id, title) => set({ isOpen: true, id, title }),
	onClose: () => set({ isOpen: false, id: undefined, title: undefined }),
}));
