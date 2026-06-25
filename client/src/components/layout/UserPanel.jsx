import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { useSocket } from '../../lib/socket';
import { Mic, Headphones, Settings, LogOut } from 'lucide-react';
import clsx from 'clsx';

function AutoAvatar({ user }) {
  if (!user) return null;
  const initials = (user.display_name || user.username || '?')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

const statusColors = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export default function UserPanel() {
  const { user, logout } = useAuthStore();
  const { openUserSettings } = useUIStore();
  const { connected } = useSocket();

  const status = connected ? 'online' : 'offline';
  const statusLabel = connected ? 'Online' : 'Offline';

  return (
    <div className="user-panel shrink-0">
      {/* Avatar with status */}
      <div className="relative shrink-0">
        <AutoAvatar user={user} />
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-sidebar',
            statusColors[status]
          )}
        />
      </div>

      {/* Username & status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-100 truncate">
          {user?.display_name || user?.username || 'User'}
        </p>
        <p className="text-[10px] text-discord-muted truncate">
          {statusLabel}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        <button
          className="p-1.5 text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover rounded transition-colors"
          title="Voice settings"
        >
          <Mic className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover rounded transition-colors"
          title="Sound"
        >
          <Headphones className="w-4 h-4" />
        </button>
        <button
          onClick={openUserSettings}
          className="p-1.5 text-discord-muted hover:text-gray-100 hover:bg-discord-surface-hover rounded transition-colors"
          title="User settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={logout}
          className="p-1.5 text-discord-muted hover:text-red-400 hover:bg-discord-surface-hover rounded transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}