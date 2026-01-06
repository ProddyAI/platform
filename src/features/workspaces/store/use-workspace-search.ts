"use client";

import { atom, useAtom } from "jotai";

const workspaceSearchAtom = atom(false);

export const useWorkspaceSearch = () => {
	return useAtom(workspaceSearchAtom);
};
