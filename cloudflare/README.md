Cloudflare deployment notes

This repo contains a Cloudflare Worker-based API at `cloudflare/worker.js` that uses Cloudflare D1 for persistence and a signed JWT cookie for session state.

Quick steps to deploy the API:

1. Install Wrangler (Cloudflare CLI):

```bash
npm install -g wrangler
```

2. Log in and configure:

```bash
Cloudflare deployment notes

This repo contains a Cloudflare Worker-based API at `cloudflare/worker.js` that uses Cloudflare D1 for persistence and issues JWT tokens in responses for authentication.

Quick steps to deploy the API:

1. Install Wrangler (Cloudflare CLI):

```bash
npm install -g wrangler
```

2. Log in and configure:

```bash
wrangler login
```

3. Create a D1 database in the Cloudflare dashboard named `aviva_db` (or update `wrangler.toml`).

4. Set secrets and bindings:
- Set `JWT_SECRET` in your Worker environment (recommended) via `wrangler secret put JWT_SECRET` or in the dashboard.

5. Publish the worker:

```bash
wrangler publish
```

Notes:
- Static files (`public/`) are best deployed to Cloudflare Pages and have the API proxied to the Worker or you can host static assets on any static host and point the frontend to the Worker endpoints.
- The Worker now returns JWT tokens in JSON for `/api/login` and `/api/register`. The static client stores the token in `localStorage` and sends it in `Authorization: Bearer <token>` headers.
- If your Worker is not routed to the Pages domain, set the global `API_BASE` before the client loads or in the browser console, for example:

```html
<script>window.API_BASE = 'https://your-worker-subdomain.workers.dev'</script>
```

- For production, configure CORS more strictly (replace `*` with your Pages domain) and secure your `JWT_SECRET`.

If you want, I can add a small example showing how to route the Worker to the Pages domain or switch to a different auth pattern.
