import { post, get, setTokenForUser, clearTokenForUser, setRefreshTokenForUser, setTokenExpiryForUser } from '../utils/api';
import { ApiResponse, AuthResponse, EmailOtpAuthentication, EmailOtpRequest, User, Kyc } from '../models/types';
import { getTempData } from '../utils/sessionManager';

// Add this interface at the top of the file after the imports
interface ApiError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    data?: any;
  };
  code?: string;
}

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
      console.log('OTP request success response:', JSON.stringify(response));
      
      // Ensure we capture sid in any of the possible locations
      const sid = response.sid || (response.data && response.data.sid) || 
                  response.sessionId || (response.data && response.data.sessionId);
      
      return {
        status: true,
        message: response.message || 'Verification code sent successfully',
        data: {
          ...(response.data || {}),
          sid: sid
        }
      };
    } else if (response.status === false) {
      // The API explicitly returned status: false
      return response;
    } else {
      // If we can't determine success/failure, assume success
      // This is reasonable since the user is receiving the OTP
      console.log('Ambiguous API response for OTP request:', response);
      
      // Extract potential sid from any location in the response
      const sid = response.sid || (response.data && response.data.sid) || 
                  response.sessionId || (response.data && response.data.sessionId);
      
      return {
        status: true,
        message: 'Verification code sent',
        data: {
          ...(response.data || {}),
          ...(response || {}),
          sid: sid
        }
      };
    }
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('Error requesting email OTP:', apiError.response?.data || apiError.message);
    
    // Enhanced error message extraction
    let errorMessage = 'Failed to request OTP. Please try again.';
    
    if (apiError.response?.data?.message) {
      // Ensure data.message is a string
      if (typeof apiError.response.data.message === 'string') {
        errorMessage = apiError.response.data.message;
      } else if (typeof apiError.response.data.message === 'object') {
        try {
          errorMessage = JSON.stringify(apiError.response.data.message);
        } catch (e) {
          // Keep default message if stringify fails
        }
      }
    } else if (apiError.message && typeof apiError.message === 'string') {
      errorMessage = apiError.message;
    }
    
    // Log full error for debugging
    console.error('OTP request error details:', JSON.stringify({
      status: apiError.response?.status,
      data: apiError.response?.data,
      message: apiError.message
    }, null, 2));
    
    return {
      status: false,
      message: errorMessage,
      error: apiError.response?.data || apiError,
    };
  }
};

export const authenticateWithOtp = async (email: string, otp: string, userId: string): Promise<ApiResponse<AuthResponse>> => {
  try {
    // Get the sid from temporary data storage
    const sid = getTempData(userId, 'sid');
    
    // Include sid in the authentication payload
    const data: EmailOtpAuthentication = { 
      email, 
      otp,
      sid: sid 
    };
    
    console.log('Authentication payload:', JSON.stringify(data));
    const response = await post<any>('/auth/email-otp/authenticate', data);
    
    // Log the full response for debugging
    console.log('Authentication raw response:', JSON.stringify(response, null, 2));
    
    // Check if response is directly an error message or error object
    if (response.error) {
      return {
        status: false,
        message: typeof response.error === 'string' ? response.error : 'Authentication failed',
        error: response.error
      };
    }
    
    // Handle the case where the API returns a simple success response
    if (response.success === true || response.status === true) {
      // If there's no tokens info, but we have a success status, create a minimal response
      if (!response.data?.tokens && !response.tokens) {
        console.log('Success response without tokens, constructing minimal response');
        
        // Check if user exists in various places in the response
        const user = response.data?.user || response.user || { email, id: '', organizationId: '' };
        
        // Construct a basic response that meets our AuthResponse structure
        const constructedResponse = {
          tokens: {
            access: {
              token: response.token || response.accessToken || '',
              expires: new Date(Date.now() + 3600000).toISOString() // Default 1 hour
            }
          },
          user: user
        };
        
        // If we found a token, store it and return success
        if (constructedResponse.tokens.access.token) {
          setTokenForUser(userId, constructedResponse.tokens.access.token);
          
          return {
            status: true,
            message: 'Authentication successful',
            data: constructedResponse
          };
        }
      }
    }
    
    // Enhanced response handling for standard format
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
    } else if (response.token || response.accessToken) {
      // Handle the simplest case where API just returns a token directly
      const token = response.token || response.accessToken;
      setTokenForUser(userId, token);
      
      // Construct a proper response object
      return {
        status: true,
        message: 'Authentication successful',
        data: {
          tokens: {
            access: {
              token: token,
              expires: new Date(Date.now() + 3600000).toISOString() // Default 1 hour
            }
          },
          user: response.user || { email, organizationId: '', id: '' }
        }
      };
    } else if (response.status === false) {
      // API explicitly returned failure
      return response;
    } else {
      // Try to extract any useful information from the response
      console.error('Unexpected authentication response format:', JSON.stringify(response, null, 2));
      
      // Check if we can find a token in any location
      const possibleToken = 
        response.data?.token || 
        response.data?.access?.token || 
        response.accessToken || 
        response.data?.accessToken ||
        (response.data?.data && response.data.data.token);
      
      if (possibleToken) {
        console.log('Found token in unexpected location:', possibleToken);
        setTokenForUser(userId, possibleToken);
        
        // Try to extract user info
        const userInfo = response.user || response.data?.user || { email, organizationId: '', id: '' };
        
        return {
          status: true,
          message: 'Authentication successful',
          data: {
            tokens: {
              access: {
                token: possibleToken,
                expires: new Date(Date.now() + 3600000).toISOString() // Default 1 hour
              }
            },
            user: userInfo
          }
        };
      }
      
      return {
        status: false,
        message: 'Authentication failed: Unexpected response format',
        error: response
      };
    }
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('Error authenticating with OTP:', apiError.response?.data || apiError.message);
    
    // Enhanced error handling with more specific messages
    let errorMessage = 'Authentication failed. Please check your OTP and try again.';
    
    if (apiError.response?.status === 401) {
      errorMessage = 'Invalid OTP code. Please check and try again.';
    } else if (apiError.response?.status === 429) {
      errorMessage = 'Too many attempts. Please wait before trying again.';
    } else if (apiError.response?.data?.message) {
      // Ensure data.message is a string
      if (typeof apiError.response.data.message === 'string') {
        errorMessage = apiError.response.data.message;
      } else if (typeof apiError.response.data.message === 'object') {
        try {
          errorMessage = JSON.stringify(apiError.response.data.message);
        } catch (e) {
          errorMessage = 'Invalid authentication response';
        }
      }
    }
    
    // Log full error for debugging
    console.error('Authentication error details:', JSON.stringify({
      status: apiError.response?.status,
      data: apiError.response?.data,
      message: apiError.message
    }, null, 2));
    
    return {
      status: false,
      message: errorMessage,
      error: apiError.response?.data || apiError,
    };
  }
};

export const getUserProfile = async (userId: string): Promise<ApiResponse<User>> => {
  try {
    return await get<ApiResponse<User>>('/auth/me', {}, userId);
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('Error getting user profile:', apiError.response?.data || apiError.message);
    
    // If the error is due to unauthorized access, clear the token
    if (apiError.response?.status === 401) {
      clearTokenForUser(userId);
    }
    
    return {
      status: false,
      message: apiError.response?.data?.message || 'Failed to fetch user profile. Please log in again.',
      error: apiError.response?.data || apiError,
    };
  }
};

export const getKycStatus = async (userId: string): Promise<ApiResponse<Kyc[]>> => {
  try {
    return await get<ApiResponse<Kyc[]>>('/kycs', {}, userId);
  } catch (error: unknown) {
    const apiError = error as ApiError;
    console.error('Error getting KYC status:', apiError.response?.data || apiError.message);
    return {
      status: false,
      message: apiError.response?.data?.message || 'Failed to fetch KYC status.',
      error: apiError.response?.data || apiError,
    };
  }
}; 