# kooza Servis Backend — NestJS Dockerfile
FROM node:20-slim AS builder

# OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Dependencies
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Source + build
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Production stage ───
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

# Render injects PORT env variable
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
