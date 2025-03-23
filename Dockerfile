FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Clean up development dependencies
RUN npm prune --production

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the bot
CMD ["npm", "start"] 