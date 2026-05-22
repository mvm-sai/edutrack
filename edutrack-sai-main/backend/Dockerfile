# Production Dockerfile for EduTrack Backend
# WhatsApp + Puppeteer + PostgreSQL Ready

FROM node:18-slim

# ─────────────────────────────────────────────────────────────
# Install Dependencies
# ─────────────────────────────────────────────────────────────

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    build-essential \
    python3 \
    curl \
    wget \
    git \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────
# Chromium Environment
# ─────────────────────────────────────────────────────────────

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_BIN=/usr/bin/chromium

# ─────────────────────────────────────────────────────────────
# App Directory
# ─────────────────────────────────────────────────────────────

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# ─────────────────────────────────────────────────────────────
# Install Backend Dependencies
# ─────────────────────────────────────────────────────────────

RUN cd backend && npm install

# ─────────────────────────────────────────────────────────────
# Copy Project Files
# ─────────────────────────────────────────────────────────────

COPY backend/ ./backend/

# ─────────────────────────────────────────────────────────────
# Create Required Directories
# ─────────────────────────────────────────────────────────────

RUN mkdir -p /app/backend/data \
    && mkdir -p /app/backend/.wwebjs_auth \
    && chmod -R 755 /app/backend

# ─────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# ─────────────────────────────────────────────────────────────
# Expose Backend Port
# ─────────────────────────────────────────────────────────────

EXPOSE 3001

# ─────────────────────────────────────────────────────────────
# Security User
# ─────────────────────────────────────────────────────────────

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

USER appuser

# ─────────────────────────────────────────────────────────────
# Start Backend
# ─────────────────────────────────────────────────────────────

WORKDIR /app/backend

CMD ["npm", "start"]