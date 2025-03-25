import { Context } from 'telegraf';
import { 
  getTransferHistory, 
  sendEmailTransfer, 
  sendWalletTransfer, 
  sendBankTransfer 
} from '../services/transferService';
import { getWalletBalances, getWallets } from '../services/walletService';
import { 
  BotState, 
  EmailTransferRequest, 
  WalletTransferRequest, 
  BankTransferRequest 
} from '../models/types';
import { 
  updateState, 
  getState, 
  setTempData, 
  getTempData, 
  clearTempData 
} from '../utils/sessionManager';
import { handleMenu } from './menuHandlers';

// Handler for /transfers command to view history
export const handleTransferHistory = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Show loading indicator
  const loadingMessage = await ctx.reply(`Fetching your transfer history...`);
  
  // Get transfer history from API
  const response = await getTransferHistory(chatId, 1, 10);
  
  // Clean up loading message
  if (ctx.chat) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id).catch(() => {});
  }
  
  if (response.status && response.data && response.data.data.length > 0) {
    const transfers = response.data.data;
    
    // Format transfer history message
    let historyMessage = `📜 *Recent Transfers*\n\n`;
    
    transfers.forEach((transfer, index) => {
      historyMessage += `*${index + 1}. ${transfer.type.toUpperCase()}*\n`;
      historyMessage += `Amount: ${transfer.amount} ${transfer.asset}\n`;
      historyMessage += `Status: ${transfer.status}\n`;
      
      if (transfer.toEmail) {
        historyMessage += `To: ${transfer.toEmail}\n`;
      } else if (transfer.toAddress) {
        historyMessage += `To: ${transfer.toAddress.substring(0, 8)}...\n`;
      }
      
      historyMessage += `Date: ${new Date(transfer.createdAt).toLocaleString()}\n\n`;
    });
    
    await ctx.reply(historyMessage, { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(
      `📭 You don't have any transfer history yet.\n\n` +
      `Use /send to make your first transfer.`
    );
  }
};

// Handler for /send command - shows transfer options
export const handleSendCommand = async (ctx: Context): Promise<void> => {
  const chatId = ctx.chat?.id.toString() || '';
  
  // Update state
  updateState(chatId, BotState.TRANSFER_MENU);
  
  // Create inline keyboard with transfer options - improved layout
  const keyboard = {
    inline_keyboard: [
      // First row with two options
      [
        { text: '📧 Send to Email', callback_data: 'transfer:email' },
        { text: '🔐 Send to Wallet', callback_data: 'transfer:wallet' }
      ],
      // Second row with bank option
      [{ text: '🏦 Withdraw to Bank', callback_data: 'transfer:bank' }],
      // Third row with back and cancel
      [
        { text: '🔙 Back to Menu', callback_data: 'menu:menu' },
        { text: '❌ Cancel', callback_data: 'transfer:cancel' }
      ]
    ]
  };
  
  await ctx.reply(
    `💸 *Transfer Options*\n\n` +
    `Choose how you'd like to transfer your funds:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
};

// Handle transfer type selection
export const handleTransferTypeCallback = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const callbackData = ctx.callbackQuery.data;
  
  // Check if it's a menu callback
  if (callbackData === 'menu:menu') {
    await ctx.answerCbQuery();
    await handleMenu(ctx);
    return;
  }
  
  // Extract transfer type from callback data
  const match = callbackData.match(/transfer:(.+)/);
  if (!match) return;
  
  const transferType = match[1];
  
  // Handle different transfer types
  switch (transferType) {
    case 'email':
      await ctx.editMessageText(
        `📧 *Send to Email*\n\n` +
        `Please enter the recipient's email address:`,
        { parse_mode: 'Markdown' }
      );
      updateState(chatId, BotState.TRANSFER_EMAIL);
      break;
      
    case 'wallet':
      await ctx.editMessageText(
        `🔐 *Send to Wallet*\n\n` +
        `Please enter the recipient's wallet address:`,
        { parse_mode: 'Markdown' }
      );
      updateState(chatId, BotState.TRANSFER_WALLET);
      break;
      
    case 'bank':
      await ctx.editMessageText(
        `🏦 *Withdraw to Bank*\n\n` +
        `To withdraw to your bank account, please provide:\n` +
        `1. Your full name\n` +
        `2. Account number\n` +
        `3. Routing number\n` +
        `4. Bank name\n\n` +
        `Enter your full name first:`,
        { parse_mode: 'Markdown' }
      );
      updateState(chatId, BotState.TRANSFER_BANK);
      break;
      
    case 'cancel':
      await ctx.editMessageText(
        `✅ Transfer cancelled. Returning to main menu.`
      );
      updateState(chatId, BotState.MAIN_MENU);
      clearTempData(chatId);
      await handleMenu(ctx);
      break;
      
    default:
      await ctx.editMessageText(
        `❌ Invalid option. Please try again with /send.`
      );
      updateState(chatId, BotState.MAIN_MENU);
  }
};

// Handle email transfer flow
export const handleEmailTransferFlow = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const state = getState(chatId);
  const text = ctx.message.text.trim();
  
  switch (state) {
    case BotState.TRANSFER_EMAIL:
      // Process email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(text)) {
        await ctx.reply(
          `❌ Invalid email format. Please enter a valid email address.`
        );
        return;
      }
      
      // Store email in session
      setTempData(chatId, 'transferEmail', text);
      
      // Show balance and ask for amount
      const balanceResponse = await getWalletBalances(chatId);
      
      if (balanceResponse.status && balanceResponse.data && balanceResponse.data.length > 0) {
        let balanceMessage = `Your available balances:\n\n`;
        
        balanceResponse.data.forEach(balance => {
          balanceMessage += `${balance.availableBalance.toFixed(6)} ${balance.asset} on ${balance.network}\n`;
        });
        
        // Get network options
        const networks = balanceResponse.data.map(b => b.network);
        
        // Store networks in session
        setTempData(chatId, 'availableNetworks', networks);
        
        // Create network selection keyboard
        const keyboard = {
          inline_keyboard: networks.map(network => [
            { text: network, callback_data: `network:${network}` }
          ])
        };
        
        await ctx.reply(
          `${balanceMessage}\n\nSelect the network you want to use:`,
          { reply_markup: keyboard }
        );
      } else {
        await ctx.reply(
          `❌ You don't have any available balance. Please deposit funds first.`
        );
        updateState(chatId, BotState.MAIN_MENU);
      }
      break;
      
    default:
      // If we receive a message in the wrong state, ignore
      break;
  }
};

// Handle network selection for transfers
export const handleNetworkCallback = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const callbackData = ctx.callbackQuery.data;
  
  // Extract network from callback data
  const match = callbackData.match(/network:(.+)/);
  if (!match) return;
  
  const network = match[1];
  
  // Store network in session
  setTempData(chatId, 'transferNetwork', network);
  
  // Ask for amount
  await ctx.editMessageText(
    `Selected network: ${network}\n\n` +
    `Please enter the amount of USDC to send:`
  );
  
  // Set temporary state for amount input
  setTempData(chatId, 'awaitingAmount', true);
};

// Handle amount input for transfers
export const handleAmountInput = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const isAwaitingAmount = getTempData(chatId, 'awaitingAmount');
  
  if (!isAwaitingAmount) return;
  
  const text = ctx.message.text.trim();
  const amount = parseFloat(text);
  
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(`❌ Please enter a valid amount greater than 0.`);
    return;
  }
  
  // Get state to determine the transfer type
  const state = getState(chatId);
  
  // Store amount in session
  setTempData(chatId, 'transferAmount', amount);
  setTempData(chatId, 'awaitingAmount', false);
  
  // Get transfer data from session
  const email = getTempData(chatId, 'transferEmail');
  const walletAddress = getTempData(chatId, 'transferWalletAddress');
  const network = getTempData(chatId, 'transferNetwork');
  
  // Process based on transfer type
  if (state === BotState.TRANSFER_EMAIL && email) {
    // Optional message for email transfer
    await ctx.reply(
      `Please enter an optional message for this transfer, or type 'skip' to proceed without a message:`
    );
    setTempData(chatId, 'awaitingMessage', true);
  } else if (state === BotState.TRANSFER_WALLET && walletAddress) {
    // Confirm wallet transfer
    await confirmWalletTransfer(ctx, chatId);
  } else if (state === BotState.TRANSFER_BANK) {
    // Bank transfer needs more data
    const name = getTempData(chatId, 'bankName');
    const accountNumber = getTempData(chatId, 'bankAccountNumber');
    const routingNumber = getTempData(chatId, 'bankRoutingNumber');
    const bankName = getTempData(chatId, 'bankInstitutionName');
    
    if (name && accountNumber && routingNumber && bankName) {
      await confirmBankTransfer(ctx, chatId);
    }
  }
};

// Handle message input for email transfers
export const handleMessageInput = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const isAwaitingMessage = getTempData(chatId, 'awaitingMessage');
  
  if (!isAwaitingMessage) return;
  
  const text = ctx.message.text.trim();
  const message = text.toLowerCase() === 'skip' ? '' : text;
  
  // Store message in session
  setTempData(chatId, 'transferMessage', message);
  setTempData(chatId, 'awaitingMessage', false);
  
  // Confirm email transfer
  await confirmEmailTransfer(ctx, chatId);
};

// Handle wallet address input
export const handleWalletAddressInput = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const state = getState(chatId);
  
  if (state !== BotState.TRANSFER_WALLET) return;
  
  const walletAddress = ctx.message.text.trim();
  
  // Basic validation - in reality, you'd want more robust validation based on the network
  if (walletAddress.length < 20) {
    await ctx.reply(`❌ Invalid wallet address. Please enter a valid address.`);
    return;
  }
  
  // Store wallet address in session
  setTempData(chatId, 'transferWalletAddress', walletAddress);
  
  // Show balance and ask for network
  const balanceResponse = await getWalletBalances(chatId);
  
  if (balanceResponse.status && balanceResponse.data && balanceResponse.data.length > 0) {
    let balanceMessage = `Your available balances:\n\n`;
    
    balanceResponse.data.forEach(balance => {
      balanceMessage += `${balance.availableBalance.toFixed(6)} ${balance.asset} on ${balance.network}\n`;
    });
    
    // Get network options
    const networks = balanceResponse.data.map(b => b.network);
    
    // Store networks in session
    setTempData(chatId, 'availableNetworks', networks);
    
    // Create network selection keyboard
    const keyboard = {
      inline_keyboard: networks.map(network => [
        { text: network, callback_data: `network:${network}` }
      ])
    };
    
    await ctx.reply(
      `${balanceMessage}\n\nSelect the network you want to use:`,
      { reply_markup: keyboard }
    );
  } else {
    await ctx.reply(
      `❌ You don't have any available balance. Please deposit funds first.`
    );
    updateState(chatId, BotState.MAIN_MENU);
  }
};

// Handle bank transfer flow
export const handleBankTransferFlow = async (ctx: Context): Promise<void> => {
  if (!ctx.message || !('text' in ctx.message)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const state = getState(chatId);
  const text = ctx.message.text.trim();
  
  if (state !== BotState.TRANSFER_BANK) return;
  
  // Check what bank info we're collecting
  const name = getTempData(chatId, 'bankName');
  const accountNumber = getTempData(chatId, 'bankAccountNumber');
  const routingNumber = getTempData(chatId, 'bankRoutingNumber');
  
  if (!name) {
    // Collecting name
    setTempData(chatId, 'bankName', text);
    await ctx.reply(`Enter your bank account number:`);
  } else if (!accountNumber) {
    // Collecting account number
    setTempData(chatId, 'bankAccountNumber', text);
    await ctx.reply(`Enter your bank routing number:`);
  } else if (!routingNumber) {
    // Collecting routing number
    setTempData(chatId, 'bankRoutingNumber', text);
    await ctx.reply(`Enter your bank name:`);
  } else {
    // Collecting bank name
    setTempData(chatId, 'bankInstitutionName', text);
    
    // Now ask for amount
    const balanceResponse = await getWalletBalances(chatId);
    
    if (balanceResponse.status && balanceResponse.data && balanceResponse.data.length > 0) {
      let balanceMessage = `Your available balances:\n\n`;
      
      balanceResponse.data.forEach(balance => {
        balanceMessage += `${balance.availableBalance.toFixed(6)} ${balance.asset}\n`;
      });
      
      await ctx.reply(
        `${balanceMessage}\n\nPlease enter the amount of USDC to withdraw:`
      );
      
      // Set temporary state for amount input
      setTempData(chatId, 'awaitingAmount', true);
    } else {
      await ctx.reply(
        `❌ You don't have any available balance. Please deposit funds first.`
      );
      updateState(chatId, BotState.MAIN_MENU);
    }
  }
};

// Confirm email transfer
const confirmEmailTransfer = async (ctx: Context, chatId: string): Promise<void> => {
  const email = getTempData(chatId, 'transferEmail');
  const amount = getTempData(chatId, 'transferAmount');
  const message = getTempData(chatId, 'transferMessage') || '';
  const network = getTempData(chatId, 'transferNetwork');
  
  if (!email || !amount || !network) {
    await ctx.reply(`❌ Missing transfer details. Returning to transfer options.`);
    updateState(chatId, BotState.MAIN_MENU);
    await handleSendCommand(ctx);
    return;
  }
  
  // Confirm transfer with keyboard
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Confirm Transfer', callback_data: 'confirm_email_transfer' }],
      [{ text: '❌ Cancel', callback_data: 'cancel_transfer' }]
    ]
  };
  
  await ctx.reply(
    `📧 *Email Transfer Confirmation*\n\n` +
    `Recipient: ${email}\n` +
    `Amount: ${amount} USDC\n` +
    `Network: ${network}\n` +
    `Message: ${message || 'None'}\n\n` +
    `Please confirm this transfer:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
};

// Confirm wallet transfer
const confirmWalletTransfer = async (ctx: Context, chatId: string): Promise<void> => {
  const walletAddress = getTempData(chatId, 'transferWalletAddress');
  const amount = getTempData(chatId, 'transferAmount');
  const network = getTempData(chatId, 'transferNetwork');
  
  if (!walletAddress || !amount || !network) {
    await ctx.editMessageText(`❌ Missing transfer details. Returning to transfer options.`);
    updateState(chatId, BotState.MAIN_MENU);
    await handleSendCommand(ctx);
    return;
  }
  
  // Confirm transfer with keyboard
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Confirm Transfer', callback_data: 'confirm_wallet_transfer' }],
      [{ text: '❌ Cancel', callback_data: 'cancel_transfer' }]
    ]
  };
  
  await ctx.reply(
    `🔐 *Wallet Transfer Confirmation*\n\n` +
    `Recipient Address: ${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 10)}\n` +
    `Amount: ${amount} USDC\n` +
    `Network: ${network}\n\n` +
    `Please confirm this transfer:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
};

// Confirm bank transfer
const confirmBankTransfer = async (ctx: Context, chatId: string): Promise<void> => {
  const name = getTempData(chatId, 'bankName');
  const accountNumber = getTempData(chatId, 'bankAccountNumber');
  const routingNumber = getTempData(chatId, 'bankRoutingNumber');
  const bankName = getTempData(chatId, 'bankInstitutionName');
  const amount = getTempData(chatId, 'transferAmount');
  
  if (!name || !accountNumber || !routingNumber || !bankName || !amount) {
    await ctx.reply(`❌ Missing transfer details. Please start again with /send.`);
    updateState(chatId, BotState.MAIN_MENU);
    return;
  }
  
  // Confirm transfer with keyboard
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Confirm Transfer', callback_data: 'confirm_bank_transfer' }],
      [{ text: '❌ Cancel', callback_data: 'cancel_transfer' }]
    ]
  };
  
  // Mask account number for security
  const maskedAccountNumber = accountNumber.replace(/\d(?=\d{4})/g, "*");
  
  await ctx.reply(
    `🏦 *Bank Withdrawal Confirmation*\n\n` +
    `Name: ${name}\n` +
    `Account: ${maskedAccountNumber}\n` +
    `Bank: ${bankName}\n` +
    `Amount: ${amount} USDC\n\n` +
    `Please confirm this withdrawal:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
};

// Handle transfer confirmation callbacks
export const handleTransferConfirmation = async (ctx: Context): Promise<void> => {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  
  const chatId = ctx.chat?.id.toString() || '';
  const callbackData = ctx.callbackQuery.data;
  
  // Process different confirmation types
  switch (callbackData) {
    case 'confirm_email_transfer':
      await executeEmailTransfer(ctx, chatId);
      break;
      
    case 'confirm_wallet_transfer':
      await executeWalletTransfer(ctx, chatId);
      break;
      
    case 'confirm_bank_transfer':
      await executeBankTransfer(ctx, chatId);
      break;
      
    case 'cancel_transfer':
      await ctx.editMessageText(
        `✅ Transfer cancelled. Returning to main menu.`
      );
      updateState(chatId, BotState.MAIN_MENU);
      clearTempData(chatId);
      await handleMenu(ctx);
      break;
      
    default:
      // Unknown callback - do nothing
      break;
  }
};

// Execute email transfer
const executeEmailTransfer = async (ctx: Context, chatId: string): Promise<void> => {
  // Get transfer data from session
  const email = getTempData(chatId, 'transferEmail');
  const amount = getTempData(chatId, 'transferAmount');
  const message = getTempData(chatId, 'transferMessage') || '';
  const network = getTempData(chatId, 'transferNetwork');
  
  if (!email || !amount || !network) {
    await ctx.editMessageText(`❌ Missing transfer details. Returning to transfer options.`);
    updateState(chatId, BotState.MAIN_MENU);
    await handleSendCommand(ctx);
    return;
  }
  
  // Update message to show processing
  await ctx.editMessageText(`🔄 Processing email transfer...`);
  
  // Prepare transfer data
  const transferData: EmailTransferRequest = {
    email,
    amount,
    asset: 'USDC',
    network,
    message
  };
  
  // Execute transfer
  const response = await sendEmailTransfer(chatId, transferData);
  
  if (response.status && response.data) {
    await ctx.editMessageText(
      `✅ Transfer successful!\n\n` +
      `Sent ${amount} USDC to ${email} on ${network} network.\n` +
      `Transaction ID: ${response.data.id}`
    );
  } else {
    await ctx.editMessageText(
      `❌ Transfer failed: ${response.message || 'Unknown error'}\n\n` +
      `Please try again later or contact support.`
    );
  }
  
  // Reset state
  updateState(chatId, BotState.MAIN_MENU);
  clearTempData(chatId);
};

// Execute wallet transfer
const executeWalletTransfer = async (ctx: Context, chatId: string): Promise<void> => {
  // Get transfer data from session
  const walletAddress = getTempData(chatId, 'transferWalletAddress');
  const amount = getTempData(chatId, 'transferAmount');
  const network = getTempData(chatId, 'transferNetwork');
  
  if (!walletAddress || !amount || !network) {
    await ctx.editMessageText(`❌ Missing transfer details. Returning to transfer options.`);
    updateState(chatId, BotState.MAIN_MENU);
    await handleSendCommand(ctx);
    return;
  }
  
  // Update message to show processing
  await ctx.editMessageText(`🔄 Processing wallet transfer...`);
  
  // Prepare transfer data
  const transferData: WalletTransferRequest = {
    address: walletAddress,
    amount,
    asset: 'USDC',
    network
  };
  
  // Execute transfer
  const response = await sendWalletTransfer(chatId, transferData);
  
  if (response.status && response.data) {
    await ctx.editMessageText(
      `✅ Transfer successful!\n\n` +
      `Sent ${amount} USDC to wallet on ${network} network.\n` +
      `Transaction ID: ${response.data.id}`
    );
  } else {
    await ctx.editMessageText(
      `❌ Transfer failed: ${response.message || 'Unknown error'}\n\n` +
      `Please try again later or contact support.`
    );
  }
  
  // Reset state
  updateState(chatId, BotState.MAIN_MENU);
  clearTempData(chatId);
};

// Execute bank transfer
const executeBankTransfer = async (ctx: Context, chatId: string): Promise<void> => {
  // Get transfer data from session
  const name = getTempData(chatId, 'bankName');
  const accountNumber = getTempData(chatId, 'bankAccountNumber');
  const routingNumber = getTempData(chatId, 'bankRoutingNumber');
  const bankName = getTempData(chatId, 'bankInstitutionName');
  const amount = getTempData(chatId, 'transferAmount');
  
  if (!name || !accountNumber || !routingNumber || !bankName || !amount) {
    await ctx.editMessageText(`❌ Missing transfer details. Returning to transfer options.`);
    updateState(chatId, BotState.MAIN_MENU);
    await handleSendCommand(ctx);
    return;
  }
  
  // Update message to show processing
  await ctx.editMessageText(`🔄 Processing bank withdrawal...`);
  
  // Prepare transfer data
  const transferData: BankTransferRequest = {
    name,
    accountNumber,
    routingNumber,
    bankName,
    amount,
    asset: 'USDC'
  };
  
  // Execute transfer
  const response = await sendBankTransfer(chatId, transferData);
  
  if (response.status && response.data) {
    await ctx.editMessageText(
      `✅ Bank withdrawal initiated!\n\n` +
      `Sent ${amount} USDC to your bank account.\n` +
      `Transaction ID: ${response.data.id}\n\n` +
      `Note: Bank transfers typically take 1-3 business days to complete.`
    );
  } else {
    await ctx.editMessageText(
      `❌ Bank withdrawal failed: ${response.message || 'Unknown error'}\n\n` +
      `Please try again later or contact support.`
    );
  }
  
  // Reset state
  updateState(chatId, BotState.MAIN_MENU);
  clearTempData(chatId);
};