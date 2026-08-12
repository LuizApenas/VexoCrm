# VexoCrm/backend/Dockerfile
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libu2f-udev \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Identidade do build — OPCIONAIS, e sem default. Um ARG com default
# "desconhecido" criava a env var SEMPRE preenchida com esse valor; como build-arg
# tinha precedencia sobre o arquivo, o carimbo mentia "desconhecido" em todo
# deploy e o fallback nunca era lido. Vazio agora significa ausente de verdade.
ARG GIT_COMMIT=
ARG BUILD_TIME=
ENV GIT_COMMIT=$GIT_COMMIT \
    BUILD_TIME=$BUILD_TIME

COPY src ./src
COPY scripts ./scripts
COPY supabase ./supabase
COPY start.sh ./start.sh

# Impressao digital do codigo, calculada DENTRO da imagem sobre o que foi copiado.
# Nao depende de build-arg, de .git nem de hook — e a unica peca que sempre
# funciona. Compare com `npm run codehash --prefix backend` na maquina.
RUN node scripts/codehash.mjs --write

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --create-home appuser && \
    chown -R appuser:appgroup /app /home/appuser

USER appuser

EXPOSE 3001

# Liveness sem banco (/health/live): um Postgres lento não deve marcar o container
# unhealthy e disparar restart (era o gatilho do crash loop). Readiness com DB segue
# em /health para monitoramento. start-period maior cobre migrations + boot.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/health/live || exit 1

CMD ["bash", "./start.sh"]
