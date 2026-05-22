# Production Dockerfile for EduTrack Backend
# Builds a lightweight Node.js image with Chromium for WhatsApp Web automation

FROM node:18-slim

# ─────────────────────────────────────────────────────────────────────────────
# Install System Dependencies
# ─────────────────────────────────────────────────────────────────────────────

RUN apt-get update && apt-get install -y \
    # Chromium + required fonts
    chromium-browser \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    \
    # Build tools (for native dependencies)
    build-essential \
    python3 \
    \
    # Utilities
    curl \
    wget \
    git \
    libssl-dev \
    \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# Set Chromium Paths
# ─────────────────────────────────────────────────────────────────────────────

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_BIN=/usr/bin/chromium

# ─────────────────────────────────────────────────────────────────────────────
# Setup Working Directory
# ─────────────────────────────────────────────────────────────────────────────

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/

# ─────────────────────────────────────────────────────────────────────────────
# Install Dependencies
# ─────────────────────────────────────────────────────────────────────────────

RUN cd backend && npm ci --only=production

# ─────────────────────────────────────────────────────────────────────────────
# Copy Application Code
# ─────────────────────────────────────────────────────────────────────────────

COPY backend/ ./backend/

# ─────────────────────────────────────────────────────────────────────────────
# Create Necessary Directories
# ─────────────────────────────────────────────────────────────────────────────

RUN mkdir -p /app/backend/data \
    && mkdir -p /app/backend/.wwebjs_auth \
    && chmod -R 755 /app/backend

# ─────────────────────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────────────────────

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# ─────────────────────────────────────────────────────────────────────────────
# Expose Port
# ─────────────────────────────────────────────────────────────────────────────

EXPOSE 8000

# ─────────────────────────────────────────────────────────────────────────────
# Security: Run as non-root user
# ─────────────────────────────────────────────────────────────────────────────

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# ─────────────────────────────────────────────────────────────────────────────
# Start Application
# ─────────────────────────────────────────────────────────────────────────────

WORKDIR /app/backend

CMD ["npm", "start"]
