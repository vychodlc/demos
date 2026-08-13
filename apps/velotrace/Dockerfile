FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/velotrace/package.json ./apps/velotrace/package.json
RUN npm ci --workspace=@vychod/velotrace --include-workspace-root

FROM node:22-bookworm-slim AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY apps/velotrace ./apps/velotrace
RUN npm run build --workspace=@vychod/velotrace

FROM node:22-bookworm-slim AS runner
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4173
COPY package.json package-lock.json ./
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/velotrace/package.json ./apps/velotrace/package.json
RUN npm ci --omit=dev --workspace=@vychod/velotrace --include-workspace-root && npm cache clean --force
COPY --from=builder /repo/apps/velotrace/.next ./apps/velotrace/.next
COPY --from=builder /repo/apps/velotrace/public ./apps/velotrace/public
COPY --from=builder /repo/apps/velotrace/migrations ./apps/velotrace/migrations
COPY --from=builder /repo/apps/velotrace/scripts ./apps/velotrace/scripts
EXPOSE 4173
CMD ["npm", "run", "start", "--workspace=@vychod/velotrace"]
