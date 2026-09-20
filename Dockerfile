# ==========================================
# 1. BUILD STAGE
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY . .
# Apenas compilação: migrations são aplicadas no deploy (db:init-cloud) ou
# manualmente (db:migrate), nunca durante o build da imagem.
RUN npx tsc

# ==========================================
# 2. RUNTIME STAGE
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3333
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/schema.sql ./schema.sql

EXPOSE 3333

USER node

# O build emite dist/src/server.js (rootDir raiz do projeto)
CMD ["node", "dist/src/server.js"]
