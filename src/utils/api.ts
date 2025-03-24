import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { config } from '../config/env';

// Add these interfaces at the top of the file, after the imports
interface ApiError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    data?: any;
  };
  code?: string;
  isAxiosError?: boolean;
}

const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage - in a production environment, you'd use a more secure storage solution
const userTokens: Record<string, string> = {};
const refreshTokens: Record<string, string> = {};
const tokenExpiry: Record<string, number> = {}; // Store token expiry timestamps

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

// Add response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.params?.userId) {
      originalRequest._retry = true;
      const userId = originalRequest.params.userId;
      
      // Check if we have a refresh token for this user
      if (refreshTokens[userId]) {
        try {
          // Try to refresh the token
          const response = await axios.post(`${config.apiBaseUrl}/auth/refresh-token`, {
            refreshToken: refreshTokens[userId]
          });
          
          if (response.data.tokens && response.data.tokens.access) {
            // Update tokens
            setTokenForUser(userId, response.data.tokens.access.token);
            if (response.data.tokens.refresh) {
              setRefreshTokenForUser(userId, response.data.tokens.refresh.token);
              setTokenExpiryForUser(userId, new Date(response.data.tokens.access.expires).getTime());
            }
            
            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${response.data.tokens.access.token}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Clear the tokens if refresh fails
          clearTokenForUser(userId);
          return Promise.reject(error);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export const setTokenForUser = (userId: string, token: string): void => {
  userTokens[userId] = token;
};

export const setRefreshTokenForUser = (userId: string, token: string): void => {
  refreshTokens[userId] = token;
};

export const setTokenExpiryForUser = (userId: string, expiryTimestamp: number): void => {
  tokenExpiry[userId] = expiryTimestamp;
};

export const getTokenForUser = (userId?: string): string | null => {
  if (!userId) return null;
  return userTokens[userId] || null;
};

export const clearTokenForUser = (userId: string): void => {
  delete userTokens[userId];
  delete refreshTokens[userId];
  delete tokenExpiry[userId];
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

    // Log request details (excluding sensitive data)
    const logData = { ...data };
    if (logData && typeof logData === 'object') {
      if (logData.password) logData.password = '********';
      if (logData.otp) logData.otp = '****';
    }
    console.log(`API Request: ${method} ${url}`, { 
      params: requestConfig.params, 
      data: logData,
      headers: { 
        ...requestConfig.headers,
        Authorization: requestConfig.headers?.Authorization ? 'Bearer ********' : undefined
      }
    });

    const response: AxiosResponse<T> = await apiClient(requestConfig);
    
    // Log successful response
    console.log(`API Response: ${method} ${url}`, {
      status: response.status,
      statusText: response.statusText,
      // Log more details for debugging unexpected response formats
      data: typeof response.data === 'object' ? JSON.stringify(response.data) : response.data,
      // Only log the structure of the response data, not the full content for large responses
      dataStructure: response.data ? Object.keys(response.data as any) : null
    });
    
    return response.data;
  } catch (error: unknown) {
    // Cast to ApiError type with safety checks
    const apiError = error as ApiError;
    
    // Enhanced error logging with safe property access
    console.error(`API Error: ${method} ${url}`, {
      status: apiError.response?.status,
      statusText: apiError.response?.statusText,
      data: apiError.response?.data,
      message: apiError.message,
      code: apiError.code
    });
    
    // Console.log a stack trace for debugging
    console.error('Error stack:', apiError.stack);
    
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