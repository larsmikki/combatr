FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY tsconfig.base.json ./
COPY server/ server/
COPY client/ client/
RUN npm run build -w client
RUN npm run build -w server

FROM node:20-alpine

WORKDIR /app

# server is esbuild-bundled into a single self-contained file, so no
# runtime npm install is needed.
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/client/dist client/dist

RUN apk add --no-cache su-exec wget \
  && mkdir -p /app/data \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3050
ENV COMBATR_DATA_FILE=/app/data/combatr.json

EXPOSE 3050

HEALTHCHECK --interval=5m --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3050/api/health || exit 1

ENTRYPOINT ["/bin/sh", "-c", "chown -R node:node /app/data && exec su-exec node node server/dist/index.js"]
