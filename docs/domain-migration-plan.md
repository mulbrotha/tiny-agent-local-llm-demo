# Domain Migration Plan — kalisporting.com → kali-shop storefront

## Current state

- SportIQ (`src/app/page.js`) currently renders the "Coming Soon" landing at `/`. `next.config.ts` only redirects `/` → `/dashboard` when host is `app.kalisporting.com`. DNS for apex `kalisporting.com` presumably points at SportIQ today.
- `kali-shop` is a separate Next.js 16 app with its own homepage at `kali-shop/src/app/(shop)/page.tsx`, shared Supabase DB (anon key + RLS), not yet deployed.
- `proxy.js` exists in sportiq (middleware-style auth gate) but isn't named `middleware.js`, so it isn't active. Public routes = `/`, `/login`; everything else already redirects to `/login` when logged out.

## Plan

### 1. Deploy kali-shop to its own Vercel project

- Connect the kali-shop repo → new Vercel project `kali-shop`.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon only — CLAUDE.md confirms no service role needed).
- Confirm the shop build runs queries through `/api/*` routes and RLS policies in `kali-shop/supabase/shop-rls.sql` are applied.

### 2. Domain / DNS flip (done in Vercel dashboards, not code)

- kali-shop Vercel project → attach `kalisporting.com` (apex) + `www.kalisporting.com`. Optionally also `shop.kalisporting.com` as an alias or retire it.
- sportiq Vercel project → keep only `app.kalisporting.com`. Remove `kalisporting.com` from its domains list.
- Do the DNS cutover with short TTL so rollback is cheap.

### 3. Harden SportIQ so nothing is public

- Rename `src/proxy.js` → `src/middleware.js` (Next.js looks for it in `src/` since this project uses a `src/` directory). Also rename `export async function proxy` → `export async function middleware`.
- Delete `src/app/page.js` and `src/app/coming-soon.css` — SportIQ should have no root page at all. The app is `/dashboard`, `/login`, etc.; there is no marketing surface to host here.
- In the new middleware, redirect `/` → `/dashboard` unconditionally at the top of the handler. The existing auth check then bounces unauthenticated users on to `/login`. Net effect: `app.kalisporting.com/` always resolves to either `/dashboard` (signed in) or `/login` (signed out), never a 404 and never a public page.
- Remove `/` from `publicRoutes` in the middleware — with the redirect above it's unreachable as a "page", and tightening the allowlist removes a stray escape hatch.
- Drop the host-based redirect block in `next.config.ts` — it's no longer needed once middleware handles `/` directly, and SportIQ should only ever serve one host (`app.kalisporting.com`) anyway.
- **Security note:** [sportiq/src/proxy.js:9](../../sportiq/src/proxy.js#L9) uses `SUPABASE_SERVICE_ROLE_KEY` in the Supabase client used with `auth.getUser()`. That's unnecessary and risky for an auth-gate middleware — swap to `NEXT_PUBLIC_SUPABASE_ANON_KEY` here. Reserve service-role for server-only API routes.

### 4. Cross-link the two apps

- In kali-shop header/footer: add a "Staff login" / "Admin" link → `https://app.kalisporting.com/login`.
- In SportIQ's `/login` page and post-logout flow: optionally link back to `https://kalisporting.com`.

### 5. Auth model (single sign-in domain)

Because the two apps live on different subdomains of `kalisporting.com`, Supabase session cookies can be shared if you set the cookie `Domain=.kalisporting.com`. Decide up front:

- **Option A (simpler, recommended):** keep auth isolated to SportIQ at `app.kalisporting.com`. Shop stays anonymous. No cookie-scoping work.
- **Option B:** share sessions across apex + app subdomain — needed only if you later want "logged-in shoppers." More work; skip for now.

### 6. Verification checklist before flipping DNS

- `kalisporting.com` (once pointed) serves the shop homepage and `/products`, `/cart`, `/checkout` all work.
- `app.kalisporting.com/dashboard` redirects to `/login` when signed out; reaches dashboard when signed in.
- `app.kalisporting.com/api/*` routes still work (service-role calls happen inside individual route handlers, not middleware).
- No SportIQ page is reachable from the apex domain.
