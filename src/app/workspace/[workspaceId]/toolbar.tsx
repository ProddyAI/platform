'use client';

import React from 'react';
import { Activity, Bell, HeartPulse, HelpCircle, Map, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';

import type { Id } from '@/../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/hint';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { MentionsNotificationDialog } from '@/components/mentions-notification-dialog';
import { UserButton } from '@/features/auth/components/user-button';
import { useGetChannels } from '@/features/channels/api/use-get-channels';
import { useGetMembers } from '@/features/members/api/use-get-members';
import { useGetWorkspace } from '@/features/workspaces/api/use-get-workspace';
import { useWorkspaceSearch } from '@/features/workspaces/store/use-workspace-search';
import { useGetUnreadMentionsCount } from '@/features/messages/api/use-get-unread-mentions-count';
import { showTidioChat } from '@/lib/tidio-helpers';

import { useWorkspaceId } from '@/hooks/use-workspace-id';

interface WorkspaceToolbarProps {
    children: ReactNode;
}

export const WorkspaceToolbar = ({
    children
}: WorkspaceToolbarProps) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const workspaceId = useWorkspaceId();
    const [searchOpen, setSearchOpen] = useWorkspaceSearch();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [forceOpenUserSettings, setForceOpenUserSettings] = useState(false);
    const [userSettingsTab, setUserSettingsTab] = useState<'profile' | 'notifications'>('profile');

    const { data: workspace } = useGetWorkspace({ id: workspaceId });
    const { data: channels } = useGetChannels({ workspaceId });
    const { data: members } = useGetMembers({ workspaceId });
    const { counts, isLoading: isLoadingMentions } = useGetUnreadMentionsCount();
    const [searchQuery, setSearchQuery] = useState('');
    const [messageResults, setMessageResults] = useState<{ id: string; text: string; summary?: string }[]>([]);
    const [isSearchingMessages, setIsSearchingMessages] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const simpleAiSearch = useAction(api.aiSearch.simpleAiSearch.simpleAiSearch);

    const isAiMode = searchQuery.startsWith('/ai ');

    const channelMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        (channels || []).forEach((c: any) => { map[c._id] = c.name; });
        return map;
    }, [channels]);

    const normalMessageResults = useQuery(
        api.searchMessages.searchMessages,
        !isAiMode && searchQuery.trim() && workspaceId
            ? { workspaceId, search: searchQuery, limit: 20 }
            : 'skip'
    );
    console.log('searchQuery:', searchQuery, 'normalMessageResults:', normalMessageResults);
    // Removed setSearchQuery from effects to ensure input is only controlled by onValueChange
    
    React.useEffect(() => {
        if (!isAiMode) {
            setMessageResults([]);
            setIsSearchingMessages(false);
            setAiError(null);
            return;
        }
        const aiQuery = searchQuery.replace('/ai ', '').trim();
        if (!aiQuery || !workspaceId) {
            setMessageResults([]);
            setIsSearchingMessages(false);
            setAiError(null);
            return;
        }
        let active = true;
        setIsSearchingMessages(true);
        setAiError(null);
        simpleAiSearch({ workspaceId, query: aiQuery })
            .then((res) => {
                if (!active) return;
                setMessageResults(
                    res.sources.map((msg) => ({
                        id: msg.id,
                        text: msg.text,
                        summary: res.answer
                    }))
                );
                setIsSearchingMessages(false);
            })
            .catch((err) => {
                if (!active) return;
                setMessageResults([]);
                setIsSearchingMessages(false);
                setAiError('AI search failed');
    
                console.error('AI search error:', err);
            });
        return () => {
            active = false;
        };
    }, [isAiMode, searchQuery, workspaceId, simpleAiSearch]);

    React.useEffect(() => {
        if (!isAiMode) {
            setMessageResults([]);
            setIsSearchingMessages(false);
            setAiError(null);
            return;
        }
        const aiQuery = searchQuery.replace('/ai ', '').trim();
        if (!aiQuery || !workspaceId) {
            setMessageResults([]);
            setIsSearchingMessages(false);
            setAiError(null);
            return;
        }
        let active = true;
        setIsSearchingMessages(true);
        setAiError(null);
        simpleAiSearch({ workspaceId, query: aiQuery })
            .then((res) => {
                if (!active) return;
                setMessageResults(
                    res.sources.map((msg) => ({
                        id: msg.id,
                        text: msg.text,
                        summary: res.answer
                    }))
                );
                setIsSearchingMessages(false);
            })
            .catch((err) => {
                if (!active) return;
                setMessageResults([]);
                setIsSearchingMessages(false);
                setAiError('AI search failed');

                console.error('AI search error:', err);
            });
        return () => {
            active = false;
        };
    }, [isAiMode, searchQuery, workspaceId, simpleAiSearch]);

    React.useEffect(() => {
        if (isAiMode) return;
    }, [searchQuery, workspaceId, isAiMode]);
    useEffect(() => {
        const openUserSettings = searchParams.get('openUserSettings');
        if (openUserSettings) {
            setUserSettingsTab(openUserSettings as 'profile' | 'notifications');
            setForceOpenUserSettings(true);

            // Clean up URL parameter
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('openUserSettings');
            router.replace(newUrl.pathname + newUrl.search);
        }
    }, [searchParams, router]);

    const handleUserSettingsClose = () => {
        setForceOpenUserSettings(false);
    };

    const onChannelClick = (channelId: Id<'channels'>) => {
        setSearchOpen(false);
        router.push(`/workspace/${workspaceId}/channel/${channelId}/chats`);
    };

    const onMemberClick = (memberId: Id<'members'>) => {
        setSearchOpen(false);
        router.push(`/workspace/${workspaceId}/member/${memberId}`);
    };

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setSearchOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [setSearchOpen]);


    return (
        <nav className="sticky top-0 z-50 flex h-16 items-center overflow-hidden border-b bg-primary text-secondary-foreground shadow-md">
            {/* Left section - Entity info (Channel/Member/etc) */}
            <div className="flex items-center px-6">{children}</div>

            {/* Middle section - Search */}
            <div className="min-w-[280px] max-w-[642px] shrink grow-[2] px-4">
                <Button
                    onClick={() => setSearchOpen(true)}
                    size="sm"
                    className="h-9 w-full justify-start bg-white/10 px-3 hover:bg-white/20 transition-standard border border-white/10 rounded-[10px]"
                >
                    <Search className="mr-2 size-4 text-white" />
                    <span className="text-xs text-white">Search {workspace?.name ?? 'workspace'}...</span>
                    <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-90">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </Button>

                <CommandDialog
                    open={searchOpen}
                    onOpenChange={(v: boolean) => {
                        setSearchOpen(v);
                        if (!v) {
                            setMessageResults([]);
                            setIsSearchingMessages(false);
                            setAiError(null);
                        }
                    }}
                >
                    <CommandInput
                        placeholder={`Search ${workspace?.name ?? 'workspace'}...`}
                        value={searchQuery}
                        onValueChange={(val: string) => setSearchQuery(val)}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {isSearchingMessages ? 'Searching messages...' : 'No results found.'}
                        </CommandEmpty>

                        <CommandGroup heading="Channels">
                            {channels?.map((channel) => (
                                <CommandItem onSelect={() => onChannelClick(channel._id)} key={channel._id}>
                                    {channel.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        <CommandSeparator />

                        <CommandGroup heading="Members">
                            {members?.map((member) => (
                                <CommandItem onSelect={() => onMemberClick(member._id)} key={member._id}>
                                    {member.user.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>

                        <CommandSeparator />

                        <CommandGroup heading="Messages">
                            {/* AI mode: show AI results */}
                            {isAiMode && messageResults.length > 0 && messageResults.map((msg) => (
                                <CommandItem key={msg.id}>
                                    <div>
                                        <div className="font-medium text-xs truncate max-w-[300px]">{msg.text}</div>
                                        {msg.summary && (
                                            <div className="text-[10px] text-muted-foreground mt-1 italic">Summary: {msg.summary}</div>
                                        )}
                                    </div>
                                </CommandItem>
                            ))}
                            {/* Normal mode: show normal message results with channel name */}
                            {!isAiMode && normalMessageResults && normalMessageResults.length > 0 && normalMessageResults.map((msg: any) => (
                                <CommandItem
                                    key={msg._id}
                                    onSelect={() => {
                                        setSearchOpen(false);
                                        router.push(`/workspace/${workspaceId}/channel/${msg.channelId}/chats?highlight=${msg._id}`);
                                    }}
                                >
                                    <div>
                                        <div className="font-medium text-xs truncate max-w-[300px]">{msg.text}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1 italic">Channel: {channelMap[msg.channelId] || msg.channelId}</div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </CommandDialog>
            </div>

            {/* Right section - Actions */}
            <div className="ml-auto flex flex-1 items-center justify-end gap-x-3 px-6">

                {/* Roadmap Button */}
                <Hint label="Roadmap & Feedback" side="bottom">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-white relative hover:bg-white/15 transition-colors"
                        onClick={() => {
                            // Open roadmap page in a new tab
                            const roadmapUrl = 'https://proddy.canny.io/';
                            window.open(roadmapUrl, '_blank', 'noopener,noreferrer');
                        }}
                    >
                        <div className="relative">
                            <Map className="size-5" />
                        </div>
                    </Button>
                </Hint>

                {/* Documentation Button */}
                <Hint label="Documentation" side="bottom">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-white relative hover:bg-white/15 transition-colors"
                        onClick={() => {
                            // Open documentation in a new tab
                            const docsUrl = 'https://docs.proddy.tech/';
                            window.open(docsUrl, '_blank', 'noopener,noreferrer');
                        }}
                    >
                        <div className="relative">
                            <HelpCircle className="size-5" />
                        </div>
                    </Button>
                </Hint>

                {/* Chat Support Button */}
                <Hint label="Chat Support" side="bottom">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-white relative hover:bg-white/15 transition-colors"
                        onClick={() => {
                            // Show Tidio chat widget
                            showTidioChat();
                        }}
                    >
                        <div className="relative">
                            <HeartPulse className="size-5" />
                        </div>
                    </Button>
                </Hint>

                {/* Status Page Button */}
                <Hint label="System Status" side="bottom">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-white relative hover:bg-white/15 transition-colors"
                        onClick={() => {
                            // Open status page in a new tab
                            const statusPageUrl = 'https://status.proddy.tech/';
                            window.open(statusPageUrl, '_blank', 'noopener,noreferrer');
                        }}
                    >
                        <div className="relative">
                            <Activity className="size-5" />
                        </div>
                    </Button>
                </Hint>


                {/* Notifications Button */}
                <Hint label="Notifications" side="bottom">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        className="text-white relative hover:bg-white/15 transition-colors"
                        onClick={() => setNotificationsOpen(true)}
                    >
                        <div className="relative">
                            <Bell className="size-5" />
                            {!isLoadingMentions && counts && counts.total > 0 && (
                                <Badge
                                    variant="default"
                                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 border border-white shadow-sm"
                                >
                                    {counts.total}
                                </Badge>
                            )}
                        </div>
                    </Button>
                </Hint>

                {/* Notification Dialog */}
                <MentionsNotificationDialog
                    open={notificationsOpen}
                    onOpenChange={setNotificationsOpen}
                />

                <UserButton
                    forceOpenSettings={forceOpenUserSettings}
                    defaultTab={userSettingsTab}
                    onSettingsClose={handleUserSettingsClose}
                />
            </div>
        </nav>
    );
};
