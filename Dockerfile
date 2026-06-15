FROM node:20-slim

# sharp requires these libraries on debian slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY server.js ./
COPY src/      ./src/
COPY public/   ./public/

# Persistent volumes
VOLUME ["/app/data", "/app/uploads"]

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/wappstore.db

EXPOSE 3000

CMD ["node", "server.js"]
