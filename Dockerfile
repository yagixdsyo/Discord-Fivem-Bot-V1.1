# FiveM Yonetim Botu - Uretim imaji
# Not: @napi-rs/canvas icin musl on-derlemeleri mevcut; font paketleri canvas metinleri icindir.
FROM node:22-alpine

# Canvas icin font/fontconfig, healthcheck icin busybox wget yeterli
RUN apk add --no-cache fontconfig ttf-dejavu

WORKDIR /app

# Once sadece manifest: katman onbellegi
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Uygulama kodu
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Bos konteynerde ARTIK saglikli gorunmesin: health endpointi bootstrap acar
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/index.js"]
