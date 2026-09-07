# zego-api

GraphQL backend for ZeGo, running on Cloudflare Workers with D1 (database) and R2 (file storage).

This replaces the third-party GraphQL API the six ZeGo apps (multivendor admin/web/app/rider/store,
singlevendor admin) currently point at. The apps' code does not need to change — this API is being
built to match their existing GraphQL queries/mutations field for field.

## Cloudflare resources already provisioned on your account

- Worker: `zego-api` (this project deploys to it)
- D1 database: `zego-db` (id in `wrangler.toml`)
- R2 bucket: `zego-uploads`

## Deploy it yourself

1. **Install dependencies** (from this directory):
   ```bash
   npm install
   ```

2. **Log in to Cloudflare** (opens a browser to authorize the CLI):
   ```bash
   npx wrangler login
   ```

3. **Set the JWT signing secret** (used to sign/verify auth tokens — pick any long random string):
   ```bash
   npx wrangler secret put JWT_SECRET
   ```
   The Google OAuth client ID is already set as a plain var in `wrangler.toml` (`GOOGLE_CLIENT_IDS`)
   since it isn't sensitive — no secret needed for it.

4. **Apply the database schema** to the real (remote) D1 database:
   ```bash
   npm run db:migrate:remote
   ```
   (`npm run db:migrate:local` applies it to a local simulated database instead, for `wrangler dev`.)

5. **Deploy**:
   ```bash
   npm run deploy
   ```
   Wrangler will print the live URL, e.g. `https://zego-api.<your-subdomain>.workers.dev`.

6. **Point the frontends at it** — once deployed, update the GraphQL endpoint in each app's
   environment config (currently pointing at the old provider's API) to `https://<your-worker-url>/graphql`.
   I'll do this update once the full API surface is built, so it happens in one pass.

## Local development

```bash
npm run db:migrate:local   # first time only, or after adding a migration
npm run dev                # wrangler dev, served at http://localhost:8787/graphql
```

## Status

The GraphQL schema currently only exposes a `health` query as a smoke test. The full schema
(auth, restaurants, menus, orders, riders, reviews, coupons, config, etc.) is being built to
match exactly what the six apps already call, so none of their UI code has to change.
