import { atom } from "jotai";
import type { Call, StreamVideoClient } from "@stream-io/video-react-sdk";

export type ActiveMeeting = {
	call: Call;
	channelId: string;
	client: StreamVideoClient;
	workspaceId: string;
};

export const activeMeetingAtom = atom<ActiveMeeting | null>(null);
