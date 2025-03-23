import { Context as TelegrafContext } from 'telegraf';

// Extend the Telegraf context with our custom interfaces
declare module 'telegraf' {
  interface Context extends TelegrafContext {
    session?: any;
  }
} 