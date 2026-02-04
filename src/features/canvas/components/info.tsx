"use client";

import { Loader, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Actions } from "../../../components/actions";
import { Hint } from "../../../components/hint";
import { Button } from "../../../components/ui/button";
import { useWorkspaceId } from "../../../hooks/use-workspace-id";
import { cn } from "../../../lib/utils";
import { useGetChannel } from "../../channels/api/use-get-channel";
import { useRenameModal } from "../hooks/use-rename-modal";

const TabSeparator = () => <div className="text-neutral-300 px-1.5">|</div>;

type InfoProps = {
	boardId?: string;
	canvasId?: string;
};

export const Info = ({ boardId, canvasId }: InfoProps) => {
	// Use canvasId if provided, otherwise fall back to boardId for backward compatibility
	const effectiveId = canvasId || boardId;
	const { onOpen } = useRenameModal();
	const workspaceId = useWorkspaceId();
	const [channelName, setChannelName] = useState("Canvas");

	// Get channel data using the effectiveId (which is the channelId)
	const { data: channel, isLoading } = useGetChannel({
		id: effectiveId as Id<"channels">,
	});

	// Update channel name when data is loaded
	useEffect(() => {
		if (channel?.name) {
			// Format the channel name for display (capitalize first letter)
			const formattedName = channel.name
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");

			setChannelName(formattedName);
		}
	}, [channel]);

	// Data for the canvas title
	const data = {
		_id: effectiveId || "",
		title: "Canvas",
		orgId: workspaceId || "",
	};

	return (
		<div className="absolute top-2 left-2 bg-white rounded-md px-1.5 h-12 flex items-center shadow-md">
			<Hint label="Channel Canvas" side="bottom">
				<Button asChild className="px-2" variant="ghost">
					<Link href={`/workspace/${workspaceId}/channel/${effectiveId}/chats`}>
						<Image alt="Channel Logo" height={40} src="/logo.svg" width={40} />
						<span className={cn("font-semibold text-xl ml-2 text-black")}>
							{isLoading ? (
								<>
									<Loader className="mr-2 h-3 w-3 animate-spin" />
									Loading...
								</>
							) : (
								channelName
							)}
						</span>
					</Link>
				</Button>
			</Hint>

			<TabSeparator />

			<Hint label="Edit title" side="bottom">
				<Button
					className="text-base font-normal px-2"
					onClick={() => onOpen(data._id, data.title)}
					variant="ghost"
				>
					{data.title}
				</Button>
			</Hint>

			<TabSeparator />

			<Actions id={data._id} side="bottom" sideOffset={10} title={data.title}>
				<div className="">
					<Hint label="Main menu" side="bottom">
						<Button size="icon" variant="ghost">
							<Menu />
						</Button>
					</Hint>
				</div>
			</Actions>
		</div>
	);
};

export const InfoSkeleton = () => {
	return (
		<div
			aria-hidden
			className="w-[300px] absolute top-2 left-2 bg-white rounded-md px-1.5 h-12 flex items-center shadow-md"
		/>
	);
};
