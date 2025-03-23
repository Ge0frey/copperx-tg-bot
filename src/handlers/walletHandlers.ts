import { Context } from 'telegraf';
import { 
  getWallets, 
  getWalletBalances, 
  getDefaultWallet, 
  setDefaultWallet 
} from '../services/walletService';
import { BotState } from '../models/types';
import { getSession, setTempData, updateState } from '../utils/sessionManager';

// Handler for /balance command
export const handleBalance = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching wallet balances...`);
  
  // Get wallet balances from API
  const balanceResponse = await getWalletBalances(chatId);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (balanceResponse.status && balanceResponse.data && balanceResponse.data.length > 0) {
    const balances = balanceResponse.data;
    
    // Format balance message
    let balanceMessage = `💰 *Your Wallet Balances*\n\n`;
    
    balances.forEach(balance => {
      balanceMessage += `*${balance.asset}* on ${balance.network}:\n`;
      balanceMessage += `  Total: ${balance.balance.toFixed(6)}\n`;
      balanceMessage += `  Available: ${balance.availableBalance.toFixed(6)}\n\n`;
    });
    
    balanceMessage += `Use /deposit to get deposit address or /send to transfer funds.`;
    
    await ctx.reply(balanceMessage, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(
      `📭 You don't have any wallet balances yet.\n\n` +
      `Use /deposit to get deposit address to add funds to your wallet.`
    );
  }
};

// Handler for /wallets command
export const handleWallets = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching your wallets...`);
  
  // Get wallets from API
  const walletsResponse = await getWallets(chatId);
  const defaultWalletResponse = await getDefaultWallet(chatId);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (walletsResponse.status && walletsResponse.data && walletsResponse.data.length > 0) {
    const wallets = walletsResponse.data;
    let defaultWalletId = '';
    
    if (defaultWalletResponse.status && defaultWalletResponse.data) {
      defaultWalletId = defaultWalletResponse.data.id;
    }
    
    // Store wallets in session for later use with inline keyboards
    setTempData(chatId, 'wallets', wallets);
    
    // Format wallet message
    let walletMessage = `🔐 *Your Wallets*\n\n`;
    
    wallets.forEach(wallet => {
      const isDefault = wallet.id === defaultWalletId ? '✅ (Default)' : '';
      walletMessage += `*${wallet.network}* ${isDefault}\n`;
      walletMessage += `Address: \`${wallet.address}\`\n\n`;
    });
    
    walletMessage += `Use /set_default_wallet to change your default wallet.`;
    
    await ctx.reply(walletMessage, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(
      `📭 You don't have any wallets yet.\n\n` +
      `This is unusual. Please contact Copperx support for assistance.`
    );
  }
};

// Handler for /deposit command
export const handleDeposit = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching deposit information...`);
  
  // Get wallets from API
  const walletsResponse = await getWallets(chatId);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (walletsResponse.status && walletsResponse.data && walletsResponse.data.length > 0) {
    const wallets = walletsResponse.data;
    
    // Format deposit message
    let depositMessage = `📥 *Deposit Information*\n\n`;
    depositMessage += `You can deposit USDC to any of the following addresses:\n\n`;
    
    wallets.forEach(wallet => {
      depositMessage += `*${wallet.network}* Network\n`;
      depositMessage += `Address: \`${wallet.address}\`\n\n`;
    });
    
    depositMessage += `⚠️ *Important Notes*:\n`;
    depositMessage += `- Only send USDC to these addresses\n`;
    depositMessage += `- Ensure you're using the correct network\n`;
    depositMessage += `- You'll receive a notification when deposit is confirmed`;
    
    await ctx.reply(depositMessage, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(
      `❌ Failed to fetch deposit addresses. Please try again later or contact support.`
    );
  }
};

// Handler for /set_default_wallet command
export const handleSetDefaultWallet = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching your wallets...`);
  
  // Get wallets from API
  const walletsResponse = await getWallets(chatId);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (walletsResponse.status && walletsResponse.data && walletsResponse.data.length > 0) {
    const wallets = walletsResponse.data;
    
    // Create inline keyboard with wallet options
    const keyboard = {
      inline_keyboard: wallets.map(wallet => [
        {
          text: `${wallet.network} - ${wallet.address.substring(0, 8)}...`,
          callback_data: `set_default_wallet:${wallet.id}`
        }
      ])
    };
    
    // Store wallets in session for later use
    setTempData(chatId, 'wallets', wallets);
    
    await ctx.reply(
      `Select a wallet to set as default:`,
      { reply_markup: keyboard }
    );
  } else {
    await ctx.reply(
      `❌ Failed to fetch wallets. Please try again later or contact support.`
    );
  }
};

// Handle set default wallet callback
export const handleSetDefaultWalletCallback = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const callbackData = ctx.callbackQuery.data;
  
  // Extract wallet ID from callback data
  const match = callbackData.match(/set_default_wallet:(.+)/);
  
  if (!match) return;
  
  const walletId = match[1];
  
  // Show loading indicator
  await ctx.editMessageText('Setting default wallet...');
  
  // Set default wallet
  const response = await setDefaultWallet(chatId, walletId);
  
  if (response.status && response.data) {
    await ctx.editMessageText(
      `✅ Default wallet set to ${response.data.network} network successfully!`
    );
  } else {
    await ctx.editMessageText(
      `❌ Failed to set default wallet: ${response.message || 'Unknown error'}`
    );
  }
}; 