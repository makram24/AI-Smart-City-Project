# AI Smart City

A Budapest city assistant: interactive map, chat, and urban data for places, routes, and public transport.

The app lives in [`smart-city-app/`](smart-city-app/). Setup guides are in [`docs/`](docs/README.md). See [current status](docs/STATUS.md) for what is live versus mock.

## What it does

- Leaflet map with geolocation, markers, and route polylines
- Chat with OpenAI when a key is set, otherwise rule-based replies
- Place search via Nominatim and Overpass (OpenStreetMap)
- Walking and cycling routes via OpenRouteService when configured
- Budapest public transport via BKK FUTÁR when configured; otherwise mock data
- Weather (Open-Meteo), bike-share stubs, neighborhood playbooks, and a safety overlay

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Leaflet |
| Backend | Express.js, TypeScript |
| Tests / CI | Vitest + GitHub Actions |
| External APIs | BKK FUTÁR, OpenRouteService, Open-Meteo, Nominatim, Overpass, optional OpenAI |

## Quick start

**Requirements:** Node.js 18+ and npm.

### Frontend

```bash
cd smart-city-app
npm install
npm run dev
```

Opens at http://localhost:3000.

### Backend

```bash
cd smart-city-app/backend
npm install
copy env.example .env
npm run dev
```

On macOS/Linux use `cp env.example .env`. The API listens on http://localhost:3001.

### Environment

Edit `smart-city-app/backend/.env`. Do not commit this file.

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

OPENROUTESERVICE_API_KEY=your_key_here
BKK_API_KEY=your_key_here
BKK_API_ENABLED=true
```

The app runs without keys using mock or free public data. See [API keys](docs/setup/API_KEYS_NEEDED.md).

### Docker

```bash
cd smart-city-app
docker compose up --build
```

Copy `backend/env.example` to `backend/.env` first if you want real API keys in the container.

### Tests

```bash
cd smart-city-app/backend
npm test
```

## Repository layout

```
.
├── README.md
├── docs/                 # Setup guides and current status
│   └── archive/          # Course slides and old phase notes
└── smart-city-app/       # Application
    ├── src/              # Next.js frontend
    └── backend/          # Express API
```

## License

Academic / portfolio project for the AI Smart City initiative (Budapest / BME).
