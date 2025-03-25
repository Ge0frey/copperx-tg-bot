import { Context } from 'telegraf';
import { isAuthenticated } from '../utils/sessionManager';

// Handler for /menu command
export const handleMenu = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Create different menus for authenticated vs non-authenticated users
  if (isAuthenticated(chatId)) {
    // Create inline keyboard with categorized buttons
    const keyboard = {
      inline_keyboard: [
        // Account Management section
        [{ text: '👤 My Profile', callback_data: 'menu:profile' }],
        [{ text: '🔑 Logout', callback_data: 'menu:logout' }],
        
        // Wallet Management section
        [{ text: '💰 Check Balance', callback_data: 'menu:balance' }],
        [{ text: '🏦 My Wallets', callback_data: 'menu:wallets' }],
        [{ text: '📥 Deposit', callback_data: 'menu:deposit' }],
        [{ text: '⚙️ Set Default Wallet', callback_data: 'menu:set_default_wallet' }],
        
        // Transfer section
        [{ text: '💸 Send Funds', callback_data: 'menu:send' }],
        [{ text: '📋 Transfer History', callback_data: 'menu:transfers' }],
        
        // Help section
        [{ text: '❓ Help', callback_data: 'menu:help' }],
        [{ text: '📞 Support', callback_data: 'menu:support' }]
      ]
    };
    
    await ctx.reply(
      `🔹 *Copperx Payment Bot Menu* 🔹\n\n` +
      `Welcome to your Copperx Payment Bot dashboard! Please select an option below:`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  } else {
    // Create inline keyboard for non-authenticated users
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔑 Login', callback_data: 'menu:login' }],
        [{ text: '❓ Help', callback_data: 'menu:help' }],
        [{ text: '📞 Support', callback_data: 'menu:support' }]
      ]
    };
    
    await ctx.reply(
      `🔹 *Copperx Payment Bot Menu* 🔹\n\n` +
      `You are not logged in. Please select an option below:`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }
};

// Handler for menu callback queries
export const handleMenuCallback = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const callbackData = ctx.callbackQuery.data;
  
  // Extract action from callback data
  const match = callbackData.match(/menu:(.+)/);
  if (!match) return;
  
  const action = match[1];
  
  // Handle different menu actions
  switch (action) {
    case 'profile':
      // First acknowledge the callback
      await ctx.answerCbQuery();
      // Then send the command to trigger the handler
      await ctx.reply('/profile');
      break;
      
    case 'logout':
      await ctx.answerCbQuery();
      await ctx.reply('/logout');
      break;
      
    case 'balance':
      await ctx.answerCbQuery();
      await ctx.reply('/balance');
      break;
      
    case 'wallets':
      await ctx.answerCbQuery();
      await ctx.reply('/wallets');
      break;
      
    case 'deposit':
      await ctx.answerCbQuery();
      await ctx.reply('/deposit');
      break;
      
    case 'set_default_wallet':
      await ctx.answerCbQuery();
      await ctx.reply('/set_default_wallet');
      break;
      
    case 'send':
      await ctx.answerCbQuery();
      await ctx.reply('/send');
      break;
      
    case 'transfers':
      await ctx.answerCbQuery();
      await ctx.reply('/transfers');
      break;
      
    case 'login':
      await ctx.answerCbQuery();
      await ctx.reply('/login');
      break;
      
    case 'help':
      await ctx.answerCbQuery();
      await ctx.reply('/help');
      break;
      
    case 'support':
      await ctx.answerCbQuery();
      await ctx.reply('/support');
      break;
      
    case 'menu':
      await ctx.answerCbQuery();
      await ctx.reply('/menu');
      break;
      
    default:
      await ctx.answerCbQuery('Unknown option');
      break;
  }
};

// Handler for /help command
export const handleHelp = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Base help message for all users
  let helpMessage = `📚 *Copperx Payment Bot Help* 📚\n\n` +
    `This bot allows you to interact with your Copperx account directly through Telegram.\n\n`;
  
  // Add authenticated commands if user is logged in
  if (isAuthenticated(chatId)) {
    helpMessage += `*Available Commands*\n\n` +
      
      `*Account Management*\n` +
      `/login - Log in to your Copperx account\n` +
      `/profile - View your account profile\n` +
      `/logout - Log out of your account\n\n` +
      
      `*Wallet Management*\n` +
      `/balance - Check your wallet balances\n` +
      `/wallets - View your wallet addresses\n` +
      `/deposit - Get deposit instructions\n` +
      `/set_default_wallet - Set your default wallet\n\n` +
      
      `*Fund Transfers*\n` +
      `/send - Send funds to email, wallet, or bank\n` +
      `/transfers - View your transfer history\n\n`;
  } else {
    helpMessage += `*Getting Started*\n` +
      `Use /login to authenticate with your Copperx account.\n` +
      `After logging in, you'll have access to all features of the bot.\n\n`;
  }
  
  // General help for all users
  helpMessage += `*Need More Help?*\n` +
    `Use /support to get information about contacting Copperx support.\n\n` +
    `*Useful Tips*\n` +
    `- Keep your account secure by logging out when not in use\n` +
    `- Double-check all transaction details before confirming\n` +
    `- For depositing, make sure to use the correct network`;
  
  // Add back to menu button
  const keyboard = {
    inline_keyboard: [
      [{ text: '🔙 Back to Menu', callback_data: 'help:back_to_menu' }]
    ]
  };
  
  await ctx.reply(helpMessage, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// Handler for help callback queries
export const handleHelpCallback = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const callbackData = ctx.callbackQuery.data;
  
  if (callbackData === 'help:back_to_menu') {
    await ctx.answerCbQuery();
    await ctx.reply('/menu');
  }
};

// Handler for /support command
export const handleSupport = async (ctx: Context): Promise<void> => {
  // Create a nice support message with inline keyboard
  const keyboard = {
    inline_keyboard: [
      [{ text: '💬 Join Telegram Group', url: 'https://t.me/copperxcommunity/2183' }],
      [{ text: '🌐 Visit Website', url: 'https://copperx.io' }],
      [{ text: '🔙 Back to Menu', callback_data: 'support:back_to_menu' }]
    ]
  };
  
  await ctx.reply(
    `📞 *Copperx Support* 📞\n\n` +
    `If you need assistance with your Copperx account or this bot, please contact us through one of the following channels:\n\n` +
    `*Community Support*\n` +
    `Join our Telegram group: https://t.me/copperxcommunity/2183\n\n` +
    `*Email Support*\n` +
    `For account-specific issues: support@copperx.io\n\n` +
    `*Website*\n` +
    `Visit: https://copperx.io\n\n` +
    `A support representative will assist you as soon as possible.`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
};

// Handler for support callback queries
export const handleSupportCallback = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const callbackData = ctx.callbackQuery.data;
  
  if (callbackData === 'support:back_to_menu') {
    await ctx.answerCbQuery();
    await ctx.reply('/menu');
  }
}; 