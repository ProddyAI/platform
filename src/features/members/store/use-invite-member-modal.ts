"use client";

import { atom, useAtom } from "jotai";

const inviteMemberModalAtom = atom(false);

export const useInviteMemberModal = () => {
	return useAtom(inviteMemberModalAtom);
};
