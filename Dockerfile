# Container image for any host (Railway, Fly.io, Cloud Run, a VPS, …).
# Sambandh runs as one long-lived Node process — Socket.io, crons and the in-
# memory OTP/challenge/rate-limit stores all work here (unlike serverless).
FROM node:20-alpine

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm install --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
# The server binds process.env.PORT (falls back to 3001). Most hosts inject PORT.
EXPOSE 3001

# Simple container healthcheck against /health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3001}/health || exit 1

CMD ["node", "src/server.js"]
