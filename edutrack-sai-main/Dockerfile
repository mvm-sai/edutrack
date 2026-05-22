FROM node:18-slim

# Install Chromium and its dependencies for whatsapp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Copy and install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy all source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Create data directory for SQLite
RUN mkdir -p /app/backend/data

WORKDIR /app/backend

EXPOSE 3001

# Seed database and start server
CMD ["sh", "-c", "npm run seed && npm start"]
