import { post, get, setTokenForUser, clearTokenForUser, setRefreshTokenForUser, setTokenExpiryForUser, getTokenForUser } from '../utils/api';
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
    console.log(`[Profile] Fetching profile for user ID: ${userId}`);
    
    // Check if we have a token for this user
    const token = getTokenForUser(userId);
    if (!token) {
      console.error(`[Profile] No auth token found for user ${userId}`);
      return {
        status: false,
        message: 'You are not logged in. Please use /login to authenticate.',
        error: null
      };
    }
    
    // Try with different endpoint paths commonly used for profile
    try {
      console.log('[Profile] Attempting to fetch profile with /auth/me endpoint');
      const response = await get<any>('/auth/me', {}, userId);
      
      // Debug log the complete response
      console.log(`[Profile] Raw API response from /auth/me:`, JSON.stringify(response, null, 2));
      
      // Process the response (rest of the code remains the same)
      return processProfileResponse(response, userId);
    } catch (error) {
      console.log('[Profile] Error with /auth/me endpoint, trying /users/me', error);
      
      try {
        // Some APIs use /users/me instead
        const response = await get<any>('/users/me', {}, userId);
        console.log(`[Profile] Raw API response from /users/me:`, JSON.stringify(response, null, 2));
        return processProfileResponse(response, userId);
      } catch (usersError) {
        console.log('[Profile] Error with /users/me endpoint, trying /user/profile', usersError);
        
        try {
          // Another common endpoint
          const response = await get<any>('/user/profile', {}, userId);
          console.log(`[Profile] Raw API response from /user/profile:`, JSON.stringify(response, null, 2));
          return processProfileResponse(response, userId);
        } catch (profileError) {
          console.log('[Profile] Error with /user/profile endpoint, trying /me', profileError);
          
          try {
            // Simple /me endpoint
            const response = await get<any>('/me', {}, userId);
            console.log(`[Profile] Raw API response from /me:`, JSON.stringify(response, null, 2));
            return processProfileResponse(response, userId);
          } catch (meError) {
            // If all attempts fail, throw the original error
            console.error('[Profile] All profile endpoint attempts failed');
            throw error;
          }
        }
      }
    }
  } catch (error: unknown) {
    const apiError = error as ApiError;
    
    // Enhanced error logging
    console.error('[Profile] Error getting user profile:');
    console.error('Status:', apiError.response?.status);
    console.error('Status Text:', apiError.response?.statusText);
    console.error('Data:', JSON.stringify(apiError.response?.data, null, 2));
    console.error('Message:', apiError.message);
    console.error('Code:', apiError.code);
    
    // If the error is due to unauthorized access, clear the token
    if (apiError.response?.status === 401) {
      console.log(`[Profile] Clearing token for user ${userId} due to 401 unauthorized`);
      clearTokenForUser(userId);
      
      return {
        status: false,
        message: 'Your session has expired. Please log in again with /login',
        error: apiError.response?.data || apiError,
      };
    }
    
    // Create a more descriptive error message based on the error type
    let errorMessage = 'Failed to fetch user profile.';
    
    if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ENOTFOUND') {
      errorMessage = 'Could not connect to the server. Please try again later.';
    } else if (apiError.response?.status === 404) {
      errorMessage = 'Profile data not found. Your account might not be set up correctly.';
    } else if (apiError.response?.status === 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (apiError.response?.data?.message) {
      errorMessage = apiError.response.data.message;
    } else if (apiError.message) {
      errorMessage = apiError.message;
    }
    
    return {
      status: false,
      message: errorMessage,
      error: apiError.response?.data || apiError,
    };
  }
};

// Helper function to process profile response data
function processProfileResponse(response: any, userId: string): ApiResponse<User> {
  // Try to extract user data from the response
  // The Copperx API might return the user data in different formats
  
  let userData = null;
  
  // Case 1: Check if response itself is the user data
  if (response && response.email && (response.id || response._id)) {
    console.log('[Profile] Found user data directly in response');
    userData = response;
  } 
  // Case 2: Check if data property contains user data
  else if (response?.data && response.data.email && (response.data.id || response.data._id)) {
    console.log('[Profile] Found user data in response.data');
    userData = response.data;
  }
  // Case 3: Check if user property contains user data
  else if (response?.user && response.user.email && (response.user.id || response.user._id)) {
    console.log('[Profile] Found user data in response.user');
    userData = response.user;
  }
  // Case 4: Check if it's in a data.user nested structure
  else if (response?.data?.user && response.data.user.email && (response.data.user.id || response.data.user._id)) {
    console.log('[Profile] Found user data in response.data.user');
    userData = response.data.user;
  }
  // Case 5: Response might have { data: { data: { user data } } } structure
  else if (response?.data?.data && response.data.data.email && (response.data.data.id || response.data.data._id)) {
    console.log('[Profile] Found user data in response.data.data');
    userData = response.data.data;
  }
  
  // Log extracted user data for debugging
  if (userData) {
    console.log('[Profile] Extracted user data:', {
      id: userData.id || userData._id,
      email: userData.email,
      name: userData.name || 'Not available',
      organizationId: userData.organizationId || userData.organization || userData.organizationID
    });
    
    // Normalize the user data to ensure it has expected fields
    // Convert various id/organization fields to standard format
    const normalizedUser = {
      id: userData.id || userData._id || '',
      email: userData.email || '',
      name: userData.name || '',
      role: userData.role || userData.userType || 'User',
      isEmailVerified: userData.isEmailVerified || userData.emailVerified || true,
      organizationId: userData.organizationId || userData.organization || userData.organizationID || ''
    };
    
    return {
      status: true,
      message: 'Profile fetched successfully',
      data: normalizedUser
    };
  }
  
  // If we couldn't extract user data in a way we understand, log this unexpected format
  console.error(`[Profile] Unable to extract user data from API response:`, JSON.stringify(response, null, 2));
  
  // As a last resort, try to create a user object from whatever we can find
  const fallbackUser = extractFallbackUserData(response);
  if (fallbackUser && fallbackUser.email) {
    console.log('[Profile] Using fallback user data extraction');
    return {
      status: true,
      message: 'Profile fetched with limited information',
      data: fallbackUser
    };
  }
  
  return {
    status: false,
    message: 'The server returned an unexpected response format',
    error: response
  };
}

// Helper function to try extract user data from any response structure
function extractFallbackUserData(response: any): User | null {
  try {
    console.log('[Profile] Starting fallback data extraction');
    
    // Try to extract directly from common patterns first
    if (typeof response === 'object') {
      // Check for common patterns at top level
      // Pattern: { data: { user properties } }
      if (response.data && typeof response.data === 'object' && response.data.email) {
        console.log('[Profile] Found user data in response.data');
        return createUserFromObject(response.data);
      }
      
      // Pattern: { user: { user properties } }
      if (response.user && typeof response.user === 'object' && response.user.email) {
        console.log('[Profile] Found user data in response.user');
        return createUserFromObject(response.user);
      }
      
      // Pattern: { data: { user: { user properties } } }
      if (response.data?.user && typeof response.data.user === 'object' && response.data.user.email) {
        console.log('[Profile] Found user data in response.data.user');
        return createUserFromObject(response.data.user);
      }
      
      // Pattern: { result: { user properties } }
      if (response.result && typeof response.result === 'object' && response.result.email) {
        console.log('[Profile] Found user data in response.result');
        return createUserFromObject(response.result);
      }
      
      // Direct check if response has email (might be the user object itself)
      if (response.email) {
        console.log('[Profile] Response itself appears to be user data');
        return createUserFromObject(response);
      }
    }
    
    // If we haven't found data in common patterns, search recursively
    console.log('[Profile] Using recursive search for user data');
    
    // Search recursively through the response for likely email and id fields
    const email = findValueByKey(response, 'email');
    if (!email) {
      console.log('[Profile] No email found in response, cannot create user data');
      return null;
    }
    
    const id = findValueByKey(response, 'id') || 
               findValueByKey(response, '_id') || 
               findValueByKey(response, 'userId');
               
    const name = findValueByKey(response, 'name') || 
                findValueByKey(response, 'userName') || 
                findValueByKey(response, 'fullName');
                
    const organizationId = findValueByKey(response, 'organizationId') || 
                          findValueByKey(response, 'organization') || 
                          findValueByKey(response, 'organizationID') ||
                          findValueByKey(response, 'orgId');
                          
    const role = findValueByKey(response, 'role') || 
                findValueByKey(response, 'userType') ||
                findValueByKey(response, 'userRole');
    
    console.log('[Profile] Extracted fields via recursive search:', {
      email, id, name, organizationId, role
    });
    
    // Create a user object from the found fields
    return {
      id: id || '',
      email: email,
      name: name || '',
      role: role || 'User',
      isEmailVerified: true,
      organizationId: organizationId || ''
    };
  } catch (e) {
    console.error('[Profile] Error in fallback user data extraction:', e);
    return null;
  }
}

// Helper function to create a standardized user object from any object with user-like properties
function createUserFromObject(obj: any): User {
  return {
    id: obj.id || obj._id || obj.userId || '',
    email: obj.email || '',
    name: obj.name || obj.userName || obj.fullName || '',
    role: obj.role || obj.userType || obj.userRole || 'User',
    isEmailVerified: obj.isEmailVerified || obj.emailVerified || true,
    organizationId: obj.organizationId || obj.organization || obj.organizationID || obj.orgId || ''
  };
}

// Helper function to search deeply through an object for a specific key
function findValueByKey(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  
  if (obj[key] !== undefined) return obj[key];
  
  for (const k in obj) {
    if (typeof obj[k] === 'object') {
      const value = findValueByKey(obj[k], key);
      if (value !== undefined) return value;
    }
  }
  
  return undefined;
}

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