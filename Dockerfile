# syntax=docker/dockerfile:1

# ---------- dependencies (full, including dev) ---------------------------
FROM node:24-slim AS deps
WORKDIR /app
# .npmrc carries legacy-peer-deps=true. Without it `npm ci` fails on the
# typescript peer range that @nuxt/module-builder declares.
COPY package.json package-lock.json .npmrc ./
# The playground is an npm workspace, so its manifest has to exist before
# `npm ci` or the workspace graph cannot be resolved.
COPY playground/package.json ./playground/package.json
RUN npm ci

# ---------- development ---------------------------------------------------
# Used by docker-compose.override.yml for hot reload. The app that actually
# runs is the playground, so its sources are what get copied in.
FROM deps AS development
ENV NODE_ENV=development
COPY tsconfig.json ./
COPY src ./src
COPY playground ./playground

EXPOSE 3000

# The playground's node_modules hold a symlink to the module source, which the
# stub build in dev:prepare creates. Skipping it breaks `modules: ['../src/module']`.
RUN npm run dev:prepare

HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=10 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ---------- build ---------------------------------------------------------
FROM deps AS build
ENV NODE_ENV=production
COPY tsconfig.json ./
COPY src ./src
COPY playground ./playground
RUN npm run dev:prepare && npm run dev:build

# ---------- production ----------------------------------------------------
FROM node:24-slim AS production
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
WORKDIR /app

# `nuxt build` already emits .output/server/node_modules with the traced
# dependencies, so nothing needs installing here.
COPY --from=build --chown=node:node /app/playground/.output ./.output

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", ".output/server/index.mjs"]