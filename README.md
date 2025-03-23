# Copperx Telegram Bot

A Telegram bot that integrates with Copperx Payout's API to enable users to deposit, withdraw, and transfer USDC directly through Telegram without visiting the web app.

## Features

### Authentication & Account Management
- Login with Copperx credentials using email OTP
- View account profile information
- Check KYC/KYB approval status
- Secure token management

### Wallet Management
- View wallet balances across networks
- List wallet addresses
- Set default wallet for transactions
- Get deposit instructions

### Fund Transfers
- Send funds to email addresses
- Send funds to external wallet addresses
- Withdraw funds to bank accounts
- View transaction history

### Deposit Notifications
- Real-time notifications for deposits using Pusher

## Tech Stack

- TypeScript/Node.js
- Telegraf (Telegram Bot Framework)
- Axios for API requests
- Pusher.js for real-time notifications
- Strong type safety throughout the codebase

## Project Structure

```
├── src/
│   ├── config/        # Configuration files
│   ├── handlers/      # Command handlers
│   ├── middlewares/   # Bot middlewares
│   ├── models/        # Type definitions
│   ├── services/      # API service integration
│   ├── utils/         # Utility functions
│   └── index.ts       # Main entry point
├── .env               # Environment variables
├── package.json       # Project dependencies
├── tsconfig.json      # TypeScript configuration
└── README.md          # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- Telegram Bot Token (from BotFather)
- Copperx API credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/copperx-tg-bot.git
cd copperx-tg-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the required environment variables:
```
BOT_TOKEN=your_telegram_bot_token
API_BASE_URL=https://income-api.copperx.io/api
PUSHER_KEY=e089376087cac1a62785
PUSHER_CLUSTER=ap1
NODE_ENV=development
```

4. Build and run the bot:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Deployment

The bot is designed to be deployable on platforms like Render.com. For production deployment, set the following additional environment variables:

```
NODE_ENV=production
PORT=3000
WEBHOOK_DOMAIN=https://your-domain.com
```

## Bot Commands

### General Commands
- `/start` - Start the bot and get welcome message
- `/menu` - Show available commands
- `/help` - Get help information
- `/support` - Get support contact information

### Authentication Commands
- `/login` - Login to Copperx account
- `/logout` - Logout from your account
- `/profile` - View your account profile

### Wallet Commands
- `/balance` - Check your wallet balances
- `/wallets` - View your wallet addresses
- `/deposit` - Get deposit instructions
- `/set_default_wallet` - Set your default wallet

### Transfer Commands
- `/send` - Send funds (email, wallet, bank)
- `/transfers` - View your transfer history

## Security Considerations

- Session tokens are stored securely
- No plaintext passwords are stored
- Sensitive information is masked in UI
- Error handling ensures no sensitive data is leaked
- Proper input validation for all user inputs

## Troubleshooting

### Common Issues
- **Authentication errors**: Ensure your Copperx account is active
- **Transfer failures**: Check available balance and network selection
- **Notification issues**: Ensure Pusher connection is established

### Logs
Check application logs for detailed error information.

## Support

For issues or inquiries, contact:
- Telegram Community: https://t.me/copperxcommunity/2183
- Email: support@copperx.io

## License

This project is proprietary software for Copperx.