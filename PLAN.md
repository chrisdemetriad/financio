# Financio — Build Plan & Architecture

> Invoice extraction and management tool with multi-agent AI pipeline, dual-cloud infrastructure, and real-time monitoring.

---

> **For any agent picking this up mid-build:**
> Read this entire file **and** `docs/current-state.md` before writing a single line of code. The "Key Decisions & Rationale" section explains *why* choices were made — do not substitute alternatives without reading it. The 40-commit plan is the source of truth for build order. `docs/current-state.md` is the implementation-status companion document and captures features/UX that landed after the original outline. The design system section defines all visual tokens. The infrastructure section defines the two-cloud split. The environment variables section lists every secret needed and when.
>
> **Documentation rule:** whenever a feature, route, API behavior, schema field, or meaningful UX interaction is added or changed, update `PLAN.md` and `docs/current-state.md` in the same pass. Do not treat docs as a later cleanup task.

---

## What the App Does

The user drops invoice files (PDF, PNG, JPG, HEIC) onto the page. A multi-agent AI pipeline extracts structured data from each invoice, validates it, and fetches the vendor's logo. The results appear in a live table. The user can copy or export the data in multiple formats, bulk-select rows, filter the table, manually correct extracted values inline, tag invoices, track payment state, and open the original PDF/image in a full-screen viewer. All data persists until explicitly cleared.

### Core user flows

1. **Drop invoice** → file hashed (duplicate check) → extraction agent → validator agent → row appears in table
2. **Logo agent** runs in parallel → vendor logo fetched from Brandfetch → saved to S3/GCS → logo column updates
3. **Review/correct** → user filters the table, spots overdue invoices, and double-clicks fields to correct vendor / invoice number / dates / total / currency inline
4. **Bulk actions** → user multi-selects rows, sees running total for the current selection, then copies selected rows as CSV / JSON, downloads Excel, or deletes selected
5. **Analytics** → `/dashboard` is the homepage and summarizes spend by month/vendor/currency and highlights overdue + outstanding invoices
6. **Vendor analysis** → `/vendors` aggregates invoices by vendor/domain with totals, counts, average invoice size, and last invoice date
7. **Invoice review** → `/invoices` is the main workspace; `/invoices/:id/details` opens the detail drawer and `/invoices/:id/preview` opens the original-file viewer
8. **Settings** → user configures clipboard format (CSV, JSON, TSV, Markdown) and column visibility
9. **Clear** → confirmation dialog → all invoices deleted for the current user
10. **Monitoring** → `/monitoring` page shows live instance counts on AWS and GCP; run k6 to watch horizontal scaling in real time

---

## Key Decisions & Rationale

These decisions were made explicitly during planning. A future agent should **not** revisit or second-guess them without good reason.

| Decision | Choice | Why |
|---|---|---|
| No Next.js | React + Vite | Internal tool — no public traffic, no SEO, no SSR needed. Next.js adds App Router complexity and deployment constraints with zero benefit here. |
| No LangChain / Vercel AI SDK | Plain `openai` npm package | 2–3 agents = ~50 lines of async functions. No framework needed. Vercel AI SDK is unrelated to Vercel hosting but adds abstraction we'd fight. Plain SDK gives full control. |
| REST not tRPC | REST | Simpler mental model, no codegen step, easier to test with curl/Postman, decoupled frontend and backend. |
| Clerk deferred | Auth added at commit 5–6 | App is internal/personal. `user_id` column is **nullable** in schema from day one — do not remove it. Wire Clerk up at commits 5–6 as planned, make non-nullable then. |
| Managed container target | ECS Express Mode (AWS) + Cloud Run (GCP) | AWS closed App Runner to new customers, so AWS now uses ECS Express Mode as the closest managed replacement. Cloud Run remains the true scale-to-zero path on GCP. |
| Dual cloud purpose | AWS + GCP both active | Deliberate learning split: Terraform on AWS, Pulumi (TypeScript SDK) on GCP. Logo storage actively uses **both** S3 and GCS as a concrete cross-cloud exercise. |
| Horizontal scaling only | More instances, not bigger ones | Containers scale horizontally. `/monitoring` shows instance *count* going up/down during k6 load tests — that is the intended scaling demo. |
| Dark mode default | Tailwind dark class strategy | Toggle in `/settings`, persisted to `localStorage`. Dark is the default. |
| PDF export library | `@react-pdf/renderer` not jsPDF | Defined as React components with styles — matches the app's visual language. jsPDF produces raw text. |
| Clipboard formats (4) | CSV, JSON, TSV, Markdown | All plain string construction, no library required. Markdown pastes into Notion/Linear/GitHub. |
| Download-only formats (2) | XLSX (SheetJS) + PDF (@react-pdf/renderer) | Require a file — not suitable for clipboard. Available both per-row and as bulk export. |
| OpenAI model | GPT-4o mini | Cheapest OpenAI model with solid vision. ~$0.15/1M input tokens. Sufficient for printed invoice text — no need for full GPT-4o. |
| No auth initially | Skip until Clerk commits | Zero keys needed for commits 1–4. First keys needed: Clerk (commit 5), OpenAI (commit 9), Brandfetch (commit 21). |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Fast dev loop, no SSR needed, internal tool |
| Styling | Tailwind CSS + Shadcn/ui | Utility-first; **light and dark** with class-based `dark:` variant |
| Tables | TanStack Table | Sorting, filtering, column visibility, zero-cost |
| Filter controls | Shadcn/ui Select + Popover + `react-day-picker` | Consistent dropdowns/date pickers across light and dark mode |
| Charts | `recharts` | Dashboard charts without backend changes |
| File drops | react-dropzone | Full-page drag target, file validation |
| Toasts | Sonner | Lightweight, dark-mode-ready |
| Command palette | cmdk | `⌘K` shortcut, one-liner integration |
| Backend | Fastify + TypeScript | Fast, lightweight, TypeScript-native |
| API style | REST | Simple, no codegen step |
| ORM | Prisma | Schema-as-code, migrations, type-safe queries |
| Database | PostgreSQL | Available on both AWS (RDS) and GCP (Cloud SQL) |
| AI agents | OpenAI SDK (plain) | GPT-4o mini, structured outputs, no framework needed |
| Logo fetching | Brandfetch API | Free tier, clean API, returns logo by domain |
| Export | xlsx (SheetJS) + @react-pdf/renderer | XLSX and styled PDF exports |
| Auth | Clerk | Magic-link + OAuth, ~30 min integration, deferred |
| Monorepo | pnpm workspaces + Turborepo | Independent `apps/web` and `apps/api` |
| IaC (AWS) | Terraform | Manages RDS, S3, ECR, ECS Express IAM/runtime config |
| IaC (GCP) | Pulumi (TypeScript SDK) | Manages Cloud SQL, GCS, Cloud Run, Artifact Registry |
| CI/CD | GitHub Actions + OIDC | No long-lived cloud credentials in secrets |
| Testing | Playwright (e2e) + Vitest (unit) + k6 (load) | Full testing story |

---

## Repository Structure

```
financio/
├── apps/
│   ├── web/               # Vite React frontend
│   └── api/               # Fastify backend
├── docs/
│   └── current-state.md   # implementation-status handoff for future agents
├── packages/
│   ├── types/             # Shared TypeScript types (invoices, API responses)
│   └── exports/           # Shared export utilities (CSV, XLSX, PDF)
├── infra/
│   ├── terraform/         # AWS infrastructure
│   └── pulumi/            # GCP infrastructure
├── scripts/
│   └── load-test.js       # k6 load test script
├── .github/
│   └── workflows/         # CI and CD pipelines
├── Makefile               # infra-up-aws, infra-down-aws, infra-up-gcp, load-test, etc.
└── PLAN.md                # this file
```

---

## Design System

- **Theme**: dark-first (background `#13141a`, card surface `#1c1e26`), with a **first-class light mode** (CSS variables flip surfaces to white / light grey — see `index.css`). Users toggle via Settings; Tailwind uses **class-based** `dark:` (`@custom-variant dark` on `.dark`).
- **Light + dark parity (mandatory for new UI)**: Every new surface, floating bar, modal, and control must use paired classes — **base styles for light**, `dark:` overrides for dark — not a single dark-only palette. Verify both themes before shipping. Overlays and “command bar” patterns should use `bg-surface`, `border-slate-200` + `dark:border-white/10`, and readable text (`text-slate-800` / `dark:text-slate-300`), never `bg-slate-900` without a light counterpart.
- **Font**: Geist Sans (bundled with Shadcn)
- **Accent**: single blue `#4F7DFA` — active nav, primary buttons, links
- **Status pills**: Overdue (red), Due Soon (amber), Paid (green), Processing (blue)
- **Cards**: 1px border `border-white/[0.06]`, no drop shadows, flat surfaces
- **Confidence highlighting**: low-confidence fields (`< 0.7`) tinted amber
- **Table quick wins**: multi-select with a floating bulk-actions bar, running totals for selected rows, inline editing on key extracted fields, manual-edit indicator (dashed underline + tooltip), overdue highlighting, recurring-detection badges, payment pills, a file-format pill that opens the original PDF/image viewer, and a filter bar using Shadcn-style dropdowns and calendar popovers
- **Sidebar**: 220px fixed, logo top-left, dark mode toggle bottom-left
- **Reference design**: clean, modern SaaS dashboard (Zaant-style) — not cluttered

---

## Current Table UX

The invoice table is no longer a passive output view. It is the main working surface for someone reviewing extracted invoices.

- **Bulk selection + actions**: checkbox selection per row plus a floating bulk-actions bar. Keep the existing per-row 3-dot menus as well.
- **Running totals**: show the sum of `total` for the current selection so accounting users can sanity-check a subset before export.
- **Filter bar**: vendor / invoice search, status filter, currency filter, and invoice date range. Use styled Shadcn/Base UI controls rather than native browser selects/date inputs.
- **Inline editing**: allow direct correction of extracted fields in the table for vendor, invoice number, invoice date, due date, total, and currency.
- **Manual edit indicator**: visually mark fields that were actually changed by the user. Double-clicking alone must not mark a field as edited.
- **Overdue highlighting**: compare `dueDate` with today and visually flag overdue invoices without needing to open the drawer.
- **Payment state**: track `paid` separately from extraction `status`. "Complete" means extraction worked; "Paid" means the invoice has been settled.
- **Tags**: support multiple tags per invoice, editable from the row detail drawer and filterable from the table.
- **Recurring detection**: badge likely subscription-like repeats using same vendor + currency and similar totals in the last 90 days.
- **Original file viewer**: expose a dedicated file-format pill in the table that opens the original PDF/image in a full-screen modal for extraction QA.
- **Route-backed overlays**: the detail drawer and file viewer are URL-backed. `/invoices/:id/details` opens the drawer, `/invoices/:id/preview` opens the file viewer, and closing either returns the user to `/invoices`. Browser back/forward must behave naturally.
- **Theme parity**: all new controls in this area must be checked in both light and dark mode before shipping.

---

## Agent Pipeline

Agents 1 and 2 run in **series**. Agent 3 runs in **parallel** as soon as the vendor name is known.

```
File upload
    │
    ▼
[Agent 1 — Extractor]
  Model: GPT-4o mini (vision)
  Input: invoice image or PDF (base64)
  Output: { vendor, invoiceNumber, invoiceDate, dueDate,
            lineItems[], subtotal, tax, total, currency,
            confidence: { [field]: 0–1 } }
    │
    ▼
[Agent 2 — Validator]
  Model: GPT-4o mini (text)
  Input: extractor JSON
  Output: corrected JSON (same shape) + validation notes
    │
    ├──► Write to PostgreSQL
    │
    └──► [Agent 3 — Logo Fetcher]  (parallel)
           API: Brandfetch
           Input: vendor domain name
           Output: logo URL
           Storage: S3 (AWS) or GCS (GCP)
           Updates invoice row with logo URL
```

---

## Database Schema (key tables)

```sql
User        -- Clerk user_id, email, settings
Invoice     -- all extracted fields, userId FK, fileHash, logoUrl, logoBgColor, confidence JSON, editedFields[], tags[], paid, paidDate
UserSettings -- exportFormat, visibleColumns, darkMode
```

`user_id` is included from day one (nullable until Clerk is wired up).  
File hash enables duplicate detection on upload.  
`editedFields[]` tracks fields manually corrected in the table so the UI can show a manual-edit indicator and avoid conflating extracted data with user-corrected data.
`tags[]`, `paid`, and `paidDate` support accounting workflows and dashboard/vendor aggregations without requiring a separate bookkeeping system.

---

## Infrastructure

Both clouds run **comparable managed container services**, but they are no longer identical. The original AWS App Runner plan was replaced with ECS Express Mode because AWS closed App Runner to new customers. The primary goal is still to practice both Terraform (AWS) and Pulumi (GCP) and have live infrastructure for the monitoring/scaling demo.

### AWS (Terraform + ECS Express workflow)
- **ECS Express Mode** — hosts the Fastify API using an ECS-managed ALB/Fargate stack. This replaced App Runner after AWS closed App Runner to new customers.
- **RDS PostgreSQL** — managed Postgres, Multi-AZ optional
- **S3 Bucket** — invoice files + vendor logos (private, signed URLs)
- **ECR** — container image registry
- **CloudFront + S3** — static frontend hosting from a dedicated frontend bucket fronted by CloudFront with SPA-friendly fallback routing
- **CloudWatch / ECS APIs** — metrics and task counts for the `/monitoring` page
- **CORS configuration** — backend should support multiple allowed frontend origins so local dev, AWS-hosted frontend, and later GCP-hosted frontend can all be authorized cleanly

### GCP (Pulumi — TypeScript)
- **Cloud Run** — hosts Fastify API, scales to zero
- **Cloud SQL PostgreSQL** — managed Postgres
- **GCS Bucket** — invoice files + vendor logos
- **Artifact Registry** — container image registry
- **Cloud CDN + GCS** — static frontend hosting
- **Cloud Monitoring** — metrics for the `/monitoring` page

### CI/CD (GitHub Actions)
- `test.yml` — install, lint, Vitest unit tests, Playwright e2e
- `deploy-aws.yml` — build Docker image → ECR → create/update ECS Express Mode service (OIDC or access keys)
- `deploy-aws-frontend.yml` — build `apps/web` → upload to S3 frontend bucket → invalidate CloudFront
- `deploy-gcp.yml` — build image → Artifact Registry → deploy to Cloud Run (Workload Identity Federation)

---

## API Keys Required

| Key | Provider | When needed |
|---|---|---|
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) | Commit 9 (extraction agent) |
| `CLERK_PUBLISHABLE_KEY` | [dashboard.clerk.com](https://dashboard.clerk.com) | Commit 5 (auth) |
| `CLERK_SECRET_KEY` | [dashboard.clerk.com](https://dashboard.clerk.com) | Commit 6 (JWT verify) |
| `BRANDFETCH_API_KEY` | [brandfetch.com/api](https://brandfetch.com/api) | Commit 21 (logo agent) |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | IAM Console | Commit 32 (Terraform) |
| `AWS_ACCOUNT_ID` | AWS Console | Commit 32 |
| GCP service account JSON | GCP Console → IAM | Commit 33 (Pulumi) |
| `GCP_PROJECT_ID` | GCP Console | Commit 33 |

GitHub Actions uses OIDC (AWS) and Workload Identity Federation (GCP) — no long-lived credentials stored in secrets.

---

## The 40-Commit Build Plan

### Phase 1 — Foundation (commits 1–6)

| # | Commit | Description |
|---|---|---|
| 1 | `chore: monorepo scaffold` | pnpm workspaces, Turborepo, root tsconfig, .gitignore |
| 2 | `feat: frontend scaffold` | Vite + React 19 + TypeScript + Tailwind + Shadcn, sidebar layout, dark theme tokens, Geist font |
| 3 | `feat: backend scaffold` | Fastify + TypeScript, `GET /health`, CORS for `localhost:5173` |
| 4 | `feat: database setup` | Prisma init, Invoice + User + UserSettings schema, first migration, seed script |
| 5 | `feat: clerk frontend` | ClerkProvider, sign-in/sign-up pages, protected route wrapper |
| 6 | `feat: clerk backend` | Fastify plugin to verify Clerk JWT, userId extracted into request context |

### Phase 2 — Upload & Extraction (commits 7–14)

| # | Commit | Description |
|---|---|---|
| 7 | `feat: file upload endpoint` | `POST /invoices/upload`, Fastify multipart, file type + size validation |
| 8 | `feat: duplicate detection` | SHA-256 hash on upload, 409 if already processed |
| 9 | `feat: drop zone ui` | Full-page react-dropzone, drag-over visual state, client-side validation |
| 10 | `feat: extractor agent` | GPT-4o mini vision, Zod schema, returns structured JSON with confidence scores |
| 11 | `feat: validator agent` | GPT-4o mini text, logical consistency check, returns corrected JSON |
| 12 | `feat: persist invoice` | Write validated invoice to Postgres via Prisma |
| 13 | `feat: invoice table` | TanStack Table — vendor, invoice date, due date, total, currency, invoice #, status |
| 14 | `feat: load invoices` | `GET /invoices`, frontend fetches on mount, table hydrates from DB |

### Phase 3 — Clipboard & Toasts (commits 15–16)

| # | Commit | Description |
|---|---|---|
| 15 | `feat: clipboard and toast` | Copy new row on extraction complete, Sonner toast ("1 entry copied as CSV"), auto-dismiss |
| 16 | `feat: clear all` | Confirmation dialog, `DELETE /invoices`, clears table + DB for current user |

### Phase 4 — Settings Page (commits 17–20)

| # | Commit | Description |
|---|---|---|
| 17 | `feat: settings page` | `/settings` route, layout, back navigation |
| 18 | `feat: export format preference` | CSV / JSON / TSV / Markdown selector, saved to UserSettings |
| 19 | `feat: dark mode toggle` | Tailwind dark class strategy, toggle in settings, persisted to localStorage |
| 20 | `feat: column visibility` | Checkboxes to show/hide columns, persisted to localStorage |

### Phase 5 — Logo Agent (commits 21–24)

| # | Commit | Description |
|---|---|---|
| 21 | `feat: brandfetch integration` | Logo agent function, fetch by vendor domain, graceful 404/rate-limit handling |
| 22 | `feat: s3 logo storage` | Upload logo PNG to S3, store public URL in invoice row |
| 23 | `feat: gcs logo storage` | Mirror to GCS bucket, cloud determined by `STORAGE_CLOUD` env var |
| 24 | `feat: logo column` | Logo column in table, img with fallback initials avatar while loading |

### Phase 6 — Quick Wins (commits 25–32)

| # | Commit | Description |
|---|---|---|
| 25 | `feat: column sorting` | TanStack `getSortedRowModel`, sortable header click |
| 26 | `feat: column filtering` | Global search + per-column filter, TanStack `getFilteredRowModel` |
| 27 | `feat: invoice preview panel` | Click row → side sheet with original file (signed URL) + extracted fields |
| 28 | `feat: confidence highlighting` | Extractor returns `0–1` per field; `< 0.7` fields show amber cell bg |
| 29 | `feat: per-row export` | Row actions menu → Download CSV / XLSX / PDF (via SheetJS + @react-pdf/renderer) |
| 30 | `feat: bulk export` | Table header "Export all" → downloads file in user's preferred format |
| 31 | `feat: command palette` | cmdk, `⌘K` → Clear all / Export / Settings / Upload |
| 32 | `feat: keyboard shortcuts` | `?` modal listing all shortcuts |

Additional table UX work landed after the original 40-commit outline and should be treated as part of the current baseline for the app:

- Multi-select row checkboxes with a floating bulk-actions bar
- Selected-row running totals
- Filter bar with Shadcn/Base UI dropdowns and calendar popovers
- Inline editing for key extracted fields
- Manual-edit tracking via `editedFields[]` + dashed underline indicator
- Overdue row highlighting
- Tags (multi-tag picker in the detail drawer + tag filter in the table)
- Payment tracking (`paid` + `paidDate`, plus visible Paid pill in the table)
- Recurring detection badge
- Original-file viewer modal opened from a file-format pill in the table
- URL-backed invoice overlays: `/invoices/:id/details` and `/invoices/:id/preview`
- `/dashboard` page with spend/overdue/outstanding analytics
- `/dashboard` promoted to homepage; invoice workspace moved to `/invoices`
- `/vendors` page with frontend-only aggregation by vendor/domain

See `docs/current-state.md` for the implementation-status summary and table UX rules that future agents should preserve.

### Phase 7 — Infrastructure (commits 33–37)

| # | Commit | Description |
|---|---|---|
| 33 | `feat: terraform aws` | RDS Postgres, S3, ECR, ECS Express IAM/runtime config, `terraform.tfvars.example` |
| 34 | `feat: pulumi gcp` | Cloud Run, Cloud SQL, GCS, Artifact Registry, service accounts |
| 35 | `feat: makefile` | `make infra-up-aws`, `make infra-down-aws`, `make infra-up-gcp`, `make infra-down-gcp` |
| 36 | `feat: github actions ci` | `test.yml` — lint, Vitest, Playwright |
| 37 | `feat: github actions cd` | `deploy-aws.yml` + `deploy-gcp.yml` via OIDC / Workload Identity |

### Phase 8 — Monitoring & Load Testing (commits 38–40)

| # | Commit | Description |
|---|---|---|
| 38 | `feat: metrics endpoint` | `GET /metrics` — polls ECS task counts on AWS + Cloud Run `container/instance_count` |
| 39 | `feat: monitoring page` | `/monitoring` route, polls every 4s, live instance count cards per cloud, animated add/remove |
| 40 | `feat: k6 load test` | `scripts/load-test.js`, ramps 0→50 VUs over 30s, targets upload endpoint, README instructions |

---

## Export Formats

Available everywhere (clipboard, per-row download, bulk download):

| Format | Library | Notes |
|---|---|---|
| CSV | Plain string | No library, always available |
| JSON | `JSON.stringify` | Formatted, array of objects |
| TSV | Plain string | Tab-separated, pastes into spreadsheets |
| Markdown table | Plain string | Pastes into Notion, Linear, GitHub |
| XLSX | `xlsx` (SheetJS) | Download only |
| PDF | `@react-pdf/renderer` | Styled export card per invoice, download only |

---

## Quick Reference — Running Locally

```bash
# Install dependencies
pnpm install

# Start both apps in dev mode
pnpm dev

# Frontend only (http://localhost:5173)
pnpm --filter web dev

# Backend only (http://localhost:3001)
pnpm --filter api dev

# Run migrations
pnpm --filter api prisma migrate dev

# Run tests
pnpm test

# Run Playwright e2e
pnpm --filter web test:e2e

# Run k6 load test (requires infra running)
make load-test
```

---

## Environment Variables

### `apps/api/.env`
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
CLERK_SECRET_KEY=sk_...
BRANDFETCH_API_KEY=...
STORAGE_CLOUD=aws          # or "gcp"
AWS_REGION=eu-west-1
AWS_S3_BUCKET=financio-assets
GCS_BUCKET=financio-assets
```

### `apps/web/.env`
```
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```
