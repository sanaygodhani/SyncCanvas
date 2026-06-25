import { useState } from 'react';
import Modal from '../ui/Modal';
import { useCreateChannel } from '../../hooks/useCommunity';

export default function CreateChannelModal({ open, onOpenChange, communityId }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const createChannel = useCreateChannel();

  const handleCreate = async () => {
    if (!name.trim() || !communityId) return;

    // Format channel name: lowercase, hyphenated
    const channelName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    if (!channelName) return;

    await createChannel.mutateAsync({
      communityId,
      data: { name: channelName, type },
    });

    setName('');
    setType('text');
    onOpenChange(false);
  };

  const channelTypes = [
    { value: 'text', label: 'Text', icon: '#', description: 'Chat messages and discussions' },
    { value: 'whiteboard', label: 'Whiteboard', icon: '🖊', description: 'Collaborative drawing canvas' },
    { value: 'announcement', label: 'Announcement', icon: '📢', description: 'Important updates (read-only for members)' },
    { value: 'forum', label: 'Forum', icon: '💬', description: 'Structured discussions with threads' },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create Channel"
      description="Create a new channel for your community"
      size="md"
      footer={
        <>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-discord-muted hover:text-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || createChannel.isPending}
            className="px-4 py-2 text-sm bg-blurple hover:bg-blurple-600 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createChannel.isPending ? 'Creating...' : 'Create Channel'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Channel Type */}
        <div>
          <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
            Channel Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {channelTypes.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setType(ct.value)}
                className={`flex flex-col items-start gap-1 p-3 rounded-md border text-left transition-colors ${
                  type === ct.value
                    ? 'border-blurple bg-blurple/10'
                    : 'border-discord-divider bg-discord-bg hover:border-discord-muted'
                }`}
              >
                <span className="text-lg">{ct.icon}</span>
                <span className="text-sm font-medium text-gray-100">{ct.label}</span>
                <span className="text-[10px] text-discord-muted">{ct.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Channel Name */}
        <div>
          <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
            Channel Name
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-discord-muted text-lg">
              {type === 'whiteboard' ? '🖊' : '#'}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'whiteboard' ? 'drawing-room' : 'new-channel'}
              className="w-full pl-10 pr-3 py-2 bg-discord-bg border border-discord-divider rounded-md text-gray-100 placeholder-discord-muted focus:outline-none focus:border-blurple focus:ring-1 focus:ring-blurple transition-colors"
              autoFocus
            />
          </div>
          <p className="text-xs text-discord-muted mt-1">
            Lowercase letters, numbers, and hyphens only
          </p>
        </div>
      </div>
    </Modal>
  );
}