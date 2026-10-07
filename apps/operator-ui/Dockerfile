# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
#
# SPDX-License-Identifier: Apache-2.0

# Build context is the monorepo root.

FROM --platform=${BUILDPLATFORM:-linux/amd64} node:24.16.0 AS builder

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

# Browser-facing URLs are inlined into the bundle at build time. Passed as
# build args (docker-compose.override.yml builds them from SERVER_IP in the
# server's .env) they win over the localhost defaults in .env.local, so the
# tracked file never has to be edited per server. Declared after the install
# step so changing the address only reruns the build, not the install. Unset
# (not empty) when not passed, so a plain build still uses .env.local.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_CITRINE_CORE_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
RUN for v in NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL NEXT_PUBLIC_CITRINE_CORE_URL NEXT_PUBLIC_KEYCLOAK_URL; do \
      eval "[ -n \"\${$v}\" ]" || unset "$v"; \
    done; \
    pnpm --filter "@citrineos/operator-ui..." build

FROM node:24.16.0-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone output is rooted at outputFileTracingRoot (monorepo root),
# so server.js lives at apps/operator-ui/server.js within the standalone tree.
COPY --from=builder --chown=nextjs:nodejs /app/apps/operator-ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/operator-ui/.next/static ./apps/operator-ui/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/operator-ui/public ./apps/operator-ui/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/operator-ui/server.js"]
