import { Telegraf, Scenes, session } from 'telegraf';
import { message } from 'telegraf/filters';
import { config, validateEnv } from './config/env';
import { BotState } from './models/types';
import { getState } from './utils/sessionManager';
import { requireAuth, refreshUserProfile } from './middlewares/authMiddleware';
import { disconnectAllPusherClients } from './services/notificationService';

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
  handleSupport
} from './handlers/menuHandlers';

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
  }
});

// Handle text messages based on current state
bot.on(message('text'), async (ctx) => {
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

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('An error occurred while processing your request. Please try again later or contact support.').catch(() => {});
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
        // Set webhook
        await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}/bot${config.botToken}`);
        
        // Start webhook
        // @ts-ignore
        bot.startWebhook(`/bot${config.botToken}`, null, PORT);
        
        console.log(`Bot is running in webhook mode on port ${PORT}`);
      } else {
        // Fallback to long polling if webhook domain is not set
        await bot.launch();
        console.log('Bot is running in long polling mode (production)');
      }
    } else {
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