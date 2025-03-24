import { post, get, setTokenForUser, clearTokenForUser, setRefreshTokenForUser, setTokenExpiryForUser } from '../utils/api';
import { ApiResponse, AuthResponse, EmailOtpAuthentication, EmailOtpRequest, User, Kyc } from '../models/types';

export const requestEmailOtp = async (email: string): Promise<ApiResponse<any>> => {
  try {
    const data: EmailOtpRequest = { email };
    return await post<ApiResponse<any>>('/auth/email-otp/request', data);
  } catch (error: any) {
    console.error('Error requesting email OTP:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to request OTP. Please try again.',
      error: error.response?.data || error,
    };
  }
};

export const authenticateWithOtp = async (email: string, otp: string, userId: string): Promise<ApiResponse<AuthResponse>> => {
  try {
    const data: EmailOtpAuthentication = { email, otp };
    const response = await post<ApiResponse<AuthResponse>>('/auth/email-otp/authenticate', data);
    
    if (response.status && response.data?.tokens.access.token) {
      // Store the access token associated with this user's ID
      setTokenForUser(userId, response.data.tokens.access.token);
      
      // Store refresh token if available
      if (response.data.tokens.refresh?.token) {
        setRefreshTokenForUser(userId, response.data.tokens.refresh.token);
      }
      
      // Store token expiry time
      if (response.data.tokens.access.expires) {
        const expiryTimestamp = new Date(response.data.tokens.access.expires).getTime();
        setTokenExpiryForUser(userId, expiryTimestamp);
      }
    }
    
    return response;
  } catch (error: any) {
    console.error('Error authenticating with OTP:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Authentication failed. Please check your OTP and try again.',
      error: error.response?.data || error,
    };
  }
};

export const getUserProfile = async (userId: string): Promise<ApiResponse<User>> => {
  try {
    return await get<ApiResponse<User>>('/auth/me', {}, userId);
  } catch (error: any) {
    console.error('Error getting user profile:', error.response?.data || error.message);
    
    // If the error is due to unauthorized access, clear the token
    if (error.response?.status === 401) {
      clearTokenForUser(userId);
    }
    
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to fetch user profile. Please log in again.',
      error: error.response?.data || error,
    };
  }
};

export const getKycStatus = async (userId: string): Promise<ApiResponse<Kyc[]>> => {
  try {
    return await get<ApiResponse<Kyc[]>>('/kycs', {}, userId);
  } catch (error: any) {
    console.error('Error getting KYC status:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to fetch KYC status.',
      error: error.response?.data || error,
    };
  }
}; 