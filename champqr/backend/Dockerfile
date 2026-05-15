# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# canvas and sharp require native build tools
RUN apk add --no-cache \
    python3 make g++ \
    pkgconfig cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev \
    vips-dev \
    ffmpeg

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts=false

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache \
    python3 make g++ \
    pkgconfig cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev \
    vips-dev

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 3: development ─────────────────────────────────────────────────────
FROM node:20-alpine AS development

RUN apk add --no-cache \
    python3 make g++ \
    pkgconfig cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev \
    vips-dev \
    ffmpeg wget

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts=false

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001
CMD ["npm", "run", "dev"]

# ─── Stage 4: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache \
    # canvas native deps
    cairo pango jpeg giflib librsvg \
    # sharp native deps
    vips \
    # ffmpeg for video transcoding
    ffmpeg \
    # wget for health checks
    wget \
    # tini for proper signal handling
    tini

WORKDIR /app

# Copy production deps (pre-built native modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Copy package.json for scripts reference
COPY package.json ./

# Create uploads dir with correct permissions
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Run as non-root
USER node

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
