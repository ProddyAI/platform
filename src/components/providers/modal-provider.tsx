"use client";

import { useEffect, useState } from "react";

import { CreateChannelModal } from "@/features/channels/components/create-channel-modal";
import { InviteMemberModal } from "@/features/members/components/invite-member-modal";
import { ConnectProjectChannelModal } from "@/features/projects/components/connect-project-channel-modal";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import { CreateWorkspaceModal } from "@/features/workspaces/components/create-workspace-modal";

export const ModalProvider = () => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) return null;

	return (
		<>
			<CreateChannelModal />
			<CreateProjectModal />
			<ConnectProjectChannelModal />
			<InviteMemberModal />
			<CreateWorkspaceModal />
		</>
	);
};
