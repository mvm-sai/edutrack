# Free deployment guide — Cloudflare Pages + Fly.io + Supabase

This guide shows a low-cost, minimal-refactor way to publish your app without paying (avoid Render & Railway):

- Frontend: Cloudflare Pages (static Vite site)
- Backend: Fly.io (run your existing Node server in a small VM)
- Database & Auth: Supabase (free Postgres + Auth)

Why this combo
- Keeps your existing Node `backend` as-is (no serverless refactor).
- Frontend is served as a static site on Pages for fast, free delivery.
- Supabase provides a managed Postgres and Auth on a generous free tier.

Quick overview
1. Create a free Supabase project and restore/migrate your DB.
2. Deploy `frontend` to Cloudflare Pages.
3. Deploy `backend` to Fly.io using the existing `backend/Dockerfile`.
4. Set environment variables / secrets on Supabase and Fly.
5. Point frontend API calls to the Fly backend domain and configure CORS.

Commands (local)

Build frontend (from repo root):

```bash
cd frontend
npm install
npm run build
```

Deploy frontend (Cloudflare Pages — recommended via Git integration):

- Option A (fast, UI): Connect your GitHub repo to Cloudflare Pages and set build command `npm run build` with output directory `dist`.
- Option B (CLI): Install `wrangler` and run `wrangler pages publish ./dist --project-name=your-project-name`.

Supabase (DB + Auth)

1. Create a free project at https://app.supabase.com.
2. Note the `DATABASE_URL` and `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
3. Run migrations: from the `backend` folder, apply `data/migrations/001-initial.sql` via psql or Supabase SQL editor.

Example using psql (replace values):

```bash
psql "postgres://user:password@host:port/database" -f backend/data/migrations/001-initial.sql
```

Backend (Fly.io)

Prereq: `flyctl` installed and logged in.

From repo root:

```bash
cd backend
flyctl launch --name edutrack-backend --region ord  # follow prompts; select Dockerfile
flyctl secrets set DATABASE_URL="<your_database_url>" SUPABASE_SERVICE_ROLE_KEY="<key>" NODE_ENV=production
flyctl deploy
```

Notes:
- The repo already contains `backend/Dockerfile`; Fly will build and run your Node server.
- Set any other env vars used in `backend` (`JWT_SECRET`, `PORT`, etc.) via `flyctl secrets set`.

CORS & frontend config

- Update your frontend API base URL to the Fly hostname (e.g., `https://edutrack-backend.fly.dev`).
- In `backend`, ensure `src/middleware/auth.js` and any CORS config allow the Cloudflare Pages origin.

Alternate minimal options
- Host frontend on GitHub Pages and backend on Fly.io (if you prefer GitHub).
- Use Vercel instead of Cloudflare Pages if you prefer simpler serverless functions (still free for basic usage).

Optional follow-ups I can do for you
- Add a `fly.toml` config and test-deploy scripts in `backend`.
- Create Cloudflare Pages `wrangler` config or GitHub Actions workflow for automatic deploys.
- Convert one `backend` route into a serverless function (example) if you want to move to Pages/Workers or Vercel.

If you want, tell me which path to automate and I'll add the `fly.toml`, a CI workflow, or convert a route as an example.
