import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Log environment variables for debugging (but hide sensitive info)
console.log('[ENV] Environment configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('API_BASE_URL:', process.env.API_BASE_URL);
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? '****' : 'Not set');
console.log('PORT:', process.env.PORT);
console.log('WEBHOOK_DOMAIN:', process.env.WEBHOOK_DOMAIN);
console.log('PUSHER_KEY:', process.env.PUSHER_KEY);
console.log('PUSHER_CLUSTER:', process.env.PUSHER_CLUSTER);

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  apiBaseUrl: process.env.API_BASE_URL || 'https://income-api.copperx.io/api',
  pusher: {
    key: process.env.PUSHER_KEY || 'e089376087cac1a62785',
    cluster: process.env.PUSHER_CLUSTER || 'ap1',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  payoutApiUrl: process.env.PAYOUT_API_URL || 'https://api.copperx.io',
  payoutApiKey: process.env.PAYOUT_API_KEY || '',
};

// Log environment variables for debugging (but hide sensitive info)
console.log('[CONFIG] Configured settings:');
console.log('API Base URL:', config.apiBaseUrl);
console.log('Payout API URL:', config.payoutApiUrl);
console.log('Payout API Key:', config.payoutApiKey ? '****' : 'Not set');
console.log('Pusher Key:', config.pusher.key);
console.log('Pusher Cluster:', config.pusher.cluster);
console.log('Node Environment:', config.nodeEnv);

// Validate required environment variables
export const validateEnv = (): boolean => {
  const missingVars = [];

  if (!config.botToken) {
    missingVars.push('BOT_TOKEN');
  }
  
  if (!config.apiBaseUrl) {
    missingVars.push('API_BASE_URL');
  }
  
  if (!config.payoutApiKey) {
    missingVars.push('PAYOUT_API_KEY');
  }
  
  if (missingVars.length > 0) {
    console.error(`[ENV] Missing required environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  // Log successful validation
  console.log('[ENV] Environment validation successful');
  return true;
}; 