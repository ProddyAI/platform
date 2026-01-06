'use client';

import { useMemo } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Hint } from '@/components/hint';
import { generateUserColor } from '@/lib/placeholder-image';
import { useChannelId } from '@/hooks/use-channel-id';
import { useWorkspaceId } from '@/hooks/use-workspace-id';
import { useChannelPresence } from '@/features/presence/hooks/use-channel-presence';

const MAX_SHOWN_USERS = 4;

export const ChannelPresenceParticipants = () => {
  const workspaceId = useWorkspaceId();
  const channelId = useChannelId();

  const { presenceState } = useChannelPresence({ workspaceId, channelId });

  const onlineUsers = useMemo(
    () => presenceState.filter((p) => p.online),
    [presenceState]
  );

  if (!onlineUsers.length) return null;

  const shown = onlineUsers.slice(0, MAX_SHOWN_USERS);
  const hasMore = onlineUsers.length > MAX_SHOWN_USERS;

  return (
    <div className="flex items-center gap-2">
      {shown.map((p, index) => {
        const name = p.user?.name || 'User';
        const backgroundColor = generateUserColor(p.userId || name);
        const key = `${p.userId || name}-${p.memberId || index}`;
        return (
          <Hint key={key} label={name} side="bottom">
            <Avatar className="h-7 w-7 border-2 border-muted">
              <AvatarImage src={p.user?.image ?? undefined} />
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor }}
              >
                {name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
          </Hint>
        );
      })}

      {hasMore && (
        <Hint label={`${onlineUsers.length - MAX_SHOWN_USERS} more`} side="bottom">
          <Avatar className="h-7 w-7 border-2 border-muted">
            <AvatarFallback className="text-xs font-semibold bg-muted">
              +{onlineUsers.length - MAX_SHOWN_USERS}
            </AvatarFallback>
          </Avatar>
        </Hint>
      )}
    </div>
  );
};
