import { useUIStore } from '../../stores/uiStore';
import { useCommunity } from '../../hooks/useCommunity';
import ChannelItem from '../channel/ChannelItem';
import { ChevronDown, Plus, Settings, UserPlus, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

function CategoryGroup({ category, channels, onChannelClick, selectedChannelId, communityId }) {
  const [collapsed, setCollapsed] = useState(false);

  const categoryChannels = channels?.filter(
    (ch) => ch.category_id === category.id
  ) || [];

  const unCategorizedChannels = category.id === '__uncategorized__'
    ? channels?.filter((ch) => !ch.category_id) || []
    : [];

  const displayChannels = category.id === '__uncategorized__' ? unCategorizedChannels : categoryChannels;

  if (displayChannels.length === 0) return null;

  return (
    <div>
      {/* Category header */}
      <div
        className="category-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1">
          <ChevronRight
            className={clsx(
              'w-3 h-3 transition-transform',
              !collapsed && 'rotate-90'
            )}
          />
          <span>{category.name}</span>
        </div>
      </div>

      {/* Channel items */}
      {!collapsed && (
        <div className="mt-0.5 space-y-[2px]">
          {displayChannels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              active={selectedChannelId === channel.id}
              onClick={() => onChannelClick(channel)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChannelSidebar() {
  const {
    selectedCommunityId,
    selectedChannelId,
    setSelectedChannel,
    openCreateChannel,
    openCommunitySettings,
    openInviteModal,
  } = useUIStore();

  const { data: community, isLoading } = useCommunity(selectedCommunityId);

  const handleChannelClick = (channel) => {
    setSelectedChannel(channel.id);
  };

  // Collect all categories from the community data
  const categories = community?.channel_categories || [];
  // Add uncategorized section
  const allCategories = [
    ...categories,
    { id: '__uncategorized__', name: 'Channels', position: -1 },
  ].sort((a, b) => a.position - b.position);

  return (
    <div
      data-testid="channel-sidebar"
      className="w-channel-sidebar min-w-channel-sidebar h-full bg-discord-sidebar flex flex-col"
    >
      {/* Community header */}
      <div className="content-header h-12 px-4 flex items-center justify-between group cursor-pointer hover:bg-discord-surface-hover transition-colors border-b border-discord-divider shrink-0">
        <h2 className="text-sm font-semibold text-gray-100 truncate">
          {isLoading ? (
            <span className="bg-discord-surface animate-pulse rounded w-24 h-4 inline-block" />
          ) : (
            community?.name || 'Select a community'
          )}
        </h2>
        {/* Dropdown button */}
        <button className="text-discord-muted hover:text-gray-100 transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-4 py-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-discord-surface animate-pulse rounded h-6 w-3/4" />
            ))}
          </div>
        ) : selectedCommunityId ? (
          allCategories.map((category) => (
            <CategoryGroup
              key={category.id}
              category={category}
              channels={community?.channel_categories
                ?.flatMap((cat) => cat.channels)
                .filter(Boolean) || []}
              onChannelClick={handleChannelClick}
              selectedChannelId={selectedChannelId}
              communityId={selectedCommunityId}
            />
          ))
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-discord-muted text-sm">
              Select a community or start a DM
            </p>
          </div>
        )}
      </div>

      {/* Actions bar */}
      {selectedCommunityId && (
        <div className="px-2 py-2 border-t border-discord-divider shrink-0">
          <div className="flex items-center gap-0.5">
            <button
              onClick={openCreateChannel}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Channel</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={openInviteModal}
              className="p-1.5 text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover rounded transition-colors"
              title="Invite people"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={openCommunitySettings}
              className="p-1.5 text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover rounded transition-colors"
              title="Community settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}