# Current status

Honest snapshot of what the app does today. Use this instead of old phase checklists.

## Live by default

- OpenStreetMap geocoding (Nominatim) and place search (Overpass)
- Weather via Open-Meteo (no API key)
- Interactive Leaflet map, chat UI, neighborhood playbooks, stories, and safety overlay

## Live when you add keys

| Feature | Env | If missing |
| --- | --- | --- |
| Walking / cycling routes | `OPENROUTESERVICE_API_KEY` | Straight-line fallback |
| Budapest transit (BKK FUTÁR) | `BKK_API_KEY` + `BKK_API_ENABLED=true` | Mock stops and arrivals |
| AI chat | `OPENAI_API_KEY` | Rule-based replies |
| MOL Bubi | `MOL_BUBI_API_ENABLED=true` | Mock bike stations |

## Still demo-grade

- Community feedback is stored in a local JSON file, not a shared database
- Safety scores use curated construction zones plus heuristic lighting/area rules
- Stories are curated content, not a live CMS
- The UI is usable on a phone (stacked panels) but is still a desktop-first map app

## What this is not

This is a portfolio / academic full-stack project, not a production transit product. It does not claim live BKK data unless those env flags are set.
