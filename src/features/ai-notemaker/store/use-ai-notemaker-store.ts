import { create } from 'zustand';

interface AiNotemakerStore {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  triggerGeneration: number;
  generateNotes: () => void;
}

export const useAiNotemakerStore = create<AiNotemakerStore>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  isExpanded: false,
  setIsExpanded: (isExpanded) => set({ isExpanded }),
  triggerGeneration: 0,
  generateNotes: () => set((state) => ({ triggerGeneration: state.triggerGeneration + 1 })),
}));
