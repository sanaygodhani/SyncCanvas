import { useUIStore } from '../../stores/uiStore';
import { useCommunities } from '../../hooks/useCommunity';
import { Plus, MessageCircle } from 'lucide-react';
import clsx from 'clsx';

const communityColors = [
  'bg-blurple',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
];

function getCommunityColor(index) {
  return communityColors[index % communityColors.length];
}

function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function CommunityList() {
  const { selectedCommunityId, setSelectedCommunity, setDMUser, dmUserId, openCreateCommunity } = useUIStore();
  const { data: communities, isLoading } = useCommunities();

  return (
    <div
      data-testid="community-list"
      className="w-community-bar min-w-community-bar h-full bg-discord-channels flex flex-col items-center py-3 gap-2 overflow-y-auto"
    >
      {/* DM button */}
      <div className="relative group">
        <button
          onClick={() => setDMUser(null)}
          className={clsx(
            'sidebar-icon',
            !selectedCommunityId && !dmUserId && 'sidebar-icon-active',
            dmUserId && 'sidebar-icon-active'
          )}
          title="Direct Messages"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
        {!selectedCommunityId && !dmUserId && (
          <div className="pill-indicator" />
        )}
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Direct Messages
        </div>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-discord-divider my-1" />

      {/* Community icons */}
      {isLoading ? (
        <>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-2xl bg-discord-surface animate-pulse"
            />
          ))}
        </>
      ) : (
        communities?.map((community, index) => {
          const initials = getInitials(community.name);
          const isSelected = selectedCommunityId === community.id;

          return (
            <div key={community.id} className="relative group">
              <button
                onClick={() => {
                  setSelectedCommunity(community.id);
                  setDMUser(null);
                }}
                className={clsx(
                  'sidebar-icon w-12 h-12 overflow-hidden',
                  getCommunityColor(index),
                  isSelected && 'sidebar-icon-selected'
                )}
                title={community.name}
              >
                {community.icon_url ? (
                  <img
                    src={community.icon_url}
                    alt={community.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-semibold text-sm">
                    {initials}
                  </span>
                )}
              </button>

              {/* Unread badge placeholder */}
              {isSelected && <div className="pill-indicator" />}

              {/* Tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {community.name}
              </div>
            </div>
          );
        })
      )}

      {/* Add community button */}
      <div className="relative group mt-1">
        <button
          onClick={openCreateCommunity}
          className="sidebar-icon border-2 border-dashed border-discord-divider hover:border-green-500 hover:bg-green-500/10 hover:text-green-500"
          title="Add a community"
        >
          <Plus className="w-6 h-6" />
        </button>
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/90 text-white text-xs font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          Add a community
        </div>
      </div>

      {/* Spacer for scroll indicator */}
      <div className="flex-1 min-h-[8px]" />
    </div>
  );
}