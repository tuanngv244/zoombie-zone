# How to Play - Zombie Zone

## Overview

Zombie Zone is a cooperative tower defense game where players defend their castles against waves of zombies and invaders. Build walls, place towers, and survive 15 waves of increasingly dangerous enemies.

---

## Game Phases

### 1. Lobby
- Create or join a room using a room code
- Share the room link with friends to play together (up to 4 players)
- The room creator starts the game when ready

### 2. Preparation Phase (2:30)
- Build defenses around your castle before the first wave
- You start with **500 gold**
- Place walls, towers, and traps on the grid
- A warning horn sounds 10 seconds before the wave begins

### 3. Wave Phase
- Zombies spawn from the map edges and march toward your castle
- Your buildings automatically attack enemies in range
- The **King** on your castle shoots lightning at nearby enemies
- Earn gold for every enemy killed

### 4. Wave Break (30 seconds)
- Short break between waves to repair and build more defenses
- Spend earned gold on new buildings or castle upgrades

### 5. Victory / Defeat
- **Victory**: Survive all 15 zombie waves (and 5 invader waves)
- **Defeat**: All player castles are destroyed

---

## Controls

| Action | Control |
|--------|---------|
| **Pan camera** | Arrow keys / WASD / drag middle mouse |
| **Zoom** | Mouse scroll wheel |
| **Select building** | Click a building card or press 1-9 |
| **Place building** | Click on the grid after selecting |
| **Cancel placement** | Right-click or press ESC |
| **Move building** | Double-click an existing building |
| **Sell building** | (Available through context menu) |

---

## Buildings

### Walls (Defensive)

| Building | Cost | HP | Size | Description |
|----------|------|----|------|-------------|
| Wooden Wall | 5 | 100 | 1x1 | Cheap barricade. Blocks enemy paths. |
| Stone Wall | 12 | 250 | 1x1 | Sturdy wall. Withstands more hits. |
| Brick Wall | 25 | 500 | 1x1 | Fortified wall. Very durable. |
| River Barrier | 20 | 150 | 2x1 | Water barrier that slows enemies by 50%. |

- Walls can be **stacked** — placing the same wall type on an existing wall increases its height and HP.
- Heavy Zombies deal **2x damage** to walls.

### Towers (Offensive)

| Building | Cost | DMG | Range | Speed | Size | Description |
|----------|------|-----|-------|-------|------|-------------|
| Arrow Tower | 25 | 8 | 5 | 1.0s | 2x1 | Fires arrows at the closest enemy. |
| Cannon | 50 | 25 | 6 | 3.0s | 2x2 | AoE cannonball in a 2-tile radius. |
| Ballista | 35 | 40 | 8 | 2.5s | 2x1 | Piercing bolt hits up to 2 enemies in a line. |
| Explosive Mine | 10 | 80 | 0 | - | 1x1 | One-time trap. Explodes when enemy steps on it (1.5-tile AoE). |
| Hot Air Balloon | 80 | 30 | 4 | 4.0s | 2x2 | Aerial bomber. Drops AoE bombs (2-tile radius). |

- All offensive buildings **automatically attack** enemies within their range.
- Multiple buildings can attack the same enemies simultaneously.
- Buildings are destroyed if enemies deal enough damage to them.

---

## Castle

Each player has a **castle** (4x4 tiles) with:
- **1000 base HP**
- A **King** who shoots **lightning** at enemies within 6 tiles, dealing **50 damage** every 3 seconds
- Access to castle upgrades

### Castle Upgrades

| Upgrade | Cost | Effect |
|---------|------|--------|
| Fortify I | 100 | +300 Max HP |
| Fortify II | 200 | +500 Max HP (requires Fortify I) |
| Treasury | 150 | +2 gold per enemy kill |
| Repair | 50 | Restore 200 HP (can be purchased repeatedly) |

### Castle Damage States
- **Healthy (>60% HP)**: Normal warm stone glow
- **Damaged (30-60% HP)**: Orange tint, visible cracks appear
- **Critical (<30% HP)**: Red glow, all cracks visible, fire effects

---

## Enemies

### Zombies

| Type | HP | Speed | Damage | Gold | Special |
|------|-----|-------|--------|------|---------|
| Normal Zombie | 50 | 1.0 | 5 | 5 | - |
| Fast Zombie | 30 | 2.0 | 4 | 8 | Fast movement |
| Heavy Zombie | 150 | 0.6 | 10 | 12 | 2x damage to walls |
| Zombie Boss | 1000 | 0.8 | 25 | 50 | AoE ground slam (40 DMG, 3-tile radius, every 10s) |

### Invaders (appear after certain waves)

| Type | HP | Speed | Damage | Gold | Special |
|------|-----|-------|--------|------|---------|
| Soldier | 80 | 1.2 | 8 | 10 | Shield |
| Elite Soldier | 200 | 1.0 | 15 | 20 | Rally |
| General | 3000 | 0.7 | 40 | 200 | War Cry (heals nearby allies 10% HP every 15s) |

### Enemy Scaling
Each wave increases enemy difficulty:
- **HP**: +15% per wave
- **Speed**: +5% per wave
- **Count**: +2 enemies per wave

---

## Wave Composition

| Waves | Enemies | Base Count |
|-------|---------|------------|
| 1-3 | 100% Normal | 8 |
| 4-6 | 70% Normal, 30% Fast | 12 |
| 7-9 | 50% Normal, 30% Fast, 20% Heavy | 16 |
| 10-12 | 40% Normal, 30% Fast, 30% Heavy | 20 |
| 13-14 | 30% Normal, 35% Fast, 35% Heavy | 25 |
| 15 | Same as 13-14 + 4 Zombie Bosses | 30 |

### Invader Waves
Invaders appear alongside zombie waves:
| After Wave | Soldiers | Elites | General |
|-----------|----------|--------|---------|
| 3 | 6 | 0 | No |
| 6 | 8 | 2 | No |
| 9 | 10 | 4 | No |
| 12 | 12 | 6 | No |
| 15 | 15 | 8 | Yes |

---

## Army Units (Multiplayer PvP)

Army units are a **multiplayer-only** feature. They allow you to send troops to attack another player's castle. In single-player mode, army units cannot be used since there is no enemy castle to target.

### How to Use Army Units
1. Select an army unit from the "Army" section of the build panel
2. Click anywhere on the grid to deploy it
3. The unit automatically paths toward the nearest enemy player's castle
4. Units attack the target castle once they arrive

### Army Unit Types

| Unit | Cost | HP | DMG | Range | Speed | Special |
|------|------|----|-----|-------|-------|---------|
| Swordsman | 30 | 60 | 8 | 1.5 | 1.2 | Melee infantry |
| Archer | 40 | 40 | 12 | 6 | 1.0 | Ranged attacker |
| Mage | 60 | 35 | 20 | 5 | 0.8 | AoE magic (2-tile radius) |
| Knight | 80 | 120 | 15 | 1.5 | 1.5 | Heavy cavalry |
| Commander | 120 | 200 | 25 | 2 | 1.0 | Buffs nearby allies |

---

## Economy

- **Starting gold**: 500 per player
- **Earning gold**: Kill enemies to earn gold rewards
- **Treasury upgrade**: +2 bonus gold per kill
- **Selling buildings**: Refund 50% of the original cost
- Gold is tracked **per player** — each player manages their own economy

---

## Tips & Strategy

1. **Build walls first** — create a maze to slow enemies and give your towers more time to attack
2. **Mix tower types** — Arrow Towers for fast single-target DPS, Cannons for AoE groups
3. **Use River Barriers** — the 50% slow effect makes enemies vulnerable for longer
4. **Stack walls** — placing the same wall type on itself increases height and HP
5. **Place Explosive Mines** near chokepoints for massive burst damage
6. **Upgrade your castle** — Fortify early for survivability, Treasury for long-term gold income
7. **The King helps!** — enemies near your castle take lightning damage automatically
8. **Watch for Boss waves** — Wave 15 spawns 4 Zombie Bosses with devastating AoE slams
9. **Ballistas are great against bosses** — 40 damage with 8-tile range and pierce
10. **Hot Air Balloons** are expensive but devastate clustered enemies
