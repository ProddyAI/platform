"use client";

import { Hash, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

interface ChannelPickerProps {
	open: boolean;
	onClose: () => void;
	onSelect: (channelId: Id<"channels">, channelName: string) => void;
	searchQuery: string;
}

type ChannelListItem = {
	_id: Id<"channels">;
	name: string;
};

export const ChannelPicker = ({
	open,
	onClose,
	onSelect,
	searchQuery,
}: ChannelPickerProps) => {
	const workspaceId = useWorkspaceId();
	const { data: channels, isLoading } = useGetChannels({ workspaceId });

	const [filteredChannels, setFilteredChannels] = useState<ChannelListItem[]>(
		[]
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setSearchTerm(searchQuery || "");
			setHighlightedIndex(0);
		}
	}, [open, searchQuery]);

	useEffect(() => {
		if (open && searchInputRef.current) {
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 100);
		}
	}, [open]);

	useEffect(() => {
		if (!channels) return;

		const mapped = channels.map((channel) => ({
			_id: channel._id,
			name: channel.name || "",
		}));

		const filtered =
			searchTerm.trim() === ""
				? mapped
				: mapped.filter((channel) =>
						channel.name.toLowerCase().includes(searchTerm.toLowerCase())
					);

		setFilteredChannels(filtered);
	}, [channels, searchTerm]);

	const handleSelect = (channelId: Id<"channels">, channelName: string) => {
		onSelect(channelId, channelName);
		onClose();
	};

	if (!open) return null;

	const handlePickerClick = (e: React.MouseEvent) => {
		e.stopPropagation();
	};

	const handlePickerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				filteredChannels.length === 0 ? 0 : (prev + 1) % filteredChannels.length
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightedIndex((prev) =>
				filteredChannels.length === 0
					? 0
					: (prev - 1 + filteredChannels.length) % filteredChannels.length
			);
			return;
		}

		if (event.key === "Enter") {
			const channel = filteredChannels[highlightedIndex];
			if (channel) {
				event.preventDefault();
				handleSelect(channel._id, channel.name);
			}
			return;
		}

		event.stopPropagation();
	};

	const activeChannel = filteredChannels[highlightedIndex];

	return (
		<div
			className="fixed bottom-[120px] left-0 right-0 mx-auto w-[90%] max-w-[500px] bg-popover border border-border rounded-xl shadow-lg z-[9999] overflow-hidden"
			onClick={handlePickerClick}
			onKeyDown={handlePickerKeyDown}
		>
			<div className="border-b p-2 bg-muted">
				<div className="flex items-center">
					<Hash className="mr-2 size-4 text-muted-foreground" />
					<span className="text-sm font-medium">Mention a channel</span>
				</div>
			</div>

			<div className="max-h-[200px] overflow-y-auto p-2">
				{isLoading ? (
					<div className="flex items-center justify-center p-4">
						<p className="text-sm text-muted-foreground">Loading channels...</p>
					</div>
				) : filteredChannels.length === 0 ? (
					<div className="flex items-center justify-center p-4">
						<p className="text-sm text-muted-foreground">No channels found</p>
					</div>
				) : (
					<div
						aria-label="Channels"
						className="space-y-1"
						id="channel-picker-listbox"
						role="listbox"
					>
						{filteredChannels.map((channel, index) => (
							<Button
								aria-selected={index === highlightedIndex}
								className={cn(
									"w-full justify-start px-2 py-1.5 h-auto hover:bg-accent hover:text-accent-foreground",
									index === highlightedIndex &&
										"bg-accent text-accent-foreground"
								)}
								id={`channel-option-${channel._id}`}
								key={channel._id}
								onClick={() => handleSelect(channel._id, channel.name)}
								onMouseEnter={() => setHighlightedIndex(index)}
								role="option"
								variant="ghost"
							>
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">#</span>
									<span className="text-sm">{channel.name}</span>
								</div>
							</Button>
						))}
					</div>
				)}
			</div>

			<div className="border-t p-2 bg-muted">
				<div className="relative">
					<Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
					<Input
						aria-activedescendant={
							activeChannel ? `channel-option-${activeChannel._id}` : undefined
						}
						aria-autocomplete="list"
						aria-controls="channel-picker-listbox"
						aria-expanded={open}
						aria-label="Search channels"
						className="pl-8"
						onChange={(e) => {
							setSearchTerm(e.target.value);
							setHighlightedIndex(0);
						}}
						placeholder="Search channels..."
						ref={searchInputRef}
						role="combobox"
						value={searchTerm}
					/>
				</div>
			</div>
		</div>
	);
};
