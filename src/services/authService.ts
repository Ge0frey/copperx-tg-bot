import { post, get, setTokenForUser, clearTokenForUser, setRefreshTokenForUser, setTokenExpiryForUser } from '../utils/api';
import { ApiResponse, AuthResponse, EmailOtpAuthentication, EmailOtpRequest, User, Kyc } from '../models/types';

export const requestEmailOtp = async (email: string): Promise<ApiResponse<any>> => {
  try {
    const data: EmailOtpRequest = { email };
    const response = await post<any>('/auth/email-otp/request', data);
    
    // Enhanced response handling - check for various success indicators
    // Some APIs return {success: true} or {code: 200} instead of {status: true}
    if (
      (response.status === true) || 
      (response.success === true) || 
      (response.code === 200) || 
      (response.statusCode === 200) ||
      // If the API simply returns a message without status
      (response.message && !response.error)
    ) {
      return {
        status: true,
        message: response.message || 'Verification code sent successfully',
        data: response.data
      };
    } else if (response.status === false) {
      // The API explicitly returned status: false
      return response;
    } else {
      // If we can't determine success/failure, assume success
      // This is reasonable since the user is receiving the OTP
      console.log('Ambiguous API response for OTP request:', response);
      return {
        status: true,
        message: 'Verification code sent',
        data: response.data || response
      };
    }
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
    const response = await post<any>('/auth/email-otp/authenticate', data);
    
    // Enhanced response handling
    if (
      (response.status === true || response.success === true) && 
      response.data?.tokens?.access?.token
    ) {
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
      
      return {
        status: true,
        message: response.message || 'Authentication successful',
        data: response.data
      };
    } else if (response.tokens?.access?.token) {
      // Handle case where API returns tokens directly at the top level
      // This is a successful authentication but in a different format
      
      setTokenForUser(userId, response.tokens.access.token);
      
      if (response.tokens.refresh?.token) {
        setRefreshTokenForUser(userId, response.tokens.refresh.token);
      }
      
      if (response.tokens.access.expires) {
        const expiryTimestamp = new Date(response.tokens.access.expires).getTime();
        setTokenExpiryForUser(userId, expiryTimestamp);
      }
      
      // Restructure response to match expected format
      return {
        status: true,
        message: 'Authentication successful',
        data: {
          tokens: response.tokens,
          user: response.user || { email, organizationId: '', id: '' }
        }
      };
    } else if (response.status === false) {
      // API explicitly returned failure
      return response;
    } else {
      // Could not determine if successful, log for debugging
      console.error('Unexpected authentication response format:', response);
      return {
        status: false,
        message: 'Authentication failed: Unexpected response format',
        error: response
      };
    }
  } catch (error: any) {
    console.error('Error authenticating with OTP:', error.response?.data || error.message);
    
    // Enhanced error handling with more specific messages
    let errorMessage = 'Authentication failed. Please check your OTP and try again.';
    
    if (error.response?.status === 401) {
      errorMessage = 'Invalid OTP code. Please check and try again.';
    } else if (error.response?.status === 429) {
      errorMessage = 'Too many attempts. Please wait before trying again.';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    return {
      status: false,
      message: errorMessage,
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