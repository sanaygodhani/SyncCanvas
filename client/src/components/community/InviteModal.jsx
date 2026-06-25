import { useState } from 'react';
import Modal from '../ui/Modal';

export default function InviteModal({ open, onOpenChange, community }) {
  const [copied, setCopied] = useState(false);

  const inviteLink = community?.invite_code
    ? `${window.location.origin}/join/${community.invite_code}`
    : 'No invite code available';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Invite People"
      description={`Share this link to invite people to ${community?.name || 'your community'}`}
      size="md"
      footer={
        <button
          onClick={() => onOpenChange(false)}
          className="px-4 py-2 text-sm bg-blurple hover:bg-blurple-600 text-white font-medium rounded-md transition-colors"
        >
          Done
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-discord-muted uppercase tracking-wide mb-2">
            Invite Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 px-3 py-2 bg-discord-bg border border-discord-divider rounded-md text-gray-100 text-sm focus:outline-none select-all"
              onClick={(e) => e.target.select()}
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blurple hover:bg-blurple-600 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <p className="text-xs text-discord-muted">
          Anyone with this link will be able to join this community.
        </p>
      </div>
    </Modal>
  );
}