# ============================================================
#  Hiratake — image untuk VPS sendiri
#  Node 22 dipakai karena `node:sqlite` sudah built-in
#  (tidak perlu compiler / node-gyp / better-sqlite3).
# ============================================================
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Hanya dependency runtime (hono + @hono/node-server)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Berkas yang dibutuhkan saat jalan
COPY --from=build /app/dist ./dist
COPY public ./public
COPY migrations ./migrations
COPY server ./server
COPY seed.sql ./seed.sql

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME ["/app/data"]

ENV PORT=3000 HOST=0.0.0.0 DB_FILE=data/hiratake.sqlite
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
