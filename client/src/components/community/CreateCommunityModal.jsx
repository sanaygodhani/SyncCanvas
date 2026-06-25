import { useState } from 'react';
import Modal from '../ui/Modal';
import { useCreateCommunity } from '../../hooks/useCommunity';

export default function CreateCommunityModal({ open, onOpenChange }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const createCommunity = useCreateCommunity();

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createCommunity.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      is_public: isPublic,
    });
    setName('');
    setDescription('');
    setIsPublic(true);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create a Community"
      description="Create a new space for your team to collaborate"
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
            disabled={!name.trim() || createCommunity.isPending}
            className="px-4 py-2 text-sm bg-blurple hover:bg-blurple-600 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createCommunity.isPending ? 'Creating...' : 'Create Community'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
            Community Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Team"
            className="w-full px-3 py-2 bg-discord-bg border border-discord-divider rounded-md text-gray-100 placeholder-discord-muted focus:outline-none focus:border-blurple focus:ring-1 focus:ring-blurple transition-colors"
            maxLength={100}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
            Description <span className="text-discord-muted-more">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this community about?"
            className="w-full px-3 py-2 bg-discord-bg border border-discord-divider rounded-md text-gray-100 placeholder-discord-muted focus:outline-none focus:border-blurple focus:ring-1 focus:ring-blurple transition-colors resize-none h-20"
            maxLength={500}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-100">Public Community</p>
            <p className="text-xs text-discord-muted">Anyone can find and join</p>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isPublic ? 'bg-blurple' : 'bg-discord-surface-hover'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                isPublic ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}