FROM node:22-slim AS builder
WORKDIR /usr/src/app
COPY package.json .
COPY package-lock.json* .
RUN npm ci

FROM node:22-slim
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/ /usr/src/app/
COPY . .

# esbuild 버전 불일치 문제 해결을 위한 완전 재설치
RUN rm -rf node_modules/.cache && \
    npm uninstall esbuild && \
    npm install esbuild@0.25.8

CMD ["npx", "quartz", "build", "--serve"]
