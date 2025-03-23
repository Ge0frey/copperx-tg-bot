// User session and state management
export interface UserSession {
  userId: string;
  email?: string;
  organizationId?: string;
  currentState?: BotState;
  lastAction?: Date;
  tempData?: Record<string, any>;
}

export enum BotState {
  START = 'start',
  AUTH_EMAIL = 'auth_email',
  AUTH_OTP = 'auth_otp',
  MAIN_MENU = 'main_menu',
  WALLET_MENU = 'wallet_menu',
  TRANSFER_MENU = 'transfer_menu',
  TRANSFER_EMAIL = 'transfer_email',
  TRANSFER_WALLET = 'transfer_wallet',
  TRANSFER_BANK = 'transfer_bank',
  PROFILE = 'profile',
}

// API response types
export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data?: T;
  error?: any;
}

// Auth related types
export interface EmailOtpRequest {
  email: string;
}

export interface EmailOtpAuthentication {
  email: string;
  otp: string;
}

export interface AuthResponse {
  tokens: {
    access: {
      token: string;
      expires: string;
    };
    refresh?: {
      token: string;
      expires: string;
    };
  };
  user: User;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  isEmailVerified: boolean;
  role: string;
  organizationId: string;
}

// KYC related types
export interface Kyc {
  id: string;
  status: string;
  type: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// Wallet related types
export interface Wallet {
  id: string;
  network: string;
  address: string;
  isDefault: boolean;
  organizationId: string;
}

export interface WalletBalance {
  organizationId: string;
  asset: string;
  network: string;
  balance: number;
  availableBalance: number;
}

// Transfer related types
export interface Transfer {
  id: string;
  amount: number;
  fee?: number;
  asset: string;
  network?: string;
  type: string;
  status: string;
  fromOrganizationId: string;
  toOrganizationId?: string;
  toEmail?: string;
  toAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTransferRequest {
  asset: string;
  network: string;
  amount: number;
  email: string;
  message?: string;
}

export interface WalletTransferRequest {
  asset: string;
  network: string;
  amount: number;
  address: string;
}

export interface BankTransferRequest {
  asset: string;
  amount: number;
  name: string;
  accountNumber: string;
  routingNumber?: string;
  bankName?: string;
}

// Notification related types
export interface DepositNotification {
  amount: number;
  asset: string;
  network: string;
  address: string;
  txHash: string;
  timestamp: string;
} 