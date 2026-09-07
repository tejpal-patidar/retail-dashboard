import axios from 'axios';

let rawBaseURL = import.meta.env.VITE_API_URL || '/api';
// Automatically normalize baseURL: ensure it ends with /api if it's an HTTP(S) URL
if (rawBaseURL.startsWith('http')) {
  const trimmed = rawBaseURL.replace(/\/+$/, '');
  if (!trimmed.endsWith('/api')) {
    rawBaseURL = `${trimmed}/api`;
  }
}

const api = axios.create({
  baseURL: rawBaseURL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'x-app-client': 'GroceryIQ'
  }
});

// Request interceptor — attach JWT token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor — handle 401
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
