<!--
Replace the placeholders below before publishing:

  - `your-org/ecommerce-admin` -> your GitHub org or username
  - the npm badges -> keep only the ones that apply (this package is private,
    so the npm version/download badges are dead weight unless you publish)
-->

# Ecommerce Admin

Dark-mode-first admin dashboard for an ecommerce store, built with **Nuxt**,
**Vue 3** (`<script setup lang="ts">`), **Tailwind CSS v4** and
**@lucide/vue** icons. Wrapped as a Nuxt module so the Tailwind pipeline and
design tokens travel with the app instead of being re-wired per project.

[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]
[![Node][node-src]][node-href]

Storefront analytics, catalogue, inventory, orders, payments, reviews, customers
and staff administration across 15 routed pages — backed by a live REST API
rather than fixtures.

## Features

### Dashboard & analytics

- **KPI overview** — total revenue, orders, products, customers and stock units
  as metric cards with trend chips and inline sparklines.
- **Revenue trend** — SVG line/area chart with hover crosshair, tooltips and a
  value formatter; no charting dependency.
- **Order pipeline** — donut breakdown of every order by current status.
- **Store health** — progress bars for catalogue activity, fulfilment rate,
  payment success rate and average rating.
- **Recent transactions** — live order feed with status badges, plus top-selling
  products and a monthly orders column chart.
- **Analytics** — range-switchable reporting (3M / 6M / 12M) covering revenue,
  orders, units, average order value, new customers, status mix, revenue by
  category, top products and low stock.
- **Chart Bot** — an in-app copilot that answers store questions in plain
  language. A 1,600-line intent classifier maps free text to 19 intents
  (`revenue`, `forecast`, `inventory`, `payments`, …), fetches only the datasets
  each intent needs, and renders structured replies. Runs entirely in the
  browser — no external AI service, so no API key to manage and no store data
  leaving the app.

### Catalogue & inventory

- **Products** — table with thumbnails, mono SKU tags, brand, category, price,
  rating and status, with client-side search, sortable columns and pagination.
- **Categories** — grid of cards with descriptions and active state.
- **Brands** — brand management with logo, description and active state.
- **Inventory** — per-product stock with quantities, reserved units, low-stock
  thresholds and adjust/remove actions.

### Sales

- **Orders** — fulfilment table with customer, status, item count, total and
  date, plus per-row status transitions written back to the API.
- **Payments** — method mix and amounts, transaction IDs, paid timestamps, and
  status updates.
- **Reviews** — moderation queue with ratings and per-review delete.

### Customers & access

- **Customers** — CRM table covering contact details, location, address, join
  date and linked account, with a claim flow for users that have no profile yet.
- **Users** — staff accounts with role badges, creation and password reset.
- **Profile** — editable name and email, password change, and account
  information.
- **Settings** — account details, API connection status (showing the distinct
  browser and SSR base URLs), password change, and Telegram notification
  linking.

### Platform

- **Dark theme, light code** — the whole palette is Tailwind utilities at the
  call site (`bg-slate-950`, `text-slate-100`), with no colour tokens to
  re-derive. `admin.css` carries only what utilities can't express: the page
  background, focus and selection behaviour, scrollbars, and chart series.
- **Accessible by default** — visible `:focus-visible` rings, `aria-sort` on
  sortable headers, labelled controls, live regions on toasts, and
  `prefers-reduced-motion` honoured globally.
- **Responsive shell** — collapsible 256px rail that becomes a drawer on mobile,
  sticky header, container that caps at 1600px.
- **Fully typed** — explicit interfaces for every model, end-to-end
  `vue-tsc` clean.
- **30 reusable components** — `Panel`, `MetricCard`, `Modal`, `StatusBadge`,
  chart primitives (`TrendChart`, `DonutChart`, `ColumnChart`, `MiniSparkline`),
  and a `ui/` set of inputs, buttons and dialogs.

## Tech stack

| | |
|---|---|
| Framework | Nuxt 4, Vue 3 Composition API |
| Language | TypeScript (`strict`) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Icons | `@lucide/vue` |
| Data | Axios + `useAsyncData` |
| Auth | JWT bearer token in a cookie, global route middleware |
| Charts | Hand-rolled SVG components |
| CI | GitHub Actions — lint + test on push/PR |

## Project structure

```text
src/                     # The Nuxt module
  module.ts              # Adds Tailwind, generates the CSS entry point
  runtime/plugin.ts
playground/              # The dashboard app
  assets/css/admin.css   # Base layer + chart palette
  components/            # 30 components: ui/, panel/, chat/
  composables/           # useClientTable, useAuth, useChartBot, …
  layouts/default.vue
  pages/                 # 15 routed views
  types/                 # Shared interfaces
  utils/                 # Formatting, navigation, intent classifier
test/                    # Vitest suites
```

## Getting started

The dashboard runs from `playground/` and talks to the store API over HTTP.

```bash
# Install dependencies (playground is an npm workspace)
npm install

# Build the module stub and generate types
npm run dev:prepare

# Start the dev server on http://localhost:3000
npm run dev
```

### Configuration

The API base URL differs between SSR and the browser, so both are configurable.
Defaults target `localhost:3001`; override with environment variables.

| Variable | Used by | Purpose |
|---|---|---|
| `NUXT_API_BASE_SERVER` | Nitro (SSR) | Internal API URL, e.g. the Docker service name |
| `NUXT_PUBLIC_API_BASE` | Browser | Host-published API URL |

### Signing in

Only `ADMIN`-role accounts can reach the dashboard. A global route middleware
redirects unauthenticated requests to `/login` and sends authenticated users away
from it. Sessions live in an `access-token` cookie; a 401 from any request clears
it and returns the user to the login screen.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with the playground |
| `npm run dev:prepare` | Build the module stub and generate types |
| `npm run dev:build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:types` | `vue-tsc` across the repo and playground |
| `npm run release` | Lint, test, build and publish |

## Docker

Multi-stage build with separate `development`, `build` and `production` targets.
Development runs with hot reload for `docker-compose`; production copies only the
built `.output` and runs as the unprivileged `node` user. Both stages ship a
`HEALTHCHECK` against `/`.

```bash
docker build --target development -t ecommerce-admin:dev .
docker build --target production  -t ecommerce-admin .
```

## CI

`.github/workflows/ci.yml` runs lint and tests on every push and pull request to
`main`. The test job runs `dev:prepare` first, since the playground resolves the
module through `dist/`.

<!-- Badges -->
[license-src]: https://img.shields.io/badge/license-MIT-020420?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://github.com/your-org/ecommerce-admin/blob/main/LICENSE

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt
[nuxt-href]: https://nuxt.com

[node-src]: https://img.shields.io/badge/node-24-020420?style=flat&colorA=020420&colorB=00DC82
[node-href]: https://nodejs.org
# Vue.js-Nuxt.ts-Dashboard-Admin
