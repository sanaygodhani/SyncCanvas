import clsx from 'clsx';
import { Hash, Pen, Megaphone, MessageSquare } from 'lucide-react';

const channelIcons = {
  text: Hash,
  whiteboard: Pen,
  announcement: Megaphone,
  forum: MessageSquare,
};

const channelIconMap = {
  text: '#',
  whiteboard: '🖊',
  announcement: '📢',
  forum: '💬',
};

export default function ChannelItem({ channel, active, onClick, onContextMenu }) {
  const icon = channelIconMap[channel.type] || '#';

  return (
    <div
      onClick={() => onClick?.(channel)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, channel);
      }}
      data-testid="channel-item"
      className={clsx(
        'channel-item group',
        active && 'channel-item-active'
      )}
    >
      {/* Channel icon */}
      <span className="w-5 text-center shrink-0 text-[11px]">{icon}</span>

      {/* Channel name */}
      <span className="truncate flex-1">{channel.name}</span>

      {/* Context button (appears on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu?.(e, channel);
        }}
        className="opacity-0 group-hover:opacity-100 text-discord-muted hover:text-gray-100 transition-all"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>
    </div>
  );
}