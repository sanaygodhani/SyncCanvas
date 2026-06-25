import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores/uiStore';
import { useCommunity } from '../../hooks/useCommunity';
import CommunityList from './CommunityList';
import ChannelSidebar from './ChannelSidebar';
import ContentArea from './ContentArea';
import UserPanel from './UserPanel';
import CreateCommunityModal from '../community/CreateCommunityModal';
import CreateChannelModal from '../channel/CreateChannelModal';
import CommunitySettings from '../community/CommunitySettings';
import InviteModal from '../community/InviteModal';

export default function AppShell() {
  const { init } = useAuth();

  useEffect(() => {
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    showCreateCommunity,
    closeCreateCommunity,
    showCreateChannel,
    closeCreateChannel,
    showCommunitySettings,
    closeCommunitySettings,
    showInviteModal,
    closeInviteModal,
    selectedCommunityId,
  } = useUIStore();

  const { data: community } = useCommunity(selectedCommunityId);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Main 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Community icons */}
        <CommunityList />

        {/* Middle: Channel sidebar */}
        <ChannelSidebar />

        {/* Right: Content area */}
        <ContentArea />
      </div>

      {/* Bottom: User panel */}
      <UserPanel />

      {/* Modals */}
      <CreateCommunityModal
        open={showCreateCommunity}
        onOpenChange={closeCreateCommunity}
      />

      <CreateChannelModal
        open={showCreateChannel}
        onOpenChange={closeCreateChannel}
        communityId={selectedCommunityId}
      />

      <CommunitySettings
        open={showCommunitySettings}
        onOpenChange={closeCommunitySettings}
        community={community}
      />

      <InviteModal
        open={showInviteModal}
        onOpenChange={closeInviteModal}
        community={community}
      />
    </div>
  );
}