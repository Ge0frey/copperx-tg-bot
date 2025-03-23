import { get, put } from '../utils/api';
import { ApiResponse, Wallet, WalletBalance } from '../models/types';

export const getWallets = async (userId: string): Promise<ApiResponse<Wallet[]>> => {
  try {
    return await get<ApiResponse<Wallet[]>>('/wallets', {}, userId);
  } catch (error: any) {
    console.error('Error getting wallets:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to fetch wallets.',
      error: error.response?.data || error,
    };
  }
};

export const getWalletBalances = async (userId: string): Promise<ApiResponse<WalletBalance[]>> => {
  try {
    return await get<ApiResponse<WalletBalance[]>>('/wallets/balances', {}, userId);
  } catch (error: any) {
    console.error('Error getting wallet balances:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to fetch wallet balances.',
      error: error.response?.data || error,
    };
  }
};

export const getDefaultWallet = async (userId: string): Promise<ApiResponse<Wallet>> => {
  try {
    return await get<ApiResponse<Wallet>>('/wallets/default', {}, userId);
  } catch (error: any) {
    console.error('Error getting default wallet:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to fetch default wallet.',
      error: error.response?.data || error,
    };
  }
};

export const setDefaultWallet = async (userId: string, walletId: string): Promise<ApiResponse<Wallet>> => {
  try {
    return await put<ApiResponse<Wallet>>('/wallets/default', { walletId }, userId);
  } catch (error: any) {
    console.error('Error setting default wallet:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to set default wallet.',
      error: error.response?.data || error,
    };
  }
}; 