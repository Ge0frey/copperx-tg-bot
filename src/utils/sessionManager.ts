import { BotState, UserSession } from '../models/types';

// In-memory storage for user sessions
// In a production environment, this would use Redis or a database
const sessions: Record<string, UserSession> = {};

// Create or update a user session
export const setSession = (chatId: string, sessionData: Partial<UserSession>): UserSession => {
  sessions[chatId] = {
    ...getSession(chatId),
    ...sessionData,
    lastAction: new Date(),
  };
  return sessions[chatId];
};

// Get a user session
export const getSession = (chatId: string): UserSession => {
  if (!sessions[chatId]) {
    sessions[chatId] = {
      userId: chatId,
      currentState: BotState.START,
      lastAction: new Date(),
      tempData: {},
    };
  }
  return sessions[chatId];
};

// Check if user is authenticated
export const isAuthenticated = (chatId: string): boolean => {
  const session = getSession(chatId);
  return !!session.organizationId;
};

// Clear a user session (logout)
export const clearSession = (chatId: string): void => {
  // Keep the userId but reset everything else
  sessions[chatId] = {
    userId: chatId,
    currentState: BotState.START,
    lastAction: new Date(),
    tempData: {},
  };
};

// Update user state
export const updateState = (chatId: string, state: BotState): UserSession => {
  return setSession(chatId, { currentState: state });
};

// Get user state
export const getState = (chatId: string): BotState => {
  return getSession(chatId).currentState || BotState.START;
};

// Store temporary data
export const setTempData = (chatId: string, key: string, value: any): UserSession => {
  const session = getSession(chatId);
  if (!session.tempData) {
    session.tempData = {};
  }
  session.tempData[key] = value;
  return setSession(chatId, { tempData: session.tempData });
};

// Get temporary data
export const getTempData = (chatId: string, key: string): any => {
  const session = getSession(chatId);
  return session.tempData ? session.tempData[key] : undefined;
};

// Clear temporary data
export const clearTempData = (chatId: string): UserSession => {
  return setSession(chatId, { tempData: {} });
}; 