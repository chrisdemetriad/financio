# Financio — Current State

> Snapshot of what is already implemented beyond the original planning outline.
> Read this together with `PLAN.md` before making architectural or UX changes.

---

## Purpose

This document is the "what exists today" handoff for future agents and contributors.

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
- a working invoice review table intended for day-to-day accounting-style use

The invoice table is the primary working surface, not just a passive output list.

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

---

## Current UI Rules

These rules were reinforced by implementation and user feedback.

- Light mode is first-class, not an afterthought.
- Every new surface, popover, dropdown, drawer, modal, floating bar, and control must be checked in both light and dark mode.
- Avoid dark-only styling such as deep dark backgrounds without a proper light counterpart.
- Popovers and dropdowns should visually match the app's other floating surfaces; avoid bright outline rings that look inconsistent with existing menus.
- Brand/logo presentation should remain readable in both themes.

---

## Schema / API Additions Already In Use

These are not theoretical; the frontend depends on them now.

### Schema

- `Invoice.logoBgColor`
- `Invoice.editedFields[]`

### API

- `PATCH /invoices/:id`
  - used for inline editing
  - updates invoice fields
  - records the edited field so the UI can show manual-edit indicators

---

## Frontend State / UX Decisions Already Adopted

- Settings state uses Zustand, not React context.
- The app uses a class-based dark mode strategy.
- The filter bar uses reusable UI primitives for dropdowns and popovers.
- The table supports both single-row workflows and bulk workflows.

---

## Guidance For Future Agents

Before changing the invoice table or related API/schema behavior:

1. Read `PLAN.md`.
2. Read this file.
3. Preserve the current table UX unless the user explicitly asks for a behavior change.
4. Check both light and dark mode for any UI work.
5. Do not remove `editedFields[]`, inline editing support, or bulk-selection behavior unless the user specifically requests that change.

If `PLAN.md` and the current code diverge, treat this file as the implementation-status companion to the plan, then confirm with the user before making a contradictory architectural change.
