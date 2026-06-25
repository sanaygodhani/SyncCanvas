import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communitiesApi, channelsApi } from '../lib/api';

// ---- Communities ----
export function useCommunities() {
  return useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });
}

export function useCommunity(id) {
  return useQuery({
    queryKey: ['community', id],
    queryFn: () => communitiesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => communitiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}

export function useDeleteCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => communitiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, inviteCode }) => communitiesApi.join(id, inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}

export function useLeaveCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => communitiesApi.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}

// ---- Channels ----
export function useChannels(communityId) {
  return useQuery({
    queryKey: ['channels', communityId],
    queryFn: () => channelsApi.list(communityId),
    enabled: !!communityId,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ communityId, data }) => channelsApi.create(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => channelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => channelsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}