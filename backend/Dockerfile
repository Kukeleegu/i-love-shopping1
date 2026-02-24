# Backend image: build from repo root (docker compose: context: ., dockerfile: backend/Dockerfile).
# Includes OpenSSL for Prisma; copies backend + frontend so server can serve ../../frontend.
FROM node:20-bookworm-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend
RUN npx prisma generate
# Start: npm install, prisma generate, migrate deploy, then npm run dev
ENTRYPOINT ["sh", "-c", "npm install && npx prisma generate && npx prisma migrate deploy && exec npm run dev"]
