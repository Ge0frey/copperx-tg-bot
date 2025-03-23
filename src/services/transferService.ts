import { get, post } from '../utils/api';
import { 
  ApiResponse, 
  Transfer, 
  EmailTransferRequest, 
  WalletTransferRequest,
  BankTransferRequest 
} from '../models/types';

export const getTransferHistory = async (
  userId: string, 
  page: number = 1, 
  limit: number = 10
): Promise<ApiResponse<{ data: Transfer[], meta: any }>> => {
  try {
    return await get<ApiResponse<{ data: Transfer[], meta: any }>>(
      '/transfers', 
      { page, limit }, 
      userId
    );
  } catch (error: any) {
    console.error('Error getting transfer history:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to fetch transfer history.',
      error: error.response?.data || error,
    };
  }
};

export const sendEmailTransfer = async (
  userId: string,
  transferData: EmailTransferRequest
): Promise<ApiResponse<Transfer>> => {
  try {
    return await post<ApiResponse<Transfer>>('/transfers/send', transferData, userId);
  } catch (error: any) {
    console.error('Error sending email transfer:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to send email transfer.',
      error: error.response?.data || error,
    };
  }
};

export const sendWalletTransfer = async (
  userId: string,
  transferData: WalletTransferRequest
): Promise<ApiResponse<Transfer>> => {
  try {
    return await post<ApiResponse<Transfer>>('/transfers/wallet-withdraw', transferData, userId);
  } catch (error: any) {
    console.error('Error sending wallet transfer:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to send wallet transfer.',
      error: error.response?.data || error,
    };
  }
};

export const sendBankTransfer = async (
  userId: string,
  transferData: BankTransferRequest
): Promise<ApiResponse<Transfer>> => {
  try {
    return await post<ApiResponse<Transfer>>('/transfers/offramp', transferData, userId);
  } catch (error: any) {
    console.error('Error sending bank transfer:', error.response?.data || error.message);
    return {
      status: false,
      message: error.response?.data?.message || 'Failed to send bank transfer.',
      error: error.response?.data || error,
    };
  }
}; 