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
    const userId = config.params?.userId;
    const token = getTokenForUser(userId);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // Log authentication information
      console.log(`[API] Request with authentication for user ${userId}`);
    } else if (userId) {
      console.log(`[API] Request without token for user ${userId}`);
    }
    
    // Add timestamp to help match logs
    const timestamp = new Date().toISOString();
    console.log(`[API] ${timestamp} Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
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
      // Increase timeout for slower connections
      timeout: 15000, // 15 seconds
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
    console.log(`[API] Request: ${method} ${url}`, { 
      params: requestConfig.params, 
      data: logData,
      headers: { 
        ...requestConfig.headers,
        Authorization: requestConfig.headers?.Authorization ? 'Bearer ********' : undefined
      }
    });

    const response: AxiosResponse<T> = await apiClient(requestConfig);
    
    // Log successful response status but not the entire data payload
    console.log(`[API] Response: ${method} ${url}`, {
      status: response.status,
      statusText: response.statusText,
      // Only log response structure, not actual data which may be large
      dataKeys: response.data ? Object.keys(response.data as any) : null
    });
    
    // For auth/me endpoint, log more details for debugging
    if (url === '/auth/me') {
      console.log(`[API] Profile response structure: ${JSON.stringify(response.data, null, 2)}`);
    }
    
    return response.data;
  } catch (error: unknown) {
    // Cast to ApiError type with safety checks
    const apiError = error as ApiError;
    
    // Enhanced error logging with safe property access
    console.error(`[API] Error: ${method} ${url}`, {
      status: apiError.response?.status,
      statusText: apiError.response?.statusText,
      data: apiError.response?.data,
      message: apiError.message,
      code: apiError.code
    });
    
    // Special case for auth/me endpoint
    if (url === '/auth/me') {
      console.error(`[API] Profile fetch error details:`, {
        responseData: apiError.response?.data,
        errorMessage: apiError.message,
        errorCode: apiError.code,
        isAxiosError: apiError.isAxiosError
      });
    }
    
    // Check for network errors
    if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ENOTFOUND' || apiError.code === 'ETIMEDOUT') {
      console.error(`[API] Network error: ${apiError.code}`);
      
      // Construct a friendlier error object for network issues
      const modifiedError: ApiError = new Error('Cannot connect to the server. Please check your internet connection.');
      modifiedError.code = apiError.code;
      modifiedError.response = {
        status: 503,
        statusText: 'Service Unavailable',
        data: { message: 'Cannot connect to the server' }
      };
      
      throw modifiedError;
    }
    
    // Console.log a stack trace for debugging
    console.error('[API] Error stack:', apiError.stack);
    
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