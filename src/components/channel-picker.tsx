'use client';

import { Hash, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Id } from '@/../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetChannels } from '@/features/channels/api/use-get-channels';
import { useWorkspaceId } from '@/hooks/use-workspace-id';

interface ChannelPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (channelId: Id<'channels'>, channelName: string) => void;
  searchQuery: string;
}

type ChannelListItem = {
  _id: Id<'channels'>;
  name: string;
};

export const ChannelPicker = ({ open, onClose, onSelect, searchQuery }: ChannelPickerProps) => {
  const workspaceId = useWorkspaceId();
  const { data: channels, isLoading } = useGetChannels({ workspaceId });

  const [filteredChannels, setFilteredChannels] = useState<ChannelListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearchTerm(searchQuery || '');
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
      name: channel.name || '',
    }));

    const filtered = searchTerm.trim() === ''
      ? mapped
      : mapped.filter((channel) => channel.name.toLowerCase().includes(searchTerm.toLowerCase()));

    setFilteredChannels(filtered);
  }, [channels, searchTerm]);

  const handleSelect = (channelId: Id<'channels'>, channelName: string) => {
    onSelect(channelId, channelName);
    onClose();
  };

  if (!open) return null;

  const handlePickerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed bottom-[120px] left-0 right-0 mx-auto w-[90%] max-w-[500px] bg-white border border-gray-200 rounded-md shadow-lg z-[9999] overflow-hidden"
      onClick={handlePickerClick}
    >
      <div className="border-b p-2 bg-gray-50">
        <div className="flex items-center">
          <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
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
          <div className="space-y-1">
            {filteredChannels.map((channel) => (
              <Button
                key={channel._id}
                variant="ghost"
                className="w-full justify-start px-2 py-1.5 h-auto hover:bg-gray-100"
                onClick={() => handleSelect(channel._id, channel.name)}
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

      <div className="border-t p-2 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search channels..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};
