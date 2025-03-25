import { Telegraf, Scenes, session } from 'telegraf';
import { message } from 'telegraf/filters';
import { config, validateEnv } from './config/env';
import { BotState } from './models/types';
import { getState } from './utils/sessionManager';
import { requireAuth, refreshUserProfile } from './middlewares/authMiddleware';
import { disconnectAllPusherClients } from './services/notificationService';
import express from 'express';

// Import handlers
import {
  handleStart,
  handleLogin,
  handleLogout,
  handleEmailInput,
  handleOtpInput,
  handleProfile
} from './handlers/authHandlers';

import {
  handleBalance,
  handleWallets,
  handleDeposit,
  handleSetDefaultWallet,
  handleSetDefaultWalletCallback
} from './handlers/walletHandlers';

import {
  handleTransferHistory,
  handleSendCommand,
  handleTransferTypeCallback,
  handleEmailTransferFlow,
  handleNetworkCallback,
  handleAmountInput,
  handleMessageInput,
  handleWalletAddressInput,
  handleBankTransferFlow,
  handleTransferConfirmation
} from './handlers/transferHandlers';

import {
  handleMenu,
  handleHelp,
  handleSupport,
  handleMenuCallback,
  handleHelpCallback,
  handleSupportCallback
} from './handlers/menuHandlers';

// Add this interface at the top of the file after the imports
interface ApiError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      message?: string;
    };
  };
  code?: string;
}

// Check if required environment variables are set
if (!validateEnv()) {
  console.error('Missing required environment variables. Exiting...');
  process.exit(1);
}

// Initialize the bot
const bot = new Telegraf(config.botToken);

// Use session middleware
bot.use(session());

// Use refresh profile middleware
bot.use(refreshUserProfile);

// Register command handlers
bot.start(handleStart);
bot.command('menu', handleMenu);
bot.command('help', handleHelp);
bot.command('support', handleSupport);
bot.command('login', handleLogin);
bot.command('logout', handleLogout);

// Auth required commands
bot.command('profile', requireAuth, handleProfile);
bot.command('balance', requireAuth, handleBalance);
bot.command('wallets', requireAuth, handleWallets);
bot.command('deposit', requireAuth, handleDeposit);
bot.command('set_default_wallet', requireAuth, handleSetDefaultWallet);
bot.command('send', requireAuth, handleSendCommand);
bot.command('transfers', requireAuth, handleTransferHistory);

// Handle callback queries
bot.on('callback_query', async (ctx) => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const callbackData = ctx.callbackQuery.data;
  
  // Route callback queries based on prefix
  if (callbackData.startsWith('set_default_wallet:')) {
    await handleSetDefaultWalletCallback(ctx);
  } else if (callbackData.startsWith('transfer:')) {
    await handleTransferTypeCallback(ctx);
  } else if (callbackData.startsWith('network:')) {
    await handleNetworkCallback(ctx);
  } else if (callbackData.startsWith('confirm_') || callbackData === 'cancel_transfer') {
    await handleTransferConfirmation(ctx);
  } else if (callbackData.startsWith('menu:')) {
    await handleMenuCallback(ctx);
  } else if (callbackData.startsWith('help:')) {
    await handleHelpCallback(ctx);
  } else if (callbackData.startsWith('support:')) {
    await handleSupportCallback(ctx);
  } else if (callbackData === 'start:menu') {
    await ctx.answerCbQuery();
    await ctx.reply('/menu');
  }
});

// Handle text messages based on current state
bot.on(message('text'), async (ctx) => {
  if (!ctx.chat) return;
  
  const chatId = ctx.chat.id.toString();
  const state = getState(chatId);
  
  switch (state) {
    case BotState.AUTH_EMAIL:
      await handleEmailInput(ctx);
      break;
      
    case BotState.AUTH_OTP:
      await handleOtpInput(ctx);
      break;
      
    case BotState.TRANSFER_EMAIL:
      await handleEmailTransferFlow(ctx);
      break;
      
    case BotState.TRANSFER_WALLET:
      await handleWalletAddressInput(ctx);
      break;
      
    case BotState.TRANSFER_BANK:
      await handleBankTransferFlow(ctx);
      break;
      
    default:
      // Check for specific message handling states
      await handleAmountInput(ctx);
      await handleMessageInput(ctx);
  }
});

// Update the error handling
bot.catch((err, ctx) => {
  // Enhanced error handling
  let errorMessage = 'An error occurred while processing your request.';
  
  // Cast to ApiError with proper type safety
  const apiError = err as ApiError;
  
  // Log the full error
  console.error(`Error for ${ctx.updateType}:`, apiError);
  console.error('Error stack:', apiError.stack || 'No stack trace available');
  
  // Provide more specific error messages based on error type
  if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT' || apiError.code === 'ENOTFOUND') {
    errorMessage = 'Unable to connect to the API server. Please try again later.';
    console.error('API connection error:', apiError.message);
  } else if (apiError.response && apiError.response.status) {
    // Handle HTTP error codes
    switch (apiError.response.status) {
      case 401:
        errorMessage = 'Authentication error. Please login again with /login.';
        break;
      case 403:
        errorMessage = 'You don\'t have permission to perform this action.';
        break;
      case 429:
        errorMessage = 'Too many requests. Please try again later.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorMessage = 'The server is currently unavailable. Please try again later.';
        break;
      default:
        errorMessage = `Error (${apiError.response.status}): ${apiError.response.data?.message || 'Unknown error'}`;
    }
  } else if (apiError.message && typeof apiError.message === 'string') {
    // Include the error message if it's available and helpful
    const sanitizedMessage = apiError.message
      .replace(/token=\w+/g, 'token=***') // Hide tokens in error messages
      .substring(0, 100); // Limit length for security
    
    if (!sanitizedMessage.includes('sensitive') && !sanitizedMessage.includes('password')) {
      errorMessage += ` Details: ${sanitizedMessage}`;
    }
  }
  
  ctx.reply(
    `❌ ${errorMessage}\n\n` +
    `Please try again later or contact support at https://t.me/copperxcommunity/2183`
  ).catch((replyErr) => {
    // Log if we can't even send the error message
    console.error('Failed to send error message to user:', replyErr);
  });
});

// Start the bot
const startBot = async () => {
  try {
    // Use webhook in production or long polling in development
    if (config.nodeEnv === 'production') {
      // For webhook deployment (e.g. on render.com)
      const PORT = process.env.PORT || 3000;
      const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;
      
      if (WEBHOOK_DOMAIN) {
        // Create an Express app
        const app = express();
        
        // Add the health check endpoint
        app.get('/health', (req, res) => {
          res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        
        // Set webhook with correct path that ends with '/webhook'
        const webhookPath = '/webhook';
        await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${webhookPath}`);
        
        // Use the bot as middleware for the webhook
        app.use(bot.webhookCallback(webhookPath));
        
        // Start the server
        app.listen(PORT, () => {
          console.log(`Bot is running in webhook mode on port ${PORT}`);
          console.log(`Health check available at http://localhost:${PORT}/health`);
        });
      } else {
        // Fallback to long polling if webhook domain is not set
        await bot.launch();
        console.log('Bot is running in long polling mode (production)');
      }
    } else {
      // Create an Express app for development health check
      const app = express();
      const PORT = process.env.PORT || 3000;
      
      // Add the health check endpoint
      app.get('/health', (req, res) => {
        res.status(200).json({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          mode: 'development'
        });
      });
      
      // Start the Express server for health checks in development
      app.listen(PORT, () => {
        console.log(`Health check server running on port ${PORT}`);
      });
      
      // Use long polling in development
      await bot.launch();
      console.log('Bot is running in long polling mode (development)');
    }
    
    // Enable graceful stop
    process.once('SIGINT', () => {
      bot.stop('SIGINT');
      disconnectAllPusherClients();
    });
    process.once('SIGTERM', () => {
      bot.stop('SIGTERM');
      disconnectAllPusherClients();
    });
  } catch (error) {
    console.error('Error starting bot:', error);
  }
};

// Start the bot
startBot(); 