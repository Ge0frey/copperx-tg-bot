FROM node:18-alpine

# Set working directory
WORKDIR /app

# Set environment variables with default values
ENV NODE_ENV=production
ENV PORT=4000

# Add args for API configuration with defaults
ARG API_BASE_URL=https://income-api.copperx.io/api
ENV API_BASE_URL=$API_BASE_URL

# Install curl for health checks and busybox for troubleshooting
RUN apk --no-cache add curl busybox

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Clean up development dependencies
RUN npm prune --production

# Health check to ensure the application is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Start the bot
CMD ["npm", "start"] 