# ScanForge

ScanForge is a production-focused QR code and Code 128 barcode generator with bulk entry, print-ready export, history, usage limits, and account plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server on the configured `PORT`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`
- Optional env: `SCANFORGE_ADMIN_EMAIL`, `BETTER_AUTH_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PLAN_ID_BASIC`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild
- Auth: Better Auth with email/password sessions

## Where things live

- `artifacts/scanforge/src/pages/home.tsx` — generator workspace and high-resolution SVG/PNG exports
- `artifacts/scanforge/src/pages/history.tsx` — generation history and repeat/download actions
- `artifacts/scanforge/src/pages/pricing.tsx` — plan comparison and usage rules
- `artifacts/api-server/src/routes/scanforge.ts` — generation, plan, usage, and history API
- `artifacts/api-server/src/lib/auth.ts` — Better Auth configuration
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/db/src/schema/scanforge.ts` — ScanForge and Better Auth database schema

## Architecture decisions

- QR SVG and Code 128 SVG are generated in the browser for deterministic, print-ready downloads; the API records metadata and enforces transaction limits.
- Anonymous sessions are browser-scoped and receive one daily transaction; authenticated users default to Starter with three daily transactions.
- Basic is modeled as a five-dollar monthly plan with fifty daily transactions; payment-provider credentials are optional runtime configuration.
- Better Auth uses the existing PostgreSQL database directly, with its tables included in the Drizzle schema.

## Product

- Generate QR codes or Code 128 barcodes from one entry or newline-separated bulk input.
- Preview outputs, tune size/error correction/color, download SVG or PNG, and copy SVG markup.
- Review prior generations, reuse source values, and inspect daily usage.
- Sign up/sign in with email and password, compare Anonymous/Starter/Basic plans, and manage browser preferences.

## User preferences

- Visual direction: monochrome tool interface with burnt-orange accents, blue-black chrome, cream canvas, dense desktop sidebar, and a compact mobile shell.

## Gotchas

- If Better Auth tables change, run `pnpm --filter @workspace/db run push` before testing account flows.
- Regenerate typed API clients after OpenAPI changes with `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
