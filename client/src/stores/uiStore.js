import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Selected community and channel
  selectedCommunityId: null,
  selectedChannelId: null,
  dmUserId: null,

  // Sidebar state
  sidebarCollapsed: false,

  // Modals
  showCreateCommunity: false,
  showCreateChannel: false,
  showInviteModal: false,
  showCommunitySettings: false,
  showUserSettings: false,

  // Actions
  setSelectedCommunity: (id) =>
    set({ selectedCommunityId: id, selectedChannelId: null }),

  setSelectedChannel: (id) => set({ selectedChannelId: id }),

  setDMUser: (userId) =>
    set({ dmUserId: userId, selectedCommunityId: null, selectedChannelId: null }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Modal actions
  openCreateCommunity: () => set({ showCreateCommunity: true }),
  closeCreateCommunity: () => set({ showCreateCommunity: false }),

  openCreateChannel: () => set({ showCreateChannel: true }),
  closeCreateChannel: () => set({ showCreateChannel: false }),

  openInviteModal: () => set({ showInviteModal: true }),
  closeInviteModal: () => set({ showInviteModal: false }),

  openCommunitySettings: () => set({ showCommunitySettings: true }),
  closeCommunitySettings: () => set({ showCommunitySettings: false }),

  openUserSettings: () => set({ showUserSettings: true }),
  closeUserSettings: () => set({ showUserSettings: false }),
}));