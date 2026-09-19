# API keys

Copy `smart-city-app/backend/env.example` to `smart-city-app/backend/.env`. Never commit real keys.

The app starts without keys. Missing keys fall back to mock data or free public APIs.

| Service | Env vars | Required? | Fallback |
| --- | --- | --- | --- |
| Open-Meteo weather | none | No | Always available |
| Nominatim / Overpass | none | No | Rate-limited public OSM |
| OpenRouteService | `OPENROUTESERVICE_API_KEY` | For real walking/cycling geometry | Straight-line estimate |
| BKK FUTÁR | `BKK_API_KEY`, `BKK_API_ENABLED=true` | For live Budapest transit | Mock stops and arrivals |
| OpenAI | `OPENAI_API_KEY` | For LLM chat | Rule-based replies |
| MOL Bubi | `MOL_BUBI_API_ENABLED=true` | Optional | Mock bike stations |

Setup details:

- [OpenRouteService](OPENROUTESERVICE_SETUP.md)
- [BKK FUTÁR](BKK_API_SETUP.md)

Also set `CORS_ORIGIN=http://localhost:3000` so the API only accepts the frontend origin.
