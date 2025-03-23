import { Context } from 'telegraf';
import { isAuthenticated } from '../utils/sessionManager';

// Handler for /menu command
export const handleMenu = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Create different menus for authenticated vs non-authenticated users
  if (isAuthenticated(chatId)) {
    await ctx.reply(
      `🔹 *Copperx Payment Bot Menu* 🔹\n\n` +
      `*Account Commands*\n` +
      `/profile - View your account profile\n` +
      `/logout - Log out of your account\n\n` +
      
      `*Wallet Commands*\n` +
      `/balance - Check your wallet balances\n` +
      `/wallets - View your wallet addresses\n` +
      `/deposit - Get deposit instructions\n` +
      `/set_default_wallet - Set your default wallet\n\n` +
      
      `*Transfer Commands*\n` +
      `/send - Send funds (email, wallet, bank)\n` +
      `/transfers - View your transfer history\n\n` +
      
      `*Help Commands*\n` +
      `/help - Show help information\n` +
      `/support - Get support information`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(
      `🔹 *Copperx Payment Bot Menu* 🔹\n\n` +
      `You are not logged in. Available commands:\n\n` +
      `/login - Log in to your Copperx account\n` +
      `/help - Show help information\n` +
      `/support - Get support information`,
      { parse_mode: 'Markdown' }
    );
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
  
  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
};

// Handler for /support command
export const handleSupport = async (ctx: Context): Promise<void> => {
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
    { parse_mode: 'Markdown' }
  );
}; 