import axios from 'axios';
import { getCookie, removeCookie, extendCookie, } from './cookie';
import {
  API_ROOT,
} from '@bkeenke/shm-contract';

export const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getCookie();
    if (token) {
      config.headers['session-id'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    extendCookie();
    return response;
  },
  (error) => {
    const url = error.config?.url || '';
    const isAuthRequest = url.includes('/auth') || url.includes('/passwd/reset');
    if (error.response?.status === 401 && !isAuthRequest) {
      removeCookie();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);