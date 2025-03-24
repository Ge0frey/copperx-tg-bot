# Deployment Guide for Copperx Telegram Bot

This document provides step-by-step instructions for deploying the Copperx Telegram Bot to a production environment.

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- A registered Telegram bot (via BotFather)
- Copperx Payout API credentials
- Pusher account (for notifications)
- A hosting service (e.g., Render, Heroku, AWS, Digital Ocean)

## Deployment Steps

### 1. Prepare Your Environment

1. Clone the repository:
   ```
   git clone <repository-url>
   cd copperx-tg-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in all required environment variables:
   ```
   cp .env.example .env
   nano .env  # or use any text editor
   ```

4. Set `NODE_ENV=production` in your `.env` file

### 2. Build the Project

Build the TypeScript code:
```
npm run build
```

This will compile the TypeScript code to JavaScript in the `dist` directory.

### 3. Deployment Options

#### Option 1: Render.com (Recommended)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment Variables: Add all variables from your `.env` file
   - Set "Auto-Deploy" to Yes
4. Click "Create Web Service"

#### Option 2: Heroku

1. Install Heroku CLI and log in
2. Initialize Git repository (if needed):
   ```
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. Create Heroku app:
   ```
   heroku create
   ```
4. Set environment variables:
   ```
   heroku config:set BOT_TOKEN=your_token
   # Set all other variables from .env
   ```
5. Deploy:
   ```
   git push heroku main
   ```

#### Option 3: VPS (Digital Ocean, AWS EC2, etc.)

1. SSH into your server
2. Clone the repository and set up as described above
3. Use a process manager like PM2:
   ```
   npm install -g pm2
   pm2 start dist/index.js --name "copperx-tg-bot"
   pm2 save
   pm2 startup
   ```

### 4. Configure Webhook

For production deployments, set up a webhook:

1. Set the `WEBHOOK_DOMAIN` environment variable to point to your deployment URL + "/webhook"
   e.g., `https://your-app.onrender.com/webhook`

2. Make sure your server is accessible via HTTPS (required by Telegram)

3. The bot will automatically register the webhook when started in production mode

### 5. Verify Deployment

1. Start a conversation with your bot on Telegram
2. Send the `/start` command and verify the bot responds correctly
3. Test all core functionality (login, wallet operations, transfers)

### Troubleshooting

- **Webhook Issues**: Check your server logs for errors. Ensure your webhook URL is accessible and uses HTTPS.
- **Authorization Problems**: Verify that your Payout API key is correct and has the necessary permissions.
- **Notification Issues**: Confirm your Pusher credentials and that the correct events are being monitored.

### Monitoring & Maintenance

- Set up logging to monitor bot activity and catch errors
- Regularly update dependencies to fix security vulnerabilities
- Keep an eye on CPU and memory usage, especially as user count grows

## Support

If you encounter issues deploying the bot, please contact Copperx support at support@copperx.io. 