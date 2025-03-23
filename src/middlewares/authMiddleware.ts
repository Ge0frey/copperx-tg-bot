import { Context, Middleware } from 'telegraf';
import { isAuthenticated, getSession } from '../utils/sessionManager';
import { getUserProfile } from '../services/authService';

// Middleware to check if user is authenticated
export const requireAuth: Middleware<Context> = async (ctx, next) => {
  const chatId = ctx.chat?.id.toString() || '';
  
  if (!chatId) {
    return await ctx.reply('Unable to identify chat session. Please try again.');
  }
  
  if (!isAuthenticated(chatId)) {
    // User is not authenticated
    await ctx.reply(
      '🔐 You need to log in first.\n\nPlease use /login to authenticate with your Copperx account.'
    );
    return;
  }
  
  // User is authenticated, proceed to next middleware or handler
  return await next();
};

// Middleware to refresh user profile
export const refreshUserProfile: Middleware<Context> = async (ctx, next) => {
  const chatId = ctx.chat?.id.toString() || '';
  
  if (!chatId || !isAuthenticated(chatId)) {
    // Skip if not authenticated
    return await next();
  }
  
  // Try to refresh user profile in the background
  const session = getSession(chatId);
  getUserProfile(chatId)
    .then(response => {
      if (response.status && response.data) {
        // Update session with latest user data
        // This runs in the background, we don't wait for it
      }
    })
    .catch(error => {
      console.error('Error refreshing user profile:', error);
    });
  
  // Always proceed to next middleware
  return await next();
};