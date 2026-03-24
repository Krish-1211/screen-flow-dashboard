import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'https://screen-api-6sac.onrender.com').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // If we get a 401, it means the token is invalid or missing
      // In a real app, we would redirect to login
      console.warn('Unauthorized request. Please login.');
    }
    return Promise.reject(error);
  }
);

export default api;
