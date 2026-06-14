# 🌟 The Mosaic Region — A Pokémon-Style RPG

> **v1.0** — A fully playable browser-based Pokémon RPG built entirely with AI assistance, powered by the Pokémon Showdown battle engine.

---

## 🤖 How This Was Built

This entire game was written in a single AI-assisted coding session using **Claude Code** (Anthropic's agentic coding assistant), with zero manual code written by the developer.

The process was conversational. The developer described what they wanted — *"make a Pokémon game"*, *"add a full region with 8 gyms"*, *"add a starter selection screen"*, *"make sure no two starters share a type"* — and Claude Code autonomously:

- Designed the entire system architecture from scratch
- Wrote all TypeScript across the frontend, backend, and shared game logic
- Set up PostgreSQL + Docker Compose for production-style deployment
- Debugged sprite rendering issues, Docker networking, and game balance in real time
- Built and rebuilt every feature iteratively based on simple natural language feedback

**This is a showcase of what's possible when you treat an AI as a true pair programmer.**

---

## ✨ Features

### 🎮 Full Playable RPG
- **8 Gym Badges** across a complete region: Verdant Hollow → Cerulean Deep → Ember Peak → Voltspire → Mindweave → Frostfell → Drakemaw → Shadowmere
- **14 Interconnected Maps** — towns, routes, and gyms with seamless transitions between them
- **Wild Pokémon encounters** in tall grass with day/night cycle affecting spawn tables
- **Trainer battles** on routes with proper AI opponents
- **Pokémon Centers** and **Shops** in every town

### 🎲 Randomized Starter Selection
Every new game is unique! On "New Game", the server picks **3 random Pokémon** from a pool of 37 classic 3-stage evolution lines (Bulbasaur, Bagon, Treecko, Mareep, etc.) and guarantees **no two starters share a type**. A premium animated UI lets you hover over animated pixel-art sprites before committing.

### ⚔️ Real Battle Engine
Battles are powered by the **Pokémon Showdown** battle simulator — the same engine used by millions of competitive players. This means:
- Accurate damage calculations, type matchups, and stat formulas
- All 1025+ Pokémon with real moves, abilities, and evolution lines
- Proper status effects, switching, and turn structure

### 🧠 Adaptive AI
The gym leaders and trainers use a custom AI decision brain built on `@smogon/calc`. Difficulty scales naturally:
- Early gym leaders play cautiously and make occasional mistakes
- Later gym leaders are aggressive, predict switches, and draft type-counter teams

### 💾 Save System
- **PostgreSQL-backed saves** in Docker (production mode)
- Autosave after every major event
- Continue from the title screen

### 🗺️ Region & Story
The **Mosaic Region** is themed around convergence — different Pokémon generations colliding into one world. Routes are biome-themed (Kanto plains → Johto forests → Hoenn beaches → Alola islands → Unova tech hubs → Kalos gardens → Sinnoh tundra → Paldea wilds → Galar countryside).

### 📱 Web-Based, Docker-Deployed
Runs entirely in a browser. No installation needed by the end user — just `docker-compose up` and navigate to `localhost:8080`.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Browser (Frontend)              │
│  Nginx · TypeScript · Vanilla CSS · Three.js    │
│                                                  │
│  Screens: Title → Starter → Overworld → Battle  │
│  Overlays: Pokédex · Trainer Card · Region Map  │
└───────────────────────┬─────────────────────────┘
                        │  HTTP REST API
┌───────────────────────┴─────────────────────────┐
│                 Node.js Backend                  │
│  Express · tsx · pokemon-showdown · @smogon/calc │
│                                                  │
│  Session → GameState → BattleBridge → AI Brain  │
└───────────────────────┬─────────────────────────┘
                        │  DATABASE_URL
┌───────────────────────┴─────────────────────────┐
│              PostgreSQL 15 (Docker)              │
│           Save slots stored as JSON blobs        │
└─────────────────────────────────────────────────┘
```

### Key Directories

| Path | Purpose |
|---|---|
| `server/` | Node.js backend — game session, save system, HTTP handler |
| `src/game/` | Pure game logic — state, stats, items, leveling, economy |
| `src/ai/` | AI decision brain, team composer, difficulty controller |
| `src/bridge/` | Wrapper over Pokémon Showdown's battle engine |
| `src/content/` | Region data — locations, trainers, gyms, encounter tables |
| `web/` | Frontend — Vite + TypeScript, all screens and UI |
| `web/overworld/` | 3D overworld renderer (Three.js) and map data |
| `web/battle/` | Battle screen UI (DOM-based, sprite animations) |
| `web/screens/` | Title, Starter, Pokédex, Shop, Trainer Card, Region Map |

---

## 🚀 Running Locally

### Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME
cd YOUR_REPO_NAME
docker-compose up --build
```

Then open your browser to **http://localhost:8080**

> ⚠️ **Note:** The `sprites-master` directory (Pokémon Showdown sprite assets, ~200MB) is not included in this repo. You will need to download it from the [PokeAPI sprites repository](https://github.com/PokeAPI/sprites) and place it at the root of the project. Battles and the Starter Screen will gracefully fall back to static `.png` sprites if animated `.gif` files are missing.

### Development Mode (Hot Reload)

```bash
npm install
npm run dev       # starts the backend server + Vite dev server concurrently
```

Then open **http://localhost:5173**

---

## 🗂️ Progress (v1)

### ✅ Complete
- [x] Battle engine integration (Pokémon Showdown)
- [x] Full game state (party, items, money, Pokédex, save/load)
- [x] Adaptive AI — decision brain + team composer + difficulty scaling
- [x] Economy — shops, bag, Pokémon Center healing, badge-gated stock
- [x] Leveling, EXP, level-ups, move learning, evolution
- [x] Full 8-badge region with 14 maps, encounter tables, and trainers
- [x] Day/night cycle affecting wild encounters
- [x] Vs-Seeker trainer rematches
- [x] Title screen with "New Game" / "Continue" / "Options"
- [x] **Randomized starter selection** (no same-type repeats, all 3-stage evolution lines)
- [x] Pokédex screen
- [x] Trainer Card screen
- [x] Region Map screen
- [x] Shop UI
- [x] Pokémon Center overlay
- [x] Overworld movement with tile-based map transitions
- [x] Wild battle encounters in tall grass
- [x] Catching Pokémon with Poké Balls
- [x] PostgreSQL save system + Docker Compose deployment
- [x] Pixel-art sprite animations in battle (`.gif` with `.png` fallback)

### 🔜 Planned (v2+)
- [ ] Sound effects and background music
- [ ] Move animations in battle
- [ ] Full Elite Four / Champion sequence
- [ ] Story dialogue and NPC cutscenes
- [ ] Player character sprite in the overworld
- [ ] Mobile / touch controls
- [ ] Nuzlocke mode
- [ ] Online leaderboard / Pokédex completion tracking

---

## 🙏 Credits

This game would not exist without these open-source projects:

| Project | Usage |
|---|---|
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) | Battle simulation engine |
| [@smogon/calc](https://github.com/smogon/damage-calc) | Damage calculation for AI |
| [PokeAPI Sprites](https://github.com/PokeAPI/sprites) | Pixel-art Pokémon sprites |
| [Three.js](https://threejs.org/) | 3D overworld rendering |
| [Vite](https://vitejs.dev/) | Frontend build tooling |
| [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) | CC0 3D character assets |
| [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) | CC0 3D environment assets |

> Pokémon and all related names are trademarks of Nintendo / Game Freak. This is a fan project, non-commercial, built for educational and experimental purposes.

---

## ⚖️ Legal Disclaimer

**Pokémon** and all related names, characters, and media are trademarks of **Nintendo**, **Game Freak**, and **The Pokémon Company**. This project is **not affiliated with, endorsed by, or sponsored by** Nintendo, Game Freak, or The Pokémon Company in any way.

This is a **non-commercial fan project** created purely for educational and experimental purposes — specifically to explore what's possible when building a game entirely with AI coding assistance. No money is made from this project. No official Pokémon assets (sprites, music, or ROMs) are distributed in this repository.

Please support the official games! 🎮

---

## 📄 License

MIT — see [LICENSE](LICENSE)
