"use client";

import { atom, useAtom } from "jotai";

import type { Id } from "@/../convex/_generated/dataModel";

type ConnectProjectChannelModalState = {
	open: boolean;
	projectId: Id<"projects"> | null;
};

const connectProjectChannelModalAtom = atom<ConnectProjectChannelModalState>({
	open: false,
	projectId: null,
});

export const useConnectProjectChannelModal = () => {
	return useAtom(connectProjectChannelModalAtom);
};
