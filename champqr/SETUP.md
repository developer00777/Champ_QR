# ChampQR — Setup Guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    docker-compose                        │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────┐│
│  │ frontend │   │ backend  │   │       worker         ││
│  │  nginx   │──▶│ Fastify  │   │  BullMQ processor    ││
│  │  :80     │   │  :3001   │   │  (transcoder/QR/AR)  ││
│  └──────────┘   └────┬─────┘   └──────────┬───────────┘│
│        │             │                    │             │
│        │        ┌────┴────────────────────┤             │
│        │        ▼                         ▼             │
│  ┌─────┴──┐ ┌──────────┐           ┌──────────┐        │
│  │uploads │ │ mongodb  │           │  redis   │        │
│  │volume  │ │  :27017  │           │  :6379   │        │
│  └────────┘ └──────────┘           └──────────┘        │
└─────────────────────────────────────────────────────────┘
```

**5 containers:**
| Container | Image | Purpose |
|---|---|---|
| `champqr-frontend` | nginx:1.25-alpine | Serves React SPA, proxies /api and /files |
| `champqr-backend` | node:20-alpine | Fastify REST API + WebSocket |
| `champqr-worker` | node:20-alpine | BullMQ job processor (FFmpeg, QR, MindAR) |
| `champqr-mongodb` | mongo:7.0 | Primary database |
| `champqr-redis` | redis:7-alpine | BullMQ job queue |

**3 named volumes:**
- `mongodb_data` — MongoDB data files
- `redis_data` — Redis AOF persistence
- `uploads_data` — Shared between backend + worker (videos, QR images, print packs)

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- That's it. No Node, MongoDB, Redis, or FFmpeg needed on the host.

---

## Quick Start (Production)

### 1. Clone / enter project

```bash
cd champqr
```

### 2. Set environment variables

```bash
cp .env.docker .env.docker.local
```

Edit `.env.docker.local` — **minimum required changes:**

```env
MONGO_INITDB_ROOT_PASSWORD=your_strong_mongo_password
REDIS_PASSWORD=your_strong_redis_password
JWT_SECRET=a_random_64_char_string_go_generate_one_now
FRONTEND_URL=http://your-domain.com
FILE_BASE_URL=http://your-domain.com/files
```

Generate a strong JWT secret:
```bash
openssl rand -hex 64
```

### 3. Add Champions Ranch logo

Place your logo at:
```
backend/src/assets/champions-ranch-logo.png
```
Requirements: PNG, transparent background, minimum 300×300px.
The Dockerfile copies this into the image at build time.
If the file is absent, QR codes are generated without the center logo — no errors.

### 4. Build and start

```bash
docker compose --env-file .env.docker.local up -d --build
```

First build takes 3–5 minutes (installs canvas, sharp, compiles TypeScript).
Subsequent builds use Docker layer cache and are much faster.

### 5. Open the app

```
http://localhost        → Landing page
http://localhost/login  → Sign in
```

---

## Development Mode

Development mode mounts source code into containers for hot-reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  --env-file .env.docker.local up --build
```

- Frontend hot-reload: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

---

## Useful Commands

```bash
# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f mongodb

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Stop and remove volumes (DELETES ALL DATA)
docker compose down -v

# Rebuild a single service
docker compose up -d --build backend

# Open a shell in the backend container
docker compose exec backend sh

# Open MongoDB shell
docker compose exec mongodb mongosh -u champqr -p --authenticationDatabase admin champqr

# Flush Redis (clears job queue)
docker compose exec redis redis-cli -a your_redis_password FLUSHALL
```

---

## Health Checks

All services have health checks. Check status:

```bash
docker compose ps
```

Expected output when healthy:
```
NAME                 STATUS
champqr-frontend     Up (healthy)
champqr-backend      Up (healthy)
champqr-worker       Up
champqr-mongodb      Up (healthy)
champqr-redis        Up (healthy)
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Yes | `champqr` | MongoDB root user |
| `MONGO_INITDB_ROOT_PASSWORD` | **Yes** | — | MongoDB root password |
| `REDIS_PASSWORD` | **Yes** | — | Redis password |
| `JWT_SECRET` | **Yes** | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token lifetime |
| `FRONTEND_URL` | Yes | `http://localhost` | Public URL of the frontend |
| `FILE_BASE_URL` | Yes | `http://localhost/files` | Public base URL for file downloads |
| `LOGO_PATH` | No | `/app/src/assets/champions-ranch-logo.png` | Path to Champions Ranch logo inside container |
| `RESEND_API_KEY` | No | — | Password reset emails (Phase 2) |
| `OPENROUTER_API_KEY` | No | — | AI video analysis (Phase 2) |

---

## Production Deployment (VPS / Cloud)

1. SSH into your server
2. Install Docker + Docker Compose
3. Clone the repo
4. Follow Quick Start steps above, replacing `localhost` with your domain
5. For HTTPS, put Cloudflare or Traefik in front, or add certbot:

```yaml
# Add to docker-compose.yml under frontend:
  certbot:
    image: certbot/certbot
    volumes:
      - ./docker/certbot/conf:/etc/letsencrypt
      - ./docker/certbot/www:/var/www/certbot
```

---

## Data Persistence

All persistent data is stored in named Docker volumes:

| Volume | Contents |
|---|---|
| `champqr_mongodb_data` | All MongoDB documents (users, cards, scans) |
| `champqr_redis_data` | Redis AOF log (job queue state) |
| `champqr_uploads_data` | All uploaded/processed files (videos, QR PNGs, .mind files, ZIPs) |

Backup uploads:
```bash
docker run --rm -v champqr_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup.tar.gz /data
```

Backup MongoDB:
```bash
docker compose exec mongodb mongodump \
  -u champqr -p your_password \
  --authenticationDatabase admin \
  --db champqr --out /tmp/dump

docker compose cp mongodb:/tmp/dump ./mongo-backup
```
