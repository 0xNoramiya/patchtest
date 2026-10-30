# Next.js standalone build for Fly.io. Debian base rather than Alpine so sharp
# uses its prebuilt glibc binaries.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 DATA_DIR=/data
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Read-only inputs the server needs at runtime.
COPY --from=build /app/rules ./rules
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/eval ./eval
EXPOSE 3000
CMD ["node", "server.js"]
