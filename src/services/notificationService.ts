import Pusher from 'pusher-js';
import { post } from '../utils/api';
import { config } from '../config/env';
import { ApiResponse } from '../models/types';
import { Context } from 'telegraf';

// Store active Pusher clients for each organization
const activeClients: Record<string, Pusher> = {};

// Initialize a Pusher client for a specific organization
export const initializePusherClient = async (
  organizationId: string, 
  userId: string, 
  bot: any,
  chatId: number
): Promise<Pusher | null> => {
  try {
    if (activeClients[organizationId]) {
      // If a client already exists for this organization, return it
      return activeClients[organizationId];
    }

    const pusherClient = new Pusher(config.pusher.key, {
      cluster: config.pusher.cluster,
      authorizer: (channel) => ({
        authorize: async (socketId, callback) => {
          try {
            // Authenticate with the Copperx API
            const response = await post<ApiResponse<any>>(
              '/notifications/auth',
              {
                socket_id: socketId,
                channel_name: channel.name
              },
              userId
            );

            if (response.status && response.data) {
              callback(null, response.data);
            } else {
              callback(new Error('Pusher authentication failed'), null);
            }
          } catch (error: any) {
            console.error('Pusher authorization error:', error);
            callback(error, null);
          }
        }
      })
    });

    // Subscribe to organization's private channel
    const channelName = `private-org-${organizationId}`;
    const channel = pusherClient.subscribe(channelName);

    // Handle subscription success
    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`Successfully subscribed to ${channelName}`);
    });

    // Handle subscription error
    channel.bind('pusher:subscription_error', (error: any) => {
      console.error('Subscription error:', error);
    });

    // Bind to deposit event on the channel (not on the pusher client)
    channel.bind('deposit', (data: any) => {
      console.log('Deposit received:', data);
      
      // Format and send message to user
      const message = formatDepositMessage(data);
      bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' })
        .catch((err: any) => console.error('Error sending deposit notification:', err));
    });

    // Store the client for reuse
    activeClients[organizationId] = pusherClient;
    return pusherClient;
  } catch (error) {
    console.error('Error initializing Pusher client:', error);
    return null;
  }
};

// Format deposit notification message
const formatDepositMessage = (data: any): string => {
  return `💰 *New Deposit Received*\n\n` +
    `Amount: ${data.amount} ${data.asset || 'USDC'}\n` +
    `Network: ${data.network || 'Unknown'}\n` +
    `Transaction Hash: \`${data.txHash || 'N/A'}\`\n` +
    `${data.timestamp ? `Time: ${new Date(data.timestamp).toLocaleString()}` : ''}`;
};

// Disconnect a specific client
export const disconnectPusherClient = (organizationId: string): void => {
  if (activeClients[organizationId]) {
    activeClients[organizationId].disconnect();
    delete activeClients[organizationId];
  }
};

// Disconnect all active clients
export const disconnectAllPusherClients = (): void => {
  Object.keys(activeClients).forEach(organizationId => {
    activeClients[organizationId].disconnect();
    delete activeClients[organizationId];
  });
}; 