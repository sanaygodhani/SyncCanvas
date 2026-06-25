import Modal from '../ui/Modal';

export default function CommunitySettings({ open, onOpenChange, community }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Community Settings"
      description={`Manage ${community?.name || 'this community'}`}
      size="lg"
      footer={
        <button
          onClick={() => onOpenChange(false)}
          className="px-4 py-2 text-sm bg-blurple hover:bg-blurple-600 text-white font-medium rounded-md transition-colors"
        >
          Done
        </button>
      }
    >
      <div className="space-y-6">
        {/* Overview */}
        <div>
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Overview</h3>
          <div className="bg-discord-bg rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-discord-muted">Name</span>
              <span className="text-sm text-gray-100">{community?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-discord-muted">Type</span>
              <span className="text-sm text-gray-100">
                {community?.is_public ? 'Public' : 'Private'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-discord-muted">Members</span>
              <span className="text-sm text-gray-100">
                {community?.member_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
          <div className="bg-red-500/5 border border-red-500/20 rounded-md p-4">
            <p className="text-sm text-red-300 mb-3">
              Deleting this community is permanent and cannot be undone.
            </p>
            <button className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors">
              Delete Community
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}