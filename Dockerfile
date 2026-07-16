FROM node:26-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global pnpm@11.12.0 && pnpm install --frozen-lockfile

COPY . .
RUN mkdir -p data/artifacts && pnpm build

EXPOSE 6000

CMD ["node", "dist/server.js"]
