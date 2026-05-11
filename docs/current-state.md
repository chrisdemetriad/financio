# Financio — Current State

> Snapshot of what is already implemented beyond the original planning outline.
> Read this together with `PLAN.md` before making architectural or UX changes.

---

## Purpose

This document is the "what exists today" handoff for future agents and contributors.

Whenever a feature, route, API behavior, schema field, or meaningful UX interaction changes, update this file and `PLAN.md` in the same pass. Documentation is part of the implementation, not follow-up work.

Use `PLAN.md` for:

- original scope
- architectural decisions
- the phased build order
- infrastructure and secret requirements

Use this file for:

- features already implemented
- table UX behavior that must be preserved
- schema and API additions that were introduced during implementation
- current UI rules that came out of real usage and feedback

---

## Current Product Baseline

The app currently supports:

- invoice upload for PDFs and images
- extraction + validation flow with persisted invoice rows
- vendor logo fetching and storage-backed logo display
- per-row actions and bulk export/copy flows
- settings persistence, including theme and export preferences
- dashboard analytics derived from invoice data
- `/dashboard` as the homepage
- `/invoices` as the main invoice-review workspace
- vendor-level aggregation in a dedicated `/vendors` page
- a working invoice review table intended for day-to-day accounting-style use

The invoice table is the primary working surface, not just a passive output list.

---

## Deployment Baseline

- GCP deploys target Cloud Run in `europe-west1`.
- AWS deploys now target ECS Express Mode in `eu-west-2`.
- AWS App Runner is no longer the intended deploy target for this repo because AWS closed App Runner to new customers.
- On AWS, Terraform now owns the supporting resources (RDS, S3, ECR, IAM roles, SSM runtime parameters) while the GitHub Actions deploy workflow creates or updates the ECS Express service from the pushed container image.
- The monitoring page should treat AWS as an ECS task-count source, not an App Runner instance-count source.

---

## Implemented Table UX

These behaviors are part of the current baseline and should be preserved unless explicitly changed by the user.

### 1. Multi-select + floating bulk actions

- Row checkboxes support multi-selection.
- A floating bar appears when rows are selected.
- The bulk bar supports:
  - copy selected rows as CSV
  - copy selected rows as JSON
  - download selected rows as Excel
  - delete selected rows
- Existing per-row 3-dot menus remain in place and should not be removed just because bulk actions exist.

### 2. Running totals

- The UI shows the sum of `total` for the selected rows.
- This is intended as a quick accounting sanity-check before export or deletion.

### 3. Filter bar

- The table supports:
  - vendor / invoice search
  - status filter
  - currency filter
  - invoice date range
- The filter controls use styled Shadcn/Base UI primitives, not native browser selects/date inputs.
- Date picking uses popovers + calendar UI rather than raw `input[type="date"]`.

### 4. Inline editing

- Key extracted fields can be corrected directly in the table:
  - vendor
  - invoice number
  - invoice date
  - due date
  - total
  - currency
- The row drawer and double-click-to-edit interaction were intentionally tuned so editing does not immediately trigger the details drawer.

### 5. Manual edit indicator

- Manually changed fields are visually marked with a dashed underline + tooltip.
- The indicator must only appear after a real value change.
- Double-clicking into edit mode without changing the value must not mark the field as edited.
- Backend tracking uses `editedFields[]`.

### 6. Overdue highlighting

- Invoices with a past `dueDate` are visually flagged as overdue.
- This status is visible directly in the table without requiring the user to open the row details drawer.

### 7. Tags

- Invoices support multiple tags.
- Tags are edited from the detail drawer via quick-select chips.
- The table includes a tag filter.
- These tags are intended for lightweight accounting categorisation, not a fully separate taxonomy system.

### 8. Payment tracking

- Payment state is separate from extraction state.
- `Complete` means extraction succeeded.
- `Paid` means the invoice has been marked as settled by the user.
- The table shows a visible Paid pill next to the extraction-status pill when relevant.
- The detail drawer supports toggling paid status and storing `paidDate`.

### 9. Recurring detection

- The table shows a recurring badge when another invoice exists with:
  - same vendor
  - same currency
  - a total within 5%
  - an invoice date within the last 90 days
- This is a client-side heuristic intended to help spot likely subscriptions or repeated charges.

### 10. Original file viewer

- The table includes a file-format pill (PDF / PNG / JPG / etc.).
- Clicking it opens a full-screen modal for the original uploaded file.
- PDFs use the browser's native viewer in an iframe.
- Images open in an image viewer with zoom and rotation controls.
- This feature exists specifically to help verify extraction output against the source document.
- The viewer is route-backed at `/invoices/:id/preview`.
- Closing the viewer or pressing Escape should return the app to `/invoices`.
- Browser back/forward should open/close this viewer naturally.

### 11. URL-backed invoice overlays

- The invoice review page lives at `/invoices`.
- Clicking a row opens the detail drawer at `/invoices/:id/details`.
- Clicking the file pill opens the source-document viewer at `/invoices/:id/preview`.
- Direct navigation to either URL should open the correct invoice UI once invoice data loads.
- Closing the drawer/viewer, pressing Escape, or navigating back should return to `/invoices`.

---

## Additional Pages

### Dashboard

- `/dashboard` is implemented.
- `/dashboard` is the homepage.
- It is derived entirely from invoice data already loaded for the user.
- Current widgets include:
  - spend this month vs last month (separate per currency)
  - spend by month
  - top vendors by spend
  - currency breakdown
  - overdue count
  - outstanding unpaid totals

### Vendors

- `/vendors` is implemented.
- It aggregates by vendor domain when available, with fallback to vendor name.
- Current fields include:
  - logo
  - invoice count
  - total spend by currency
  - average invoice size
  - last invoice date
- This is a frontend aggregation page; no dedicated backend endpoint is required.

---

## Current UI Rules

These rules were reinforced by implementation and user feedback.

- Light mode is first-class, not an afterthought.
- Every new surface, popover, dropdown, drawer, modal, floating bar, and control must be checked in both light and dark mode.
- Avoid dark-only styling such as deep dark backgrounds without a proper light counterpart.
- Popovers and dropdowns should visually match the app's other floating surfaces; avoid bright outline rings that look inconsistent with existing menus.
- Brand/logo presentation should remain readable in both themes.
- Scroll behavior matters: route pages inside the main app shell must explicitly use their own scrolling container (`flex-1` + `overflow-auto`) because the shell itself is `overflow-hidden`.

---

## Schema / API Additions Already In Use

These are not theoretical; the frontend depends on them now.

### Schema

- `Invoice.logoBgColor`
- `Invoice.editedFields[]`
- `Invoice.tags[]`
- `Invoice.paid`
- `Invoice.paidDate`

### API

- `PATCH /invoices/:id`
  - used for inline editing
  - updates invoice fields
  - records the edited field so the UI can show manual-edit indicators
- `GET /invoices/:id/file`
  - auth-gated endpoint for the original uploaded source file
  - used by the full-screen PDF/image viewer modal

---

## Frontend State / UX Decisions Already Adopted

- Settings state uses Zustand, not React context.
- The app uses a class-based dark mode strategy.
- The filter bar uses reusable UI primitives for dropdowns and popovers.
- The table supports both single-row workflows and bulk workflows.
- Dashboard and vendors pages are frontend aggregation views over invoice data.
- Original-file QA happens in a dedicated modal rather than overloading the detail drawer.
- Detail and preview overlays are route-driven rather than purely local component state so browser navigation works as expected.

---

## Guidance For Future Agents

Before changing the invoice table or related API/schema behavior:

1. Read `PLAN.md`.
2. Read this file.
3. Preserve the current table UX unless the user explicitly asks for a behavior change.
4. Check both light and dark mode for any UI work.
5. Do not remove `editedFields[]`, inline editing support, bulk-selection behavior, payment tracking, tag support, recurring badges, or the original-file viewer unless the user specifically requests that change.
6. When you add or materially change behavior, update `PLAN.md` and this file before considering the task finished.

If `PLAN.md` and the current code diverge, treat this file as the implementation-status companion to the plan, then confirm with the user before making a contradictory architectural change.
