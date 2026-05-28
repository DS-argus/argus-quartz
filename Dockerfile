FROM node:22-slim AS builder
WORKDIR /usr/src/app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY quartz/ ./quartz/
COPY plugins/ ./plugins/
COPY quartz.config.yaml quartz.lock.json ./
RUN npm ci && npx quartz plugin install --from-config

FROM node:22-slim
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/ /usr/src/app/
COPY . .
CMD ["npx", "quartz", "build", "--serve", "--port", "8080", "--wsPort", "3001"]
