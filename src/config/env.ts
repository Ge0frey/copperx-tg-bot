import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  apiBaseUrl: process.env.API_BASE_URL || 'https://income-api.copperx.io/api',
  pusher: {
    key: process.env.PUSHER_KEY || 'e089376087cac1a62785',
    cluster: process.env.PUSHER_CLUSTER || 'ap1',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required environment variables
export const validateEnv = (): boolean => {
  if (!config.botToken) {
    console.error('BOT_TOKEN environment variable is not set!');
    return false;
  }
  return true;
}; 