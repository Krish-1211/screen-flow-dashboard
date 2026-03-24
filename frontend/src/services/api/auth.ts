import api from '@/lib/axios';

export const authApi = {
  login: async (credentials: { email?: string, username?: string, password: string }) => {
    const username = credentials.username || credentials.email || 'admin';
    const password = credentials.password;
    
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post('/auth/token', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.access_token) {
      localStorage.setItem('sf_token', response.data.access_token);
    }

    return response.data;
  },
  logout: () => {
    localStorage.removeItem('sf_token');
  },
  isAuthenticated: () => {
    return !!localStorage.getItem('sf_token');
  }
};
