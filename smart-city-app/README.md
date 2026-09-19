# Smart City app

Next.js frontend and Express backend for the Budapest city assistant.

Start with the [root README](../README.md) for setup, keys, and Docker. [Current status](../docs/STATUS.md) says what is live versus mock.

## Scripts

### Frontend (`smart-city-app/`)

- `npm run dev` — Next.js on port 3000
- `npm run build` / `npm start` — production
- `npm run lint` — ESLint

### Backend (`smart-city-app/backend/`)

- `npm run dev` — Express with nodemon on port 3001
- `npm test` — Vitest
- `npm run build` / `npm start` — compiled `dist/`

## Frontend structure

```
src/
├── app/           # Next.js routes
├── components/    # Map, chat, transport, playbooks
├── hooks/         # Application state
└── lib/           # API client and shared helpers
```

The UI talks to the backend only through `src/lib/api.ts`.
