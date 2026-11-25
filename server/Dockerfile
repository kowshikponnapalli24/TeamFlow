
# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies, including Prisma CLI and TypeScript
RUN npm ci

# Copy Prisma configuration and schema
COPY prisma ./prisma
COPY prisma7.config.ts ./

# Generate Prisma client
RUN npx prisma generate --config prisma7.config.ts

# Copy application source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build


# Production stage
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application and generated Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Create persistent upload directory
RUN mkdir -p uploads/tasks

EXPOSE 4000

CMD ["node", "dist/server.js"]
