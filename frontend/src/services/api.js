import axios from 'axios';

// Dynamically construct API URL using current hostname for LAN access
const getApiUrl = () => {
    // If explicitly set (for production/custom setups), use the env var
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    // Otherwise, use the current hostname with backend port
    const hostname = window.location.hostname;
    return `http://${hostname}:5000/api`;
};

const API_URL = getApiUrl();

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth API
export const authApi = {
    login: (username, password) => api.post('/auth/login', { username, password }),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
    resetPassword: (currentPassword, newPassword, confirmPassword) =>
        api.post('/auth/reset-password', { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }),
    getSessions: () => api.get('/auth/sessions'),
    revokeSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
};

// Users API
export const usersApi = {
    list: (params) => api.get('/users', { params }),
    get: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
};

// Owners API
export const ownersApi = {
    list: (params) => api.get('/owners', { params }),
    get: (id) => api.get(`/owners/${id}`),
    create: (data) => api.post('/owners', data),
    update: (id, data) => api.put(`/owners/${id}`, data),
    delete: (id) => api.delete(`/owners/${id}`),
    createFromUser: (userId) => api.post(`/owners/from-user/${userId}`),
};

// VMs API
export const vmsApi = {
    list: (params) => api.get('/vms', { params }),
    get: (id) => api.get(`/vms/${id}`),
    getSummary: () => api.get('/vms/summary'),
    updateManual: (id, data) => api.put(`/vms/${id}/manual`, data),
    getTags: (id) => api.get(`/vms/${id}/tags`),
    addTag: (id, tagValue) => api.post(`/vms/${id}/tags`, { tag_value: tagValue }),
    removeTag: (id, tagId) => api.delete(`/vms/${id}/tags/${tagId}`),
    getManualIps: (id) => api.get(`/vms/${id}/manual-ips`),
    addManualIp: (id, data) => api.post(`/vms/${id}/manual-ips`, data),
    removeManualIp: (id, ipId) => api.delete(`/vms/${id}/manual-ips/${ipId}`),
    exportVMs: (params) => api.get('/vms/export', { params, responseType: 'blob' }),
};

// Sync API
export const syncApi = {
    nutanix: () => api.post('/sync/nutanix'),
    vmware: () => api.post('/sync/vmware'),
    networks: () => api.post('/sync/networks'),
    all: () => api.post('/sync/all'),
    getRuns: (params) => api.get('/sync/runs', { params }),
    getRun: (id) => api.get(`/sync/runs/${id}`),
    getStatus: () => api.get('/sync/status'),

    getNetworks: () => api.get('/sync/networks'),
};

// Changes API
export const changesApi = {
    list: (params) => api.get('/changes', { params }),
    getSummary: () => api.get('/changes/summary'),
    getVmChanges: (vmId, params) => api.get(`/changes/vm/${vmId}`, { params }),
    getTypes: () => api.get('/changes/types'),
};

// Networks API
export const networksApi = {
    list: (params) => api.get('/networks', { params }),
    get: (id) => api.get(`/networks/${id}`),
    update: (id, data) => api.put(`/networks/${id}`, data),
    syncVmware: () => api.post('/networks/sync/vmware'),
    syncNutanix: () => api.post('/networks/sync/nutanix'),
    getSummary: () => api.get('/networks/summary'),
};

// Settings API
export const settingsApi = {
    getSyncSettings: () => api.get('/settings/sync'),
    updateSyncSettings: (data) => api.put('/settings/sync', data),
    listApis: () => api.get('/settings/apis'),
    createApi: (data) => api.post('/settings/apis', data),
    updateApi: (id, data) => api.put(`/settings/apis/${id}`, data),
    deleteApi: (id) => api.delete(`/settings/apis/${id}`),
};

// Hosts API
export const hostsApi = {
    list: (params) => api.get('/hosts', { params }),
    getSummary: () => api.get('/hosts/summary'),
    sync: (platform) => api.post('/hosts/sync', {}, { params: { platform } }),
};


// Audit API
export const auditApi = {
    list: (params) => api.get('/audit', { params }),
    getTypes: () => api.get('/audit/types'),
};
