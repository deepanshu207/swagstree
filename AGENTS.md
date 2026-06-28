# Swag Stree

Swag Stree is a static front-end e-commerce web app (vanilla HTML/CSS/JS, no framework, no build step). It is served locally with Cloudflare Wrangler and talks directly to a live remote **Firebase** backend (project `swagstree-web`: Firestore + Auth + Storage). Third-party integrations (Cloudinary, Brevo, Telegram, Gemini, Nominatim) are optional and key-gated via Firestore admin settings.

## Cursor Cloud specific instructions

- This repo has **no build, lint, or automated test setup**. The only tooling dependency is `wrangler` (pinned in `package.json`). Source lives in `index.html`, `js/*.js`, `css/style.css`, `assets/`.
- Run the dev server from the repo root with:
  `npx wrangler dev --ip 0.0.0.0 --port 8787 --persist-to /tmp/swagstree-wrangler-state`
- The `--persist-to <dir outside the repo>` flag is **required to avoid an infinite reload loop**. The assets directory in `wrangler.jsonc` is the repo root (`.`), so Wrangler watches the whole repo; its default `.wrangler/state` cache (sqlite files) lives inside that watched dir and changes constantly, retriggering reloads. Pointing `--persist-to` outside the repo breaks the loop.
- `.assetsignore` excludes `node_modules`, `package.json`, etc. from being served/deployed (only controls serving, not the file watcher). Without it, Wrangler refuses to start because `node_modules/.../workerd` exceeds the 25 MiB asset limit.
- The app requires **internet access** at runtime: core libraries (Firebase SDK, Leaflet, xlsx, Font Awesome) load from CDNs, and product/order data comes from the live Firestore DB. The cart is client-side, so browsing + add-to-cart works without writing to the production database.
