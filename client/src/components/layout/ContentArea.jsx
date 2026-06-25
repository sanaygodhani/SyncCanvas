import { useUIStore } from '../../stores/uiStore';
import { useCommunity } from '../../hooks/useCommunity';
import { Hash, Pen, Megaphone, MessageSquare, User, Pin, Users, AtSign, Search } from 'lucide-react';

const channelTypeMeta = {
  text: { icon: Hash, label: 'Text Channel' },
  whiteboard: { icon: Pen, label: 'Whiteboard' },
  announcement: { icon: Megaphone, label: 'Announcements' },
  forum: { icon: MessageSquare, label: 'Forum' },
};

export default function ContentArea() {
  const { selectedCommunityId, selectedChannelId } = useUIStore();
  const { data: community } = useCommunity(selectedCommunityId);

  // Find the selected channel from the community data
  const channels = community?.channel_categories
    ?.flatMap((cat) => cat.channels)
    .filter(Boolean) || [];

  const selectedChannel = channels.find((ch) => ch.id === selectedChannelId);
  const ChannelIcon = selectedChannel ? channelTypeMeta[selectedChannel.type]?.icon : Hash;

  // Placeholder for empty state
  if (!selectedCommunityId && !selectedChannelId) {
    return (
      <div data-testid="content-area" className="flex-1 bg-discord-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-discord-surface rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-10 h-10 text-discord-muted" />
          </div>
          <h2 className="text-xl font-semibold text-gray-100 mb-1">
            Welcome to SyncCanvas
          </h2>
          <p className="text-discord-muted text-sm max-w-sm">
            Select a community and channel to start collaborating, or create your own community to get started.
          </p>
        </div>
      </div>
    );
  }

  if (selectedCommunityId && !selectedChannel) {
    return (
      <div data-testid="content-area" className="flex-1 bg-discord-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-100 mb-1">
            Select a channel
          </h2>
          <p className="text-discord-muted text-sm">
            Choose a channel from the sidebar to start chatting or drawing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="content-area" className="flex-1 bg-discord-bg flex flex-col">
      {/* Channel Header */}
      <div className="content-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChannelIcon className="w-5 h-5 text-discord-muted" />
          <h2 className="text-sm font-semibold text-gray-100">
            {selectedChannel?.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-discord-muted hover:text-gray-100 rounded transition-colors" title="Search">
            <Search className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-discord-muted hover:text-gray-100 rounded transition-colors" title="Pinned Messages">
            <Pin className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-discord-muted hover:text-gray-100 rounded transition-colors" title="Members">
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Channel topic bar */}
      {selectedChannel?.topic && (
        <div className="px-4 py-1.5 text-xs text-discord-muted border-b border-discord-divider bg-discord-bg">
          <AtSign className="w-3 h-3 inline mr-1" />
          {selectedChannel.topic}
        </div>
      )}

      {/* Empty Messages Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-discord-surface rounded-full flex items-center justify-center mx-auto mb-3">
            <ChannelIcon className="w-8 h-8 text-discord-muted" />
          </div>
          <h3 className="text-md font-semibold text-gray-100 mb-1">
            Welcome to #{selectedChannel?.name}
          </h3>
          <p className="text-discord-muted text-sm max-w-md">
            {selectedChannel?.type === 'whiteboard'
              ? 'This is the start of the whiteboard channel. Start drawing together!'
              : 'This is the start of the channel. Send a message or start collaborating!'}
          </p>
        </div>
      </div>

      {/* Message Input Placeholder */}
      <div className="px-4 py-4 border-t border-discord-divider">
        <div className="flex items-center gap-2 bg-discord-surface rounded-lg px-4 py-2.5">
          <span className="text-discord-muted text-sm">
            {selectedChannel?.type === 'whiteboard'
              ? 'Canvas tools will appear here...'
              : `Message #${selectedChannel?.name}`}
          </span>
          <div className="flex-1" />
          <span className="text-xs text-discord-muted-more bg-discord-bg px-1.5 py-0.5 rounded">
            Phase 2
          </span>
        </div>
      </div>
    </div>
  );
}