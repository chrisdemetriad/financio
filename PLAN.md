# Financio — Build Plan & Architecture

> Invoice extraction and management tool with multi-agent AI pipeline, dual-cloud infrastructure, and real-time monitoring.

---

> **For any agent picking this up mid-build:**
> Read this entire file before writing a single line of code. The "Key Decisions & Rationale" section explains *why* choices were made — do not substitute alternatives without reading it. The 40-commit plan is the source of truth for build order. The design system section defines all visual tokens. The infrastructure section defines the two-cloud split. The environment variables section lists every secret needed and when.

---

## What the App Does

The user drops invoice files (PDF, PNG, JPG, HEIC) onto the page. A multi-agent AI pipeline extracts structured data from each invoice, validates it, and fetches the vendor's logo. The results appear in a live table. The user can copy or export the data in multiple formats. All data persists until explicitly cleared.

### Core user flows

1. **Drop invoice** → file hashed (duplicate check) → extraction agent → validator agent → row appears in table
2. **Logo agent** runs in parallel → vendor logo fetched from Brandfetch → saved to S3/GCS → logo column updates
3. **Copy/export** → user copies one row or all rows to clipboard, or downloads CSV / XLSX / PDF
4. **Settings** → user configures clipboard format (CSV, JSON, TSV, Markdown) and column visibility
5. **Clear** → confirmation dialog → all invoices deleted for the current user
6. **Monitoring** → `/monitoring` page shows live instance counts on AWS and GCP; run k6 to watch horizontal scaling in real time

---

## Key Decisions & Rationale

These decisions were made explicitly during planning. A future agent should **not** revisit or second-guess them without good reason.

| Decision | Choice | Why |
|---|---|---|
| No Next.js | React + Vite | Internal tool — no public traffic, no SEO, no SSR needed. Next.js adds App Router complexity and deployment constraints with zero benefit here. |
| No LangChain / Vercel AI SDK | Plain `openai` npm package | 2–3 agents = ~50 lines of async functions. No framework needed. Vercel AI SDK is unrelated to Vercel hosting but adds abstraction we'd fight. Plain SDK gives full control. |
| REST not tRPC | REST | Simpler mental model, no codegen step, easier to test with curl/Postman, decoupled frontend and backend. |
| Clerk deferred | Auth added at commit 5–6 | App is internal/personal. `user_id` column is **nullable** in schema from day one — do not remove it. Wire Clerk up at commits 5–6 as planned, make non-nullable then. |
| Scale to zero | App Runner (AWS) + Cloud Run (GCP) | Side project — pay nothing when idle. Not ECS Fargate, not GKE. Both scale to zero automatically. |
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
| Styling | Tailwind CSS + Shadcn/ui | Utility-first, consistent dark theme |
| Tables | TanStack Table | Sorting, filtering, column visibility, zero-cost |
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
| IaC (AWS) | Terraform | Manages RDS, S3, App Runner, ECR |
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

- **Theme**: dark-first (background `#13141a`, card surface `#1c1e26`)
- **Font**: Geist Sans (bundled with Shadcn)
- **Accent**: single blue `#4F7DFA` — active nav, primary buttons, links
- **Status pills**: Overdue (red), Due Soon (amber), Paid (green), Processing (blue)
- **Cards**: 1px border `border-white/[0.06]`, no drop shadows, flat surfaces
- **Confidence highlighting**: low-confidence fields (`< 0.7`) tinted amber
- **Sidebar**: 220px fixed, logo top-left, dark mode toggle bottom-left
- **Reference design**: clean, modern SaaS dashboard (Zaant-style) — not cluttered

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
Invoice     -- all extracted fields, userId FK, fileHash, logoUrl, confidence JSON
UserSettings -- exportFormat, visibleColumns, darkMode
```

`user_id` is included from day one (nullable until Clerk is wired up).  
File hash enables duplicate detection on upload.

---

## Infrastructure

Both clouds run **identical services**. The primary goal is to practice both Terraform (AWS) and Pulumi (GCP) and have live infrastructure for the monitoring/scaling demo.

### AWS (Terraform)
- **App Runner** — hosts Fastify API, scales to zero, no ECS/load balancer complexity
- **RDS PostgreSQL** — managed Postgres, Multi-AZ optional
- **S3 Bucket** — invoice files + vendor logos (private, signed URLs)
- **ECR** — container image registry
- **CloudFront + S3** — static frontend hosting
- **CloudWatch** — metrics for the `/monitoring` page

### GCP (Pulumi — TypeScript)
- **Cloud Run** — hosts Fastify API, scales to zero
- **Cloud SQL PostgreSQL** — managed Postgres
- **GCS Bucket** — invoice files + vendor logos
- **Artifact Registry** — container image registry
- **Cloud CDN + GCS** — static frontend hosting
- **Cloud Monitoring** — metrics for the `/monitoring` page

### CI/CD (GitHub Actions)
- `test.yml` — install, lint, Vitest unit tests, Playwright e2e
- `deploy-aws.yml` — build Docker image → ECR → update App Runner (OIDC, no long-lived keys)
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

### Phase 7 — Infrastructure (commits 33–37)

| # | Commit | Description |
|---|---|---|
| 33 | `feat: terraform aws` | App Runner, RDS Postgres, S3, ECR, IAM roles, `terraform.tfvars.example` |
| 34 | `feat: pulumi gcp` | Cloud Run, Cloud SQL, GCS, Artifact Registry, service accounts |
| 35 | `feat: makefile` | `make infra-up-aws`, `make infra-down-aws`, `make infra-up-gcp`, `make infra-down-gcp` |
| 36 | `feat: github actions ci` | `test.yml` — lint, Vitest, Playwright |
| 37 | `feat: github actions cd` | `deploy-aws.yml` + `deploy-gcp.yml` via OIDC / Workload Identity |

### Phase 8 — Monitoring & Load Testing (commits 38–40)

| # | Commit | Description |
|---|---|---|
| 38 | `feat: metrics endpoint` | `GET /metrics` — polls App Runner `CurrentInstanceCount` + Cloud Run `container/instance_count` |
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
