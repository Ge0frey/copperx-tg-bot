import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '../config/env';

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include tokens
apiClient.interceptors.request.use(
  (config) => {
    const token = getTokenForUser(config.params?.userId);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Token storage - in a production environment, you'd use a more secure storage solution
const userTokens: Record<string, string> = {};

export const setTokenForUser = (userId: string, token: string): void => {
  userTokens[userId] = token;
};

export const getTokenForUser = (userId?: string): string | null => {
  if (!userId) return null;
  return userTokens[userId] || null;
};

export const clearTokenForUser = (userId: string): void => {
  delete userTokens[userId];
};

// Generic API request function
export const apiRequest = async <T>(
  method: string,
  url: string,
  data?: any,
  userId?: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  try {
    const requestConfig: AxiosRequestConfig = {
      ...config,
      method,
      url,
      params: { ...config?.params, userId },
    };

    if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
      requestConfig.data = data;
    } else if (data) {
      requestConfig.params = { ...requestConfig.params, ...data };
    }

    const response: AxiosResponse<T> = await apiClient(requestConfig);
    return response.data;
  } catch (error: any) {
    console.error(`API Error: ${method} ${url}`, error.response?.data || error.message);
    throw error;
  }
};

// API Service wrapper functions
export const get = <T>(url: string, params?: any, userId?: string, config?: AxiosRequestConfig): Promise<T> => {
  return apiRequest<T>('GET', url, params, userId, config);
};

export const post = <T>(url: string, data?: any, userId?: string, config?: AxiosRequestConfig): Promise<T> => {
  return apiRequest<T>('POST', url, data, userId, config);
};

export const put = <T>(url: string, data?: any, userId?: string, config?: AxiosRequestConfig): Promise<T> => {
  return apiRequest<T>('PUT', url, data, userId, config);
};

export const remove = <T>(url: string, data?: any, userId?: string, config?: AxiosRequestConfig): Promise<T> => {
  return apiRequest<T>('DELETE', url, data, userId, config);
}; 