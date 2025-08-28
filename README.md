
# Chimney Solutions CRM (Next.js + MongoDB)

- Pages Router (no TypeScript), Tailwind CSS
- JWT auth with httpOnly cookie
- Admin seed with `ADMIN_PASSWORD` (default `Chimneysolution@123#`)
- Polling-based realtime (15s) for technician calls
- Backend pagination on all heavy endpoints
- CSV Export for forms & payments
- Signature capture on service form and payment receiver

## Run locally

1. Copy `.env.example` to `.env.local` and fill values (MONGO_URI, JWT_SECRET, ADMIN_PASSWORD).
2. `npm install`
3. `npm run dev`

## Deploy on Vercel

- Push this repo or import to Vercel.
- Add environment variables from `.env.example`.
- Set Node.js 18+ runtime (default ok).
- No server state; uses MongoDB Atlas.

