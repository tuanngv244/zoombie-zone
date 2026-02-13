# Zombie Zone — Game Design Document

> A cooperative multiplayer 3D browser game where players defend a medieval fortress against waves of zombies and invading armies.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Infrastructure & Docker](#infrastructure--docker)
4. [Art Direction & Style](#art-direction--style)
5. [Core Gameplay Loop](#core-gameplay-loop)
6. [Map System](#map-system)
7. [Multiplayer System](#multiplayer-system)
8. [Economy System](#economy-system)
9. [Building System (Defense Structures)](#building-system-defense-structures)
10. [Wave System](#wave-system)
11. [Enemy Types](#enemy-types)
12. [Castle System](#castle-system)
13. [Player Controls & UI](#player-controls--ui)
14. [Warning & Audio System](#warning--audio-system)
15. [Visual Effects](#visual-effects)
16. [Victory & Defeat Conditions](#victory--defeat-conditions)
17. [Server Architecture](#server-architecture)
18. [Client Architecture](#client-architecture)
19. [Networking Model](#networking-model)
20. [Cross-Browser & Cross-Device Compatibility](#cross-browser--cross-device-compatibility)
21. [Deployment](#deployment)
22. [Performance Targets](#performance-targets)

---

## Overview

**Title:** Zombie Zone
**Genre:** Cooperative Tower Defense / Real-Time Strategy
**Platform:** Web browsers (desktop + mobile) — any device with a modern browser
**Players:** 1–4 per room
**Session Length:** ~25–35 minutes

**Story:** Zombies and invading armies are attacking the King's Fortress. Players must cooperate to build defenses and survive all waves.

---

## Tech Stack

### Server

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| HTTP Framework | Express |
| Real-time Communication | Socket.io |
| Language | TypeScript |
| Build Tool | esbuild or tsc |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Cache | Redis 7 |
| Containerization | Docker + Docker Compose |

### Client

| Component | Technology |
|-----------|------------|
| 3D Rendering | Three.js |
| Animation | GSAP |
| Language | TypeScript |
| Build Tool | Vite |
| Asset Loading | Three.js GLTFLoader / TextureLoader |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Container Runtime | Docker |
| Orchestration (local) | Docker Compose |
| Database | PostgreSQL 16 (Docker container) |
| Cache / Pub-Sub | Redis 7 (Docker container) |
| Server | Node.js app (Docker container) |

---

## Infrastructure & Docker

### Overview

All backend services run as Docker containers orchestrated via Docker Compose. A single `docker compose up` starts the full local development stack.

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `server` | Custom (Dockerfile) | 3000 | Game server (Express + Socket.io) |
| `postgres` | `postgres:16-alpine` | 5432 | Persistent data (players, leaderboards, match history) |
| `redis` | `redis:7-alpine` | 6379 | Room state cache, session store, pub/sub for scaling |

### Database (PostgreSQL) — What It Stores

| Table | Purpose |
|-------|---------|
| `players` | Player accounts (id, username, created_at) |
| `match_history` | Completed games (room_id, result, wave_reached, duration, played_at) |
| `match_players` | Player-to-match join table with per-player stats (kills, gold_earned, buildings_placed) |
| `leaderboard` | Aggregated player stats (total_kills, games_won, games_played) |

> The database is **not** used for real-time game state. All in-game state (enemies, buildings, gold, HP) lives in server memory and Redis.

### Cache (Redis) — What It Stores

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `room:{roomId}` | Active room metadata (players, state, wave) | Until room ends |
| `room:{roomId}:state` | Serialized game state snapshot (for reconnection) | Until room ends |
| `session:{socketId}` | Player session mapping (for reconnection) | 5 minutes after disconnect |
| `matchmaking:queue` | Players waiting for auto-match | Until matched |

### Project Root Structure

```
zombie-zone/
├── docker-compose.yml          # Orchestrates all services
├── .env                        # Environment variables (ports, DB creds, Redis URL)
├── .env.example                # Template for .env
├── business.md                 # This document
├── server/
│   ├── Dockerfile              # Multi-stage build for Node.js server
│   ├── .dockerignore
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   └── src/
│       └── ...
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        └── ...
```

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "${DB_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${DB_USER:-zombie}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-zombie_secret}
      POSTGRES_DB: ${DB_NAME:-zombie_zone}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-zombie}"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${SERVER_PORT:-3000}:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://${DB_USER:-zombie}:${DB_PASSWORD:-zombie_secret}@postgres:5432/${DB_NAME:-zombie_zone}
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./server/src:/app/src    # Hot-reload in dev
    develop:
      watch:
        - action: sync
          path: ./server/src
          target: /app/src

volumes:
  postgres_data:
  redis_data:
```

### Server Dockerfile

```dockerfile
# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npx prisma generate
COPY src ./src/
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

### Environment Variables (.env.example)

```env
# Database
DB_USER=zombie
DB_PASSWORD=zombie_secret
DB_NAME=zombie_zone
DB_PORT=5432

# Redis
REDIS_PORT=6379

# Server
SERVER_PORT=3000
NODE_ENV=development
```

### Local Development Commands

```bash
# Start all services (first time — builds images, runs migrations)
docker compose up --build

# Start in background
docker compose up -d

# View logs
docker compose logs -f server

# Stop all services
docker compose down

# Reset database (destroy volume and re-migrate)
docker compose down -v && docker compose up --build

# Run Prisma migrations (while containers are running)
docker compose exec server npx prisma migrate dev

# Open Prisma Studio (DB GUI)
docker compose exec server npx prisma studio

# Connect to PostgreSQL directly
docker compose exec postgres psql -U zombie -d zombie_zone

# Connect to Redis CLI
docker compose exec redis redis-cli
```

---

## Art Direction & Style

- **Color Palette:** Dark browns, muted golds, mossy greens, torchlight oranges
- **Theme:** Classic old European medieval (stone castles, wooden palisades, foggy battlefields)
- **Proportions:** Stylized 3D mini/chibi proportions (not realistic)
- **Atmosphere:** Foggy battlefield with volumetric fog, torch particles, dark ambient lighting
- **Audio:**
  - Creepy warning sounds before waves
  - Dark ambient background music
  - Sound effects for combat, building placement, destruction
- **Lighting:** Day/night cycle with progressively darker atmosphere as waves advance

### Camera

| Control | Input |
|---------|-------|
| Zoom in/out | Mouse scroll wheel |
| Rotate around map | Middle mouse drag / Right mouse drag |
| Pan movement | WASD or edge scrolling |
| Default view | Top-down, centered on castle, ~45° angle |

---

## Core Gameplay Loop

```
Lobby → Preparation Phase (2:30) → Wave → Break (30s) → Wave → ... → Final Boss → Victory/Defeat
```

1. Players join a room and enter the **preparation phase** (2 minutes 30 seconds)
2. During preparation, players spend gold to place defense structures on the grid
3. When the timer ends, the first **wave** spawns — enemies march toward the castle
4. Towers and players' structures fight enemies automatically
5. Killing enemies earns **gold** for the team
6. Between waves, a **30-second break** allows repositioning and building
7. Waves escalate in difficulty until the final boss wave
8. Game ends when the castle is destroyed (defeat) or all waves are cleared (victory)

---

## Map System

- **Grid-based** layout with small square cells
- **Grid size:** 40×40 tiles (configurable in server config)
- **Tile size:** 1 unit × 1 unit
- **Placement:** Snap-to-grid system; server validates all placements
- **Spawn zones:** 4 edges of the map (North, South, East, West)
- **Castle zone:** Center of the map, occupies 4×4 tiles (non-buildable)
- **No-build zones:** Spawn areas and pathways must remain passable

### Placement Rules

- Buildings cannot overlap
- Buildings cannot block ALL paths to the castle (at least one path must remain)
- Server validates placement before confirming to client
- Buildings can be **placed**, **moved** (costs no gold), or **sold** (refunds 50% gold)

---

## Multiplayer System

### Room System

- Players can create or join rooms via room code
- Each room supports **1–4 players**
- Room states: `waiting` → `preparation` → `in_progress` → `ended`
- If all players disconnect, room is cleaned up after 60 seconds

### Shared State

- **Shared gold pool** — all players contribute to and spend from the same gold
- **Shared defense grid** — all players build on the same map
- **Shared vision** — all players see all enemies, buildings, and damage in real-time

### Server Authority

The server is **authoritative** over all game logic:

| System | Authority |
|--------|-----------|
| Damage calculations | Server |
| Gold rewards & spending | Server |
| Wave spawning | Server |
| Enemy HP & movement | Server |
| Building placement validation | Server |
| Boss logic & special attacks | Server |

Clients send **intents** (e.g., "place building at x,y"), server validates and broadcasts results.

---

## Economy System

### Starting Gold

- **50 gold** per player, contributed to the shared pool
- 2-player game starts with 100 gold, 3-player with 150, 4-player with 200

### Gold Rewards (per kill)

| Enemy | Gold Reward |
|-------|-------------|
| Normal Zombie | 5 |
| Fast Zombie | 8 |
| Heavy Zombie (Tank) | 12 |
| Zombie Boss | 50 |
| Invading Soldier | 10 |
| Elite Soldier | 20 |
| Final General | 200 |

### Gold Sinks

- Building placement
- Castle upgrades
- Building repairs (if damaged but not destroyed)

---

## Building System (Defense Structures)

### Defensive Walls

| Item | Grid Size | HP | Cost | Notes |
|------|-----------|-----|------|-------|
| Wooden Wall | 1×1 | 100 HP | 20 gold | Cheapest barrier; burns under fire attacks |
| Stone Wall | 1×1 | 250 HP | 40 gold | Solid all-purpose wall |
| Reinforced Brick Wall | 1×1 | 500 HP | 70 gold | Strongest wall |
| River Barrier | 2×1 | 150 HP | 60 gold | Slows enemies by 50% passing through |

### Offensive Structures

| Item | Grid Size | Damage | Range | Attack Speed | Cost | Notes |
|------|-----------|--------|-------|-------------|------|-------|
| Arrow Tower | 2×1 | 8 dmg/hit | 5 tiles | 1.0s | 60 gold | Continuous single-target |
| Cannon | 2×2 | 25 dmg (AoE 2-tile radius) | 6 tiles | 3.0s | 120 gold | Splash damage |
| Ballista | 2×1 | 40 dmg/hit | 8 tiles | 2.5s | 90 gold | High single-target; pierces 2 enemies |
| Explosive Mine | 1×1 | 80 dmg (AoE 1.5-tile radius) | Contact | One-time | 30 gold | Destroyed on detonation |
| Hot Air Balloon | 2×2 | 30 dmg (AoE 2-tile radius) | 4 tiles | 4.0s | 200 gold | Drops bombs; cannot be hit by melee enemies |

### Building Upgrades (Stretch Goal)

Each offensive structure can be upgraded once for 50% of its base cost:
- **+30% damage**
- **+20% attack speed**
- Visual upgrade (e.g., stone arrow tower, reinforced cannon)

---

## Wave System

### Phase Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Preparation | 2:30 | Build initial defenses |
| Wave Break | 0:30 | Between each wave |

### Zombie Waves (15 total)

Waves scale progressively. Scaling formula per wave:

- **HP multiplier:** `1.0 + (wave - 1) × 0.15` (Wave 1 = 1.0×, Wave 15 = 3.1×)
- **Speed multiplier:** `1.0 + (wave - 1) × 0.05` (Wave 1 = 1.0×, Wave 15 = 1.7×)
- **Spawn count:** `base_count + (wave - 1) × 2`

| Wave | Composition | Base Count |
|------|------------|------------|
| 1–3 | Normal Zombies only | 8 |
| 4–6 | Normal + Fast Zombies (30% fast) | 12 |
| 7–9 | Normal + Fast + Heavy Zombies (20% heavy) | 16 |
| 10–12 | Mixed, more heavies (30% heavy) | 20 |
| 13–14 | All types, high density | 25 |
| 15 | **4 Zombie Bosses** (one from each map edge) + 30 mixed | 30 |

### Invader Army Waves (5 total)

Interspersed between zombie waves:

| Invader Wave | Appears After Zombie Wave | Composition |
|-------------|--------------------------|-------------|
| 1 | Wave 3 | 6 Soldiers |
| 2 | Wave 6 | 8 Soldiers + 2 Elites |
| 3 | Wave 9 | 10 Soldiers + 4 Elites |
| 4 | Wave 12 | 12 Soldiers + 6 Elites |
| 5 | Wave 15 | **The General** + 8 Elites + 15 Soldiers |

---

## Enemy Types

### Zombies

| Type | Base HP | Base Speed | Damage | Special |
|------|---------|------------|--------|---------|
| Normal Zombie | 50 | 1.0 | 5/hit | — |
| Fast Zombie | 30 | 2.0 | 4/hit | Dodges first projectile (20% chance) |
| Heavy Zombie (Tank) | 150 | 0.6 | 10/hit | Deals 2× damage to walls |
| Zombie Boss | 1000 | 0.8 | 25/hit | AoE slam every 10s (3-tile radius, 40 dmg) |

### Invading Army

| Type | Base HP | Base Speed | Damage | Special |
|------|---------|------------|--------|---------|
| Soldier | 80 | 1.2 | 8/hit | Shields block 25% damage from front |
| Elite Soldier | 200 | 1.0 | 15/hit | Rally nearby soldiers (+20% speed aura) |
| The General | 3000 | 0.7 | 40/hit | Charge attack (dashes 4 tiles, 80 dmg), War Cry (heals all nearby enemies 10% HP every 15s) |

### Pathfinding

- **A\* grid-based** pathfinding
- Enemies recalculate paths when buildings are placed/destroyed
- Enemies target the **castle** by default; attack buildings that block their path
- Bosses prioritize attacking structures in their way

---

## Castle System

| Property | Value |
|----------|-------|
| Base HP | 1000 |
| Grid Size | 4×4 tiles (center of map) |
| Regen | None (must be repaired) |

### Castle Upgrades

| Upgrade | Cost | Effect |
|---------|------|--------|
| Fortify I | 100 gold | +300 HP (max 1300) |
| Fortify II | 200 gold | +500 HP (max 1800) |
| Treasury | 150 gold | +2 gold per kill bonus |
| Repair | 50 gold | Restores 200 HP (can be used multiple times) |

### Game Over Condition

- Castle HP reaches 0 → **Game Over** for all players

---

## Player Controls & UI

### Controls

| Action | Input |
|--------|-------|
| Select building from panel | Left click on UI panel |
| Place building | Left click on valid grid tile |
| Cancel placement | Right click or ESC |
| Move building | Click existing building → drag to new location |
| Sell building | Select building → press Delete or click sell button |
| Camera zoom | Scroll wheel |
| Camera rotate | Right drag / Middle drag |
| Camera pan | WASD / Arrow keys / Edge scroll |

### HUD Elements

| Element | Position | Description |
|---------|----------|-------------|
| Gold counter | Top-left | Current team gold |
| Wave indicator | Top-center | "Wave 3/15" + "Invader Wave 2/5" |
| Timer | Top-center | Countdown to next wave |
| Castle HP bar | Top-center | Visual HP bar with numeric value |
| Building panel | Bottom or left sidebar | Scrollable list of available structures |
| Player list | Top-right | Connected players and their status |
| Minimap | Bottom-right | Overview of the battlefield (stretch goal) |

---

## Warning & Audio System

### Wave Warnings

| Trigger | Visual | Audio | Text |
|---------|--------|-------|------|
| 10s before wave | Screen edges flash red | Creepy horn sound | "WARNING: Wave Incoming" |
| Boss wave incoming | Full screen red pulse | Deep war drums | "Boss Approaching" |
| General spawn | Screen shakes + red overlay | Thunderclap + war horn | "The General Has Arrived" |

### Sound Design

- **Ambient:** Dark medieval ambient loop (wind, distant crows, crackling fire)
- **Combat:** Arrow impacts, cannon booms, explosions, zombie groans
- **UI:** Click sounds, gold chime on earning, error buzz on invalid placement
- **Music:** Low-intensity loop during prep, escalating intensity during waves

---

## Visual Effects

| Effect | Context |
|--------|---------|
| Floating damage numbers | On enemy hit, animate upward and fade |
| Building destruction | Collapse animation + dust/debris particles |
| Smoke & fire particles | On burning buildings, cannon impacts |
| Fog | Ambient volumetric fog across the battlefield |
| Day/night cycle | Gradual darkening as waves progress |
| Enemy death | Fade-out + small particle burst |
| Gold pickup | Floating gold icon animates toward HUD counter |

---

## Victory & Defeat Conditions

### Victory

- Survive all 15 zombie waves and 5 invader waves
- The General is defeated
- Display: Victory screen with stats (kills, gold earned, buildings placed, damage dealt)

### Defeat

- Castle HP reaches 0
- Display: Defeat screen showing wave reached, stats, and "Try Again" button

### Post-Game

- Return to lobby
- Room remains open for rematch
- Stats summary displayed to all players

---

## Server Architecture

```
server/
├── Dockerfile                   # Multi-stage Docker build
├── .dockerignore
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma            # Database schema (players, matches, leaderboard)
│   └── migrations/              # Auto-generated migration files
├── src/
│   ├── game/
│   │   ├── GameEngine.ts        # Main game loop, tick system
│   │   ├── WaveManager.ts       # Wave scheduling, spawning, scaling
│   │   ├── EnemyManager.ts      # Enemy state, pathfinding, AI
│   │   ├── BuildingManager.ts   # Placement validation, building state
│   │   ├── CombatManager.ts     # Damage calculations, targeting
│   │   ├── EconomyManager.ts    # Gold tracking, transactions
│   │   └── CastleManager.ts     # Castle HP, upgrades, repair
│   ├── rooms/
│   │   ├── Room.ts              # Room state, player management
│   │   └── RoomManager.ts       # Room lifecycle, matchmaking
│   ├── socket/
│   │   ├── SocketHandler.ts     # Socket.io event routing
│   │   └── events.ts            # Event type definitions
│   ├── pathfinding/
│   │   ├── AStar.ts             # A* algorithm implementation
│   │   └── Grid.ts              # Pathfinding grid
│   ├── db/
│   │   ├── prismaClient.ts     # Prisma client singleton
│   │   ├── playerRepository.ts  # Player CRUD operations
│   │   └── matchRepository.ts   # Match history & leaderboard queries
│   ├── cache/
│   │   ├── redisClient.ts       # Redis client singleton + connection
│   │   ├── roomCache.ts         # Room state cache (for reconnection)
│   │   └── sessionCache.ts      # Player session mapping
│   ├── config/
│   │   ├── gameConfig.ts        # All balance numbers, tuning values
│   │   └── serverConfig.ts      # Port, tick rate, room limits, DB/Redis URLs
│   ├── utils/
│   │   └── math.ts              # Vector math, distance helpers
│   └── index.ts                 # Entry point, Express + Socket.io + DB + Redis setup
├── package.json
└── tsconfig.json
```

### Server Responsibilities

- Validate all building placements (collision, path blocking, gold check)
- Run combat calculations (damage, targeting, AoE)
- Manage wave spawning and enemy AI
- Broadcast authoritative state updates to all clients
- Handle room lifecycle (create, join, leave, cleanup)
- Run the game loop at a fixed tick rate
- Cache active room state in Redis (enables player reconnection)
- Persist match results and player stats to PostgreSQL on game end
- Handle player session recovery via Redis session mapping

---

## Client Architecture

```
client/
├── src/
│   ├── scene/
│   │   ├── SceneManager.ts      # Three.js scene setup, lighting, fog
│   │   ├── CameraController.ts  # Zoom, rotate, pan controls
│   │   └── GridRenderer.ts      # Visual grid overlay
│   ├── entities/
│   │   ├── EnemyRenderer.ts     # Enemy 3D models, animations
│   │   ├── BuildingRenderer.ts  # Building 3D models, placement preview
│   │   ├── CastleRenderer.ts    # Castle model, damage states
│   │   └── ProjectileRenderer.ts # Arrows, cannonballs, bombs
│   ├── ui/
│   │   ├── HUD.ts               # Gold, wave, timer, HP display
│   │   ├── BuildPanel.ts        # Building selection sidebar
│   │   ├── WarningOverlay.ts    # Wave warning visuals
│   │   └── GameOverScreen.ts    # Victory/defeat screen
│   ├── effects/
│   │   ├── ParticleSystem.ts    # Smoke, fire, debris particles
│   │   ├── DamageNumbers.ts     # Floating damage text
│   │   └── DayNightCycle.ts     # Lighting transitions
│   ├── socket/
│   │   ├── SocketClient.ts      # Socket.io client wrapper
│   │   └── StateSync.ts         # Server state → client state mapping
│   ├── input/
│   │   ├── DragDropHandler.ts   # Building placement drag & drop
│   │   └── InputManager.ts      # Keyboard + mouse input routing
│   ├── audio/
│   │   ├── AudioManager.ts      # Sound loading, playback, volume
│   │   └── MusicManager.ts      # Background music, transitions
│   ├── config/
│   │   └── clientConfig.ts      # Asset paths, UI constants
│   └── main.ts                  # Entry point, init scene + socket
├── public/
│   ├── assets/
│   │   ├── models/              # 3D models (.glb/.gltf)
│   │   ├── textures/            # Texture files
│   │   ├── audio/               # Sound effects + music
│   │   └── fonts/               # UI fonts
│   └── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Client Responsibilities

- Render 3D scene (Three.js)
- Animate entities (GSAP)
- Handle camera controls
- Render UI (HUD, build panel, warnings)
- Send player **intents** to server (place, move, sell, upgrade)
- Receive and apply authoritative state updates from server
- Play audio and visual effects

---

## Networking Model

### Protocol

- **Transport:** Socket.io (WebSocket with fallback)
- **Server tick rate:** 20 ticks/second (50ms interval)
- **Client render rate:** 60 FPS (independent of tick rate)

### Client-Server Communication

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `place_building` | `{ type, gridX, gridY }` |
| Client → Server | `move_building` | `{ buildingId, gridX, gridY }` |
| Client → Server | `sell_building` | `{ buildingId }` |
| Client → Server | `upgrade_castle` | `{ upgradeType }` |
| Client → Server | `repair_castle` | `{}` |
| Server → Client | `game_state` | Full/delta state snapshot |
| Server → Client | `enemy_spawned` | `{ id, type, spawnEdge, ... }` |
| Server → Client | `enemy_died` | `{ id, killerId, goldReward }` |
| Server → Client | `building_placed` | `{ id, type, gridX, gridY, ownerId }` |
| Server → Client | `building_destroyed` | `{ id }` |
| Server → Client | `damage_dealt` | `{ targetId, amount, remainingHP }` |
| Server → Client | `wave_start` | `{ waveNumber, waveType, enemyCount }` |
| Server → Client | `wave_warning` | `{ waveNumber, waveType, countdown }` |
| Server → Client | `game_over` | `{ result, stats }` |

### State Synchronization

- Server sends **delta updates** each tick (only changed entities)
- Full state snapshot sent on player join
- Client uses **interpolation** to smooth entity movement between ticks
- Client-side prediction for building placement preview (confirmed/rejected by server)

### Reconnection Flow

1. Player disconnects — server keeps room alive, stores session in Redis (`session:{socketId}`, TTL 5 min)
2. Player reconnects — server looks up session in Redis, maps to room
3. Server sends full game state snapshot from Redis cache
4. Player resumes with no data loss

### Scaling (Future)

- Socket.io adapter: `@socket.io/redis-adapter` — allows multiple server instances to share rooms via Redis pub/sub
- Stateless server containers behind a load balancer
- PostgreSQL handles persistent data; Redis handles ephemeral game state

---

## Cross-Browser & Cross-Device Compatibility

### Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90+ | Primary development target |
| Firefox | 90+ | Full support |
| Safari | 15+ | WebGL2 required; test AudioContext resume on first interaction |
| Edge | 90+ | Chromium-based, same as Chrome |
| Mobile Chrome (Android) | 90+ | Touch controls enabled |
| Mobile Safari (iOS) | 15+ | Test WebGL memory limits on older devices |

### Required Web APIs

| API | Purpose | Fallback |
|-----|---------|----------|
| WebGL2 | Three.js rendering | Show "WebGL not supported" message |
| WebSocket | Socket.io real-time | Socket.io auto-falls back to HTTP long-polling |
| Web Audio API | Sound effects + music | Silent mode (game still playable) |
| Pointer Events | Unified mouse/touch input | Mouse + Touch event fallback |
| Gamepad API | Optional controller support (stretch) | Keyboard/mouse/touch only |

### Responsive Design

| Screen | Layout Adjustments |
|--------|-------------------|
| Desktop (1280px+) | Full UI — sidebar build panel on left, HUD on top |
| Tablet (768px–1279px) | Collapsed build panel (tap to expand), slightly larger touch targets |
| Mobile (< 768px) | Bottom build panel (horizontal scroll), enlarged HUD, simplified particle effects |

### Touch Controls (Mobile/Tablet)

| Action | Desktop Input | Touch Input |
|--------|--------------|-------------|
| Select building | Left click panel | Tap panel |
| Place building | Left click grid | Tap grid tile |
| Cancel placement | Right click / ESC | Tap cancel button or back gesture |
| Camera zoom | Scroll wheel | Pinch gesture |
| Camera rotate | Right drag | Two-finger rotate |
| Camera pan | WASD / Edge scroll | One-finger drag on empty area |
| Move building | Click + drag | Long press + drag |
| Sell building | Select → Delete key | Select → tap sell button |

### Adaptive Quality

Client auto-detects device capability and adjusts rendering:

| Setting | High (Desktop) | Medium (Tablet) | Low (Mobile) |
|---------|----------------|-----------------|--------------|
| Shadow maps | Yes | Simplified | Off |
| Particle count | 100% | 50% | 25% |
| Fog quality | Volumetric | Linear fog | Minimal |
| Texture resolution | Full | Half | Quarter |
| Max visible enemies | 50 | 35 | 20 |
| Anti-aliasing | MSAA 4x | FXAA | Off |

Detection via: `navigator.hardwareConcurrency`, `renderer.capabilities`, screen size, and `navigator.userAgent` for known low-end devices.

### Cross-Device Play

- Desktop and mobile players can be in the **same room** — no platform separation
- Game logic is identical regardless of device (server-authoritative)
- All browsers connect to the same server; no browser-specific server behavior
- Players on different networks/locations connect via the public server URL

---

## Deployment

### Architecture Overview

```
                    ┌─────────────────────┐
                    │   CDN (Cloudflare)   │
  Players ────────▶│   Static client      │
  (any browser)    │   assets (Vite build) │
                    └────────┬────────────┘
                             │ WebSocket + API
                             ▼
                    ┌─────────────────────┐
                    │   VPS / Cloud Host   │
                    │  ┌───────────────┐  │
                    │  │  Nginx        │  │
                    │  │  (reverse     │  │
                    │  │   proxy + SSL)│  │
                    │  └───────┬───────┘  │
                    │          │          │
                    │  ┌───────▼───────┐  │
                    │  │ Docker Compose │  │
                    │  │  ┌─────────┐  │  │
                    │  │  │ server  │  │  │
                    │  │  │ :3000   │  │  │
                    │  │  ├─────────┤  │  │
                    │  │  │postgres │  │  │
                    │  │  │ :5432   │  │  │
                    │  │  ├─────────┤  │  │
                    │  │  │ redis   │  │  │
                    │  │  │ :6379   │  │  │
                    │  │  └─────────┘  │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

### Hosting Options

| Option | Provider Examples | Good For |
|--------|-------------------|----------|
| VPS (recommended to start) | DigitalOcean, Hetzner, Linode | Simple, cheap, full Docker Compose support |
| PaaS with Docker | Railway, Render, Fly.io | Easy deploy, managed SSL, auto-scaling |
| Cloud VM | AWS EC2, GCP Compute, Azure VM | Full control, scale later |

### Deployment Steps

#### 1. Provision a VPS

- Minimum: 2 vCPU, 4GB RAM, 40GB SSD
- Install Docker + Docker Compose
- Open ports: 80 (HTTP), 443 (HTTPS), 22 (SSH)

#### 2. Domain & SSL

- Point a domain (e.g., `zombiezone.dev`) to the server IP
- Use Nginx as reverse proxy with Let's Encrypt SSL (free HTTPS)

```nginx
# /etc/nginx/sites-available/zombiezone
server {
    listen 443 ssl http2;
    server_name zombiezone.dev;

    ssl_certificate     /etc/letsencrypt/live/zombiezone.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zombiezone.dev/privkey.pem;

    # Static client files
    location / {
        root /var/www/zombiezone/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket + API proxy to Docker server
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name zombiezone.dev;
    return 301 https://$host$request_uri;
}
```

#### 3. Deploy

```bash
# On the server
git clone <your-repo> /opt/zombiezone
cd /opt/zombiezone

# Copy and edit environment variables
cp .env.example .env
nano .env  # Set production DB password, NODE_ENV=production

# Build and start backend services
docker compose -f docker-compose.yml up -d --build

# Build client (static files)
cd client && npm ci && npm run build

# Copy built client to Nginx web root
cp -r dist /var/www/zombiezone/client/dist

# Verify
curl https://zombiezone.dev        # Should serve client
curl https://zombiezone.dev/api/health  # Should return OK from server
```

#### 4. Client Configuration

The client needs to know the server URL. Configure via Vite environment variable:

```env
# client/.env.production
VITE_SERVER_URL=https://zombiezone.dev
```

```typescript
// client/src/socket/SocketClient.ts
const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3000');
```

### docker-compose.prod.yml (Production Overrides)

```yaml
services:
  server:
    restart: always
    environment:
      NODE_ENV: production
    volumes: []  # No source mounts in production
    deploy:
      resources:
        limits:
          memory: 1G

  postgres:
    restart: always
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # Must be strong in production
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
```

```bash
# Production start command
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### CI/CD (Optional)

```bash
# Simple deploy script: deploy.sh
#!/bin/bash
set -e
cd /opt/zombiezone
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
cd client && npm ci && npm run build
cp -r dist /var/www/zombiezone/client/dist
echo "Deployed successfully"
```

Trigger via GitHub Actions, or just SSH and run `./deploy.sh`.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Client FPS (desktop) | 60 FPS on mid-range hardware |
| Client FPS (mobile) | 30 FPS on mid-range phones (2022+) |
| Server tick rate | 20 ticks/second |
| Max enemies per wave | 50 simultaneously active |
| Max buildings per room | 100 |
| Network latency tolerance | Playable up to 200ms |
| Max concurrent rooms per server | 50 |
| Initial load time (desktop) | < 5 seconds on broadband |
| Initial load time (mobile) | < 8 seconds on 4G |
| Client bundle size | < 2MB gzipped (excluding 3D assets) |
| WebSocket reconnect time | < 3 seconds on stable connection |
