FROM node:26-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm --config.trust-policy=none install --frozen-lockfile

COPY . .
RUN pnpm --config.trust-policy=none build

EXPOSE 3000

CMD ["node", "dist/server.js"]
