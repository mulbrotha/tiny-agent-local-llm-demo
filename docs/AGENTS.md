# AGENTS.md — Kali Shop

## Project Overview

Kali Shop is the public storefront for Kali Sporting (shop.kalisporting.com). A Next.js 16 e-commerce app with Supabase, Zustand, and TypeScript. Pages fetch live data via `/api/*` routes.

## Commands

- `pnpm dev` — Dev server with Turbopack (localhost:3000)
- `pnpm build` — Production build
- `pnpm lint` — ESLint via next lint
- `pnpm test` — Vitest (watch mode)
- `pnpm test:run` — Vitest (single run)
- `pnpm test:coverage` — Vitest with coverage

## Environment

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Project Structure

```
src/
  app/
    layout.tsx                    # Root layout (html/body/fonts/SkipLink)
    not-found.tsx                 # 404 page
    (shop)/
      layout.tsx                  # Shop layout (Header + main + Footer)
      page.tsx                    # Homepage (async server component)
      products/
        page.tsx                  # Products listing (async server)
        [slug]/
          page.tsx                # Product detail (async server)
      cart/
        page.tsx                  # Cart ('use client')
      checkout/
        page.tsx                  # Checkout ('use client' + Suspense)
      order/
        [id]/
          page.tsx                # Order confirmation (async server)
    api/
      products/route.ts           # GET /api/products
      products/[slug]/route.ts    # GET /api/products/[slug]
      categories/route.ts         # GET /api/categories
      orders/route.ts             # POST /api/orders
      orders/[orderNumber]/route.ts # GET /api/orders/[orderNumber]
  components/
    layout/Header.tsx, Footer.tsx
    shop/ProductCard.tsx, ProductRow.tsx, CategoryGrid.tsx, etc.
    ui/SkipLink.tsx
  lib/
    cart-store.ts                 # Zustand cart store (persisted to localStorage)
    queries.ts                    # Server-side Supabase query functions
    order-validation.ts           # Form validation (Result<T> pattern)
    ratelimit.ts                  # Upstash Redis rate limiter
    format.ts                     # formatPrice utility
    mock-data.ts                  # No longer source of truth
  types/index.ts                  # All shared types
  styles/globals.css              # All CSS + design tokens
__tests__/
  setup.ts                        # Vitest setup (localStorage mock)
  fixtures.ts                     # makeProduct(), makeCartItem() factories
  components/                     # Component tests
  lib/cart-store.test.ts          # Store tests
  app/                            # Page tests
```

## Conventions

- All imports use `@/` path alias — no relative imports
- Routes: kebab-case
- Components: `const Component = () => {}` with `export default` at bottom
- `'use client'` on all interactive components
- API routes: `{ data, error }` envelope pattern
- Validation: dedicated `src/lib/*-validation.ts` modules with `Result<T>` discriminated unions
- List endpoints: clamp `limit` at 100
- Mutating endpoints: apply rate limiting via `src/lib/ratelimit.ts`
- Supabase: server-side only via `@supabase/ssr` — no browser client
- Shipping: free above 500 ETB, 100 ETB fee otherwise

## Design System

- Primary color: `#FF5A1F` (Flame Orange)
- Display font: Barlow Condensed (900/800/700/600)
- Body font: Plus Jakarta Sans (400/500/600)
- All tokens defined in `src/styles/globals.css`

## Available Agents

### @coder — General development
- Writes code following project conventions
- Full read/edit/bash access
- Model: ollama/qwen3-coder

### @test-writer — Vitest + Testing Library tests
- Writes tests in `__tests__/` mirroring `src/`
- Uses `makeProduct`/`makeCartItem` fixtures
- Runs `pnpm test:run` to verify

### @refactor — Component decomposition & hook extraction
- Breaks large components into smaller pieces
- Extracts custom hooks to `src/hooks/`
- Adds `loading.tsx`/`error.tsx` boundaries
- Extracts duplicated constants to `src/lib/`

### @review — Pre-commit code review
- Read-only agent (review only)
- Runs `git status` + `git diff --cached` to check staged changes
- Reports issues, warnings, and positives

## Troubleshooting Local Models

See `docs/local-models.md` for common issues with Ollama and their solutions. Key fixes:
- Increase context window to 32k+ (`ollama run <model>` → `/set parameter num_ctx 32768` → `/save <model>`)
- Set `timeout: 600000` in opencode.json for local models
- Use qwen3-coder 14B+ for reliable tool calling
