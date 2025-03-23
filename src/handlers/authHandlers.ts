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
  if (!('text' in ctx.message)) return;
  
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
  await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  
  if (response.status) {
    // Store email in session
    setTempData(chatId, 'email', email);
    
    // Update state to wait for OTP
    updateState(chatId, BotState.AUTH_OTP);
    
    await ctx.reply(
      `✅ Verification code sent to ${email}.\n\n` +
      `Please enter the verification code to complete login.`
    );
  } else {
    await ctx.reply(
      `❌ Failed to send verification code: ${response.message || 'Unknown error'}\n\n` +
      `Please try again or contact support.`
    );
  }
};

// Handler for OTP input
export const handleOtpInput = async (ctx: Context): Promise<void> => {
  if (!('text' in ctx.message)) return;
  
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
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Verifying code...`);
  
  // Authenticate with OTP
  const authResponse = await authenticateWithOtp(email, otp, chatId);
  
  // Clean up loading message
  await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  
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
    if (userData.organizationId) {
      initializePusherClient(
        userData.organizationId, 
        chatId, 
        ctx.telegram, 
        ctx.chat.id
      );
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
    await ctx.reply(
      `❌ Verification failed: ${authResponse.message || 'Invalid code'}\n\n` +
      `Please try again or restart the process with /login.`
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
  await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  
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