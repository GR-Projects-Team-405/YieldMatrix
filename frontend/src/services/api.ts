import axios from 'axios';
export const TOKEN_KEY = 'yieldmatrix_token';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? '';

    const isPublicAuthenticationRequest =
      /\/ym03\/(?:login|approval-status)(?:\?|$)/.test(requestUrl) ||
      /\/auth\/demo-login(?:\?|$)/.test(requestUrl);

    if (
      error.response?.status === 401 &&
      !isPublicAuthenticationRequest
    ) {
      window.dispatchEvent(
        new Event('yieldmatrix:unauthorized')
      );
    }

    return Promise.reject(error);
  }
);
export default api;
