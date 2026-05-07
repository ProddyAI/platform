"use client";

import BoardPageContent from "@/features/board/components/board-page-content";
import { useChannelId } from "@/hooks/use-channel-id";

const ChannelBoardPage = () => {
	const channelId = useChannelId();

	return <BoardPageContent channelId={channelId} />;
};

export default ChannelBoardPage;
