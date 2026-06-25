import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Let the auth store handle it
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ---- Auth API ----
export const authApi = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  getSession: () => api.get('/auth/me').then((r) => r.data),
  magicLink: (email) => api.post('/auth/magic-link', { email }).then((r) => r.data),
};

// ---- Users API ----
export const usersApi = {
  getMe: () => api.get('/users/me').then((r) => r.data),
  updateMe: (data) => api.put('/users/me', data).then((r) => r.data),
  getUser: (id) => api.get(`/users/${id}`).then((r) => r.data),
};

// ---- Communities API ----
export const communitiesApi = {
  list: () => api.get('/communities').then((r) => r.data),
  get: (id) => api.get(`/communities/${id}`).then((r) => r.data),
  create: (data) => api.post('/communities', data).then((r) => r.data),
  update: (id, data) => api.put(`/communities/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/communities/${id}`).then((r) => r.data),
  join: (id, inviteCode) => api.post(`/communities/${id}/join`, { invite_code: inviteCode }).then((r) => r.data),
  leave: (id) => api.post(`/communities/${id}/leave`).then((r) => r.data),
};

// ---- Channels API ----
export const channelsApi = {
  list: (communityId) => api.get(`/channels/community/${communityId}`).then((r) => r.data),
  create: (communityId, data) => api.post(`/channels/community/${communityId}`, data).then((r) => r.data),
  update: (id, data) => api.put(`/channels/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/channels/${id}`).then((r) => r.data),
};

export default api;