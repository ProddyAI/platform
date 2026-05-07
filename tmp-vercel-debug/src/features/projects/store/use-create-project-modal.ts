"use client";

import { atom, useAtom } from "jotai";

const createProjectModalAtom = atom(false);

export const useCreateProjectModal = () => {
	return useAtom(createProjectModalAtom);
};
