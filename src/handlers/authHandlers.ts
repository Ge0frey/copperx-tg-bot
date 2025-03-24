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
  
  await ctx.reply(
    `👋 Welcome to the *Copperx Payment Bot*!\n\n` +
    `This bot allows you to manage your Copperx wallet, make transfers, and monitor your account.\n\n` +
    `Please use /login to authenticate with your Copperx account or /help to see available commands.`,
    { parse_mode: 'Markdown' }
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
  
  await ctx.reply(
    `You have been logged out. Use /login to authenticate again.`
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
    await ctx.reply(
      `Session expired. Please start the login process again with /login.`
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
  
  // Authenticate with OTP
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
    
    await ctx.reply(
      `🎉 Login successful! Welcome ${userData.name || userData.email}!\n\n` +
      `${kycStatusMessage}\n\n` +
      `Use /menu to see available options or /help for commands.`,
      { parse_mode: 'Markdown' }
    );
  } else {
    const errorMsg = authResponse.message || 'Invalid code';
    
    // Give more helpful guidance based on the error
    let helpText = '';
    if (errorMsg.toLowerCase().includes('invalid')) {
      helpText = 'Double-check the code and try again.';
    } else if (errorMsg.toLowerCase().includes('expired')) {
      helpText = 'The code has expired. Please request a new one with /login.';
    } else if (errorMsg.toLowerCase().includes('attempt')) {
      helpText = 'Too many attempts. Please try again later with /login.';
    }
    
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
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching your profile...`);
  
  // Get user profile from API
  const response = await getUserProfile(chatId);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (response.status && response.data) {
    const userData = response.data;
    
    // Fetch KYC status
    const kycResponse = await getKycStatus(chatId);
    let kycStatus = 'Unknown';
    
    if (kycResponse.status && kycResponse.data) {
      const kycs = kycResponse.data;
      const approvedKyc = kycs.find(kyc => kyc.status === 'approved');
      kycStatus = approvedKyc ? 'Approved' : 'Not approved';
    }
    
    await ctx.reply(
      `👤 *User Profile*\n\n` +
      `Email: ${userData.email}\n` +
      `Name: ${userData.name || 'Not set'}\n` +
      `KYC Status: ${kycStatus}\n` +
      `Organization ID: ${userData.organizationId}\n` +
      `Account Type: ${userData.role || 'User'}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(
      `❌ Failed to fetch profile: ${response.message || 'Unknown error'}\n\n` +
      `Please try again or contact support.`
    );
  }
}; 