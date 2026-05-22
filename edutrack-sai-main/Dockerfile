FROM node:18-slim

WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Copy and install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy all source code (cache bust: v3)
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Create data directory for SQLite fallback
RUN mkdir -p /app/backend/data

WORKDIR /app/backend

EXPOSE 3001

# Seed database (non-fatal if already seeded) and start server
CMD ["sh", "-c", "npm run seed || true && npm start"]
