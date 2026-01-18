Deploying the frontend to Cloudflare Pages and publishing the Worker API

Overview

- The static frontend lives in the `public/` folder.
- The Cloudflare Worker API is in `cloudflare/worker.js` and `wrangler.toml` is included.
- We'll publish Pages for static files and publish the Worker (or bind Worker to `/api/*` route).

Prerequisites

- Install `wrangler` (Cloudflare CLI) and log in.
- Have a Cloudflare account with a zone (for custom domain) or use the `workers.dev` / `pages.dev` subdomain.
- Create a D1 database named `aviva_db` in the Cloudflare dashboard and note the binding name if different.
- Set `JWT_SECRET` via `wrangler secret put JWT_SECRET` (recommended).

Commands (run locally)

1) Install Wrangler

```bash
npm install -g wrangler
```

2) Log in to Cloudflare

```bash
wrangler login
```

3) Publish static frontend to Pages

- From repo root, publish `public/` as a Pages project named `aviva-pages`.

```bash
wrangler pages project create aviva-pages
wrangler pages publish public --project-name=aviva-pages
```

This will return the pages URL (like `https://aviva-pages.pages.dev`).

4) Create or bind D1 database

- In the Cloudflare dashboard, go to D1 and create a database named `aviva_db` (or use `wrangler d1` if available). Ensure `wrangler.toml` points to it or update the binding.

5) Publish the Worker API

```bash
# From repo root (wrangler.toml exists and points to cloudflare/worker.js)
wrangler publish
```

This publishes the Worker. To use the Worker for `/api/*` on the same Pages domain, either:
- Add a Worker route in your Cloudflare dashboard: `yourdomain.com/api/*` -> select the published Worker
OR
- Use Pages Functions by copying API logic into the Pages Functions folder (advanced).

6) Set `JWT_SECRET` and other secrets

```bash
wrangler secret put JWT_SECRET
```

7) Test

- Open your Pages site URL and update `public/js/main.js` API URLs if needed (if Worker is on a different origin, point fetches to `https://<your-worker-or-domain>/api/...`).
- Register a user and login.

Notes and tips

- If you want the API to share the same origin as Pages (so relative `/api/*` works without CORS), configure the Worker route in the Cloudflare dashboard to handle `your-pages-domain/api/*`.
- For quick testing without a custom domain, use the `pages.dev` domain returned by `wrangler pages publish` and the `workers.dev` URL returned by `wrangler publish`, then update `public/js/main.js` to use the full Worker URL for API calls.
- Keep `JWT_SECRET` strong and never commit it.

Files of interest

- [wrangler.toml](wrangler.toml)
- [cloudflare/worker.js](cloudflare/worker.js)
- `public/` (static site root)

If you want, I can:
- Prepare a `pages` config or GitHub Actions workflow to auto-deploy on push,
- Update `public/js/main.js` to point to an explicit Worker URL (if you provide the Pages/Worker URLs), or
- Walk you through each CLI step interactively.
