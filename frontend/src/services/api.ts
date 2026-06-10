import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatic token injection
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Projects
  projects: {
    list: () => apiClient.get('/projects'),
    create: (data: any) => apiClient.post('/projects', data),
    get: (id: number) => apiClient.get(`/projects/${id}`),
  },

  // DEGs Analysis
  degs: {
    upload: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/analyses/degs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    analyze: (data: any) => apiClient.post('/analyses/degs/analyze', data),
    results: (analysisId: number) => apiClient.get(`/analyses/degs/results/${analysisId}`),
    exportResults: (analysisId: number, format: 'csv' | 'xls') =>
      apiClient.get(`/analyses/degs/results/${analysisId}/export`, {
        params: { format },
        responseType: 'blob',
      }),
  },

  // Pathway Analysis
  pathway: {
    analyze: (data: { project_id: number; genes: string[]; organism: string; include_drugs: boolean }) =>
      apiClient.post('/analyses/pathway/analyze', data),
    results: (analysisId: number) => apiClient.get(`/analyses/pathway/results/${analysisId}`),
    expression: (geneSymbol: string) => apiClient.get(`/analyses/pathway/expression/${geneSymbol}`),
  },

  // Utility
  status: () => apiClient.get('/status'),
};

export default apiClient;
