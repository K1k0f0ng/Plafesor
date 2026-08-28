import axios from 'axios';
import { API } from './api';

// Instancia de axios con la URL base ya configurada
const axiosAuth = axios.create({ baseURL: API });

// Interceptor: adjunta automáticamente el token JWT a cada petición
axiosAuth.interceptors.request.use((config) => {
  const token = localStorage.getItem('playfesor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: si el token expira, redirige al login
axiosAuth.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('playfesor_token');
      localStorage.removeItem('playfesor_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosAuth;
