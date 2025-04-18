import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { 
  BotState, 
  UserSession 
} from '../models/types';
import { 
  updateState, 
  getState, 
  setSession, 
  getSession, 
  clearSession,
  setTempData, 
  getTempData 
} from '../utils/sessionManager';
import { 
  requestEmailOtp, 
  authenticateWithOtp, 
  getUserProfile,
  getKycStatus 
} from '../services/authService';
import { initializePusherClient } from '../services/notificationService';

// Handler for /start command
export const handleStart = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Reset state
  updateState(chatId, BotState.START);
  
  // Create inline keyboard with main actions
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔑 Login', callback_data: 'menu:login' }],
      [{ text: '📋 Menu', callback_data: 'start:menu' }],
      [{ text: '❓ Help', callback_data: 'menu:help' }]
    ]
  };
  
  await ctx.reply(
    `👋 *Welcome to the Copperx Payment Bot!*\n\n` +
    `This bot allows you to manage your Copperx wallet, make transfers, and monitor your account.\n\n` +
    `Please login to access all features, or browse the menu to learn more.`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
};

// Handler for /login command
export const handleLogin = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Update state to begin login flow
  updateState(chatId, BotState.AUTH_EMAIL);
  
  await ctx.reply(
    `Please enter your email address to receive a one-time verification code.`
  );
};

// Handler for /logout command
export const handleLogout = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Clear session data
  clearSession(chatId);
  
  // Create keyboard with login button
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔑 Login Again', callback_data: 'menu:login' }]
    ]
  };
  
  await ctx.reply(
    `You have been logged out successfully.`,
    { reply_markup: keyboard }
  );
};

// Handler for email input
export const handleEmailInput = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const email = ctx.message.text.trim();
  
  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    await ctx.reply(
      `Invalid email format. Please enter a valid email address.`
    );
    return;
  }
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Requesting verification code...`);
  
  // Request OTP from API
  const response = await requestEmailOtp(email);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (response.status) {
    // Store email in session
    setTempData(chatId, 'email', email);
    
    // Store sid if available
    if (response.data && response.data.sid) {
      console.log('Found sid in response:', response.data.sid);
      setTempData(chatId, 'sid', response.data.sid);
    }
    
    // Update state to wait for OTP
    updateState(chatId, BotState.AUTH_OTP);
    
    await ctx.reply(
      `✅ Verification code sent to ${email}.\n\n` +
      `Please enter the verification code to complete login.\n\n` +
      `(Check your spam folder if you don't see it in your inbox)`
    );
  } else {
    // Log the full error for debugging
    console.error('OTP request error:', response);
    
    // Get a more specific error message if available
    let errorMsg = response.message || 'Unknown error';
    
    // Additional specific error handling
    if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
      errorMsg = 'Too many attempts. Please wait before trying again.';
    } else if (errorMsg.includes('not found') || errorMsg.includes('doesn\'t exist')) {
      errorMsg = 'Email not registered. Please check your email or register first.';
    }
    
    await ctx.reply(
      `❌ Failed to send verification code: ${errorMsg}\n\n` +
      `Please try again or contact support at https://t.me/copperxcommunity/2183`
    );
  }
};

// Handler for OTP input
export const handleOtpInput = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const otp = ctx.message.text.trim();
  
  // Get email from session
  const email = getTempData(chatId, 'email');
  
  if (!email) {
    // Create login button
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔑 Login', callback_data: 'menu:login' }]
      ]
    };
    
    await ctx.reply(
      `Session expired. Please start the login process again.`,
      { reply_markup: keyboard }
    );
    return;
  }
  
  // Basic OTP validation (should be numeric and a reasonable length)
  if (!/^\d{4,8}$/.test(otp)) {
    await ctx.reply(
      `The verification code should be a 4-8 digit number. Please check and try again.`
    );
    return;
  }
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Verifying code...`);
  
  // Authenticate with OTP - no session ID
  const authResponse = await authenticateWithOtp(email, otp, chatId);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (authResponse.status && authResponse.data) {
    // Update session with user data
    const userData = authResponse.data.user;
    setSession(chatId, {
      email: userData.email,
      organizationId: userData.organizationId,
      authenticated: true,
      currentState: BotState.MAIN_MENU,
    });
    
    // Fetch user profile for more details
    const profileResponse = await getUserProfile(chatId);
    
    // Setup Pusher for notifications
    if (userData.organizationId && ctx.chat) {
      initializePusherClient(
        userData.organizationId, 
        chatId, 
        ctx.telegram, 
        ctx.chat.id
      ).then(client => {
        if (client) {
          console.log('Pusher client initialized successfully');
        } else {
          console.error('Failed to initialize Pusher client');
        }
      }).catch(err => {
        console.error('Error initializing Pusher:', err);
      });
    }
    
    // Check KYC status
    const kycResponse = await getKycStatus(chatId);
    let kycStatusMessage = '';
    
    if (kycResponse.status && kycResponse.data) {
      const kycs = kycResponse.data;
      const approvedKyc = kycs.find(kyc => kyc.status === 'approved');
      
      if (approvedKyc) {
        kycStatusMessage = `✅ KYC Status: Approved`;
      } else {
        kycStatusMessage = `⚠️ KYC Status: Not approved - Some features may be limited`;
      }
    }
    
    // Create keyboard with menu and help buttons
    const keyboard = {
      inline_keyboard: [
        [{ text: '📋 View Menu', callback_data: 'menu:menu' }],
        [{ text: '❓ Help', callback_data: 'menu:help' }]
      ]
    };
    
    await ctx.reply(
      `🎉 Login successful! Welcome ${userData.name || userData.email}!\n\n` +
      `${kycStatusMessage}`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  } else {
    // More robust error message extraction
    let errorMsg = 'Invalid code';
    if (authResponse.message) {
      if (typeof authResponse.message === 'string') {
        // Check if the message is a JSON array string (likely validation errors)
        if (authResponse.message.startsWith('[') && authResponse.message.endsWith(']')) {
          try {
            const validationErrors = JSON.parse(authResponse.message);
            if (Array.isArray(validationErrors) && validationErrors.length > 0) {
              // Format validation errors in a user-friendly way
              errorMsg = formatValidationErrors(validationErrors);
            }
          } catch (e) {
            // If parsing fails, use the original message
            errorMsg = authResponse.message;
          }
        } else {
          errorMsg = authResponse.message;
        }
      } else if (typeof authResponse.message === 'object' && authResponse.message !== null) {
        // Try to extract a message from the error object
        const messageObj = authResponse.message as any;
        if (messageObj.message) {
          errorMsg = messageObj.message;
        } else if (Array.isArray(messageObj) && messageObj.length > 0) {
          // Handle array of validation errors
          errorMsg = formatValidationErrors(messageObj);
        } else {
          // Try to stringify the object for debugging
          try {
            const stringified = JSON.stringify(authResponse.message);
            // Check if it's a validation error array
            if (stringified.startsWith('[{') && stringified.includes('constraints')) {
              try {
                const validationErrors = JSON.parse(stringified);
                errorMsg = formatValidationErrors(validationErrors);
              } catch {
                errorMsg = stringified;
              }
            } else {
              errorMsg = stringified;
            }
          } catch (e) {
            errorMsg = 'Authentication failed';
          }
        }
      }
    } else if (authResponse.error) {
      // Try to extract message from error field
      if (typeof authResponse.error === 'string') {
        errorMsg = authResponse.error;
      } else if (typeof authResponse.error === 'object' && authResponse.error !== null) {
        const errorObj = authResponse.error as any;
        if (errorObj.message) {
          errorMsg = errorObj.message;
        } else if (Array.isArray(errorObj) && errorObj.length > 0) {
          // Handle array of validation errors
          errorMsg = formatValidationErrors(errorObj);
        } else {
          try {
            const stringified = JSON.stringify(authResponse.error);
            // Check if it's a validation error array
            if (stringified.startsWith('[{') && stringified.includes('constraints')) {
              try {
                const validationErrors = JSON.parse(stringified);
                errorMsg = formatValidationErrors(validationErrors);
              } catch {
                errorMsg = stringified;
              }
            } else {
              errorMsg = stringified;
            }
          } catch (e) {
            errorMsg = 'Authentication failed';
          }
        }
      }
    }
    
    // Give more helpful guidance based on the error
    let helpText = '';
    if (typeof errorMsg === 'string') {
      const lowerErrorMsg = errorMsg.toLowerCase();
      if (lowerErrorMsg.includes('invalid')) {
        helpText = 'Double-check the code and try again.';
      } else if (lowerErrorMsg.includes('expired')) {
        helpText = 'The code has expired. Please request a new one with /login.';
      } else if (lowerErrorMsg.includes('attempt')) {
        helpText = 'Too many attempts. Please try again later with /login.';
      }
    }
    
    // Log the full error for debugging
    console.error('OTP Authentication error:', JSON.stringify(authResponse, null, 2));
    
    await ctx.reply(
      `❌ Verification failed: ${errorMsg}\n\n` +
      `${helpText}\n` +
      `Use /login to restart the process if needed.`
    );
  }
};

// Handler for /profile command
export const handleProfile = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Check if user is logged in
  const session = getSession(chatId);
  if (!session || !session.authenticated) {
    await ctx.reply(
      `❌ You need to be logged in to view your profile.\n\n` +
      `Please use /login to authenticate with your Copperx account.`
    );
    return;
  }
  
  console.log('[Handler] Profile request for chat ID:', chatId);
  console.log('[Handler] Session data:', JSON.stringify(session, null, 2));
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching your profile...`);
  
  try {
    // Get user profile from API
    const response = await getUserProfile(chatId);
    
    // Log the full response for debugging
    console.log('[Handler] Profile response:', JSON.stringify(response, null, 2));
    
    // Clean up loading message
    if (ctx.chat) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
    }
    
    if (response.status && response.data) {
      const userData = response.data;
      
      // Add key existence checks for debugging
      console.log('[Handler] User data keys:', Object.keys(userData));
      console.log('[Handler] Email exists:', !!userData.email);
      console.log('[Handler] Name exists:', !!userData.name);
      console.log('[Handler] OrganizationId exists:', !!userData.organizationId);
      console.log('[Handler] Role exists:', !!userData.role);
      
      // Fetch KYC status
      const kycResponse = await getKycStatus(chatId);
      let kycStatus = 'Unknown';
      
      if (kycResponse.status && kycResponse.data) {
        const kycs = kycResponse.data;
        const approvedKyc = kycs.find(kyc => kyc.status === 'approved');
        kycStatus = approvedKyc ? 'Approved ✅' : 'Not approved ❌';
      }
      
      const profileMessage = `👤 *Profile Information*\n\n` +
      `Name: ${userData.name || 'Not provided'}\n` +
      `Email: ${userData.email || 'Not provided'}\n` +
      `Organization ID: ${userData.organizationId || 'Not provided'}\n` +
      `KYC Status: ${kycStatus}\n` +
      `Role: ${userData.role || 'User'}`;
      
      // Create a button to go back to menu
      const keyboard = {
        inline_keyboard: [
          [{ text: '🔙 Back to Menu', callback_data: 'menu:menu' }]
        ]
      };
      
      await ctx.reply(profileMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    await ctx.reply(
      `❌ An error occurred while fetching your profile. Please try again later.`
    );
  }
};

// Helper function to format validation errors
const formatValidationErrors = (errors: any[]): string => {
  if (!Array.isArray(errors) || errors.length === 0) {
    return 'Validation error';
  }

  // Try different validation error formats
  if (typeof errors[0] === 'string') {
    return errors[0];
  }

  if (errors[0].message) {
    return errors[0].message;
  }

  if (errors[0].constraints) {
    // Get the first constraint message
    const constraints = errors[0].constraints;
    return Object.values(constraints)[0] as string;
  }

  // Fallback to generic message
  return 'Invalid input provided';
};
