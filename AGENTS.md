# MUNAJ BAR — Admin Panel

## Stack
- Vite 6 + React 19 + TypeScript frontend
- Express server (`server.ts`) with Vite middleware in dev mode (single origin on port 3000)
- Supabase (hosted) for database, auth, and realtime — **not** local infra
- `@google/genai` (Gemini) dependency present but not directly imported in src/server
- QZ Tray integration for direct thermal receipt printing (server-side signing)

## Running locally (Base44)
```
docker compose -f docker-compose.base44.yml up -d
```
- Node 22 slim image, source bind-mounted at `/app`, `node_modules` in a named volume
- Starts with `npm install && npx tsx server.ts` — Express serves Vite dev middleware on port 3000
- HMR is enabled (`DISABLE_HMR=false`); Vite host allowlisting handled via `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`

## Environment variables
The app has **hardcoded defaults** for Supabase URL and anon key in `src/lib/supabase.ts` and `server/*.ts`, so it boots without any credentials. All env vars are optional for startup:

| Variable | Purpose | Required at boot |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (frontend) | No (has default) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key (frontend) | No (has default) |
| `SUPABASE_URL` | Supabase project URL (server) | No (has default) |
| `SUPABASE_SECRET_KEY` | Supabase service_role key (server admin ops) | No (empty default = admin delete features degrade) |
| `GEMINI_API_KEY` | Google Gemini API key | No |
| `QZ_CERTIFICATE` | QZ Tray signing cert (PEM) | No |
| `QZ_PRIVATE_KEY` | QZ Tray signing key (PEM) | No |

Real secrets are delivered via `/run/base44/app.env` (last `env_file` entry in compose); placeholders in `.env.base44-defaults` are overridden by it.

## Verifying it works
- `curl localhost:3000/api/health` → `{"status":"ok"}`
- `curl localhost:3000/` → HTML with Vite HMR client injected (dev mode confirmed)
- `curl localhost:3000/src/main.tsx` → 200 (Vite serving source modules)

## Build
- `npm run build` — Vite build + esbuild server bundle → `dist/`
- `npm run start` — production mode (`node dist/server.cjs`)
- `npm run lint` — `tsc --noEmit`

## Notes
- Supabase schema/migrations live in `supabase/` — these are applied to the hosted Supabase project, not local infra
- The app is a POS admin panel: dashboard, sales, products, inventory, workers, shifts, receipts, reports, settings
