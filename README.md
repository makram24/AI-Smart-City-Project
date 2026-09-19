# AI Smart City Project

A Budapest-focused smart city assistant: an interactive map, AI chat, and live urban data for navigation, public transport, and nearby services.

The application lives in [`smart-city-app/`](smart-city-app/). Longer guides, phase notes, and presentation materials are in [`docs/`](docs/README.md).

## Features

- Interactive Leaflet map with geolocation, custom markers, and route polylines
- AI chat (OpenAI when configured, rule-based fallback otherwise)
- Place search via Nominatim and Overpass (OpenStreetMap)
- Walking, cycling, and driving routes via OpenRouteService
- Budapest public transport via BKK FUTÁR (stops, arrivals, journeys, disruptions)
- MOL Bubi bike sharing, weather context, neighborhood playbooks, and safety overlays
- Graceful fallback to mock data when external APIs are unavailable

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Leaflet |
| Backend | Express.js, TypeScript |
| External APIs | BKK FUTÁR, OpenRouteService, Open-Meteo, Nominatim, Overpass, optional OpenAI |

## Repository layout

```
.
├── README.md                 # You are here
├── docs/                     # Setup, API guides, phases, presentations
└── smart-city-app/           # Application code
    ├── src/                  # Next.js frontend
    ├── backend/              # Express API
    └── docker-compose.yml
```

## Quick start

**Requirements:** Node.js 18+ and npm.

### 1. Frontend

```bash
cd smart-city-app
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### 2. Backend

```bash
cd smart-city-app/backend
npm install
copy env.example .env
npm run dev
```

On macOS/Linux use `cp env.example .env` instead of `copy`. The API listens on [http://localhost:3001](http://localhost:3001).

### 3. Environment variables

Edit `smart-city-app/backend/.env`. Do not commit this file or put real keys in documentation.

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

OPENROUTESERVICE_API_KEY=your_key_here
BKK_API_KEY=your_key_here
BKK_API_ENABLED=true

# Optional
# OPENAI_API_KEY=your_key_here
# OPENWEATHER_API_KEY=your_key_here
# MOL_BUBI_API_ENABLED=false
```

See [API keys](docs/setup/API_KEYS_NEEDED.md) for what each service does. The app runs without keys using mock or free public data.

### Docker (optional)

```bash
cd smart-city-app
docker compose up --build
```

## Documentation

| Topic | Start here |
| --- | --- |
| Documentation index | [docs/README.md](docs/README.md) |
| API keys and services | [docs/setup/API_KEYS_NEEDED.md](docs/setup/API_KEYS_NEEDED.md) |
| Phase overview | [docs/project/PHASES_QUICK_REFERENCE.md](docs/project/PHASES_QUICK_REFERENCE.md) |
| App-specific notes | [smart-city-app/README.md](smart-city-app/README.md) |

## License

Academic project for the AI Smart City initiative (Budapest / BME).
