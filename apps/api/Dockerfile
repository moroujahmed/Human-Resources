FROM node:22.22.3-bookworm-slim@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752

WORKDIR /workspace

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY . .

RUN DATABASE_URL="postgresql://build:build-only@localhost:5432/staffhub?schema=public" npm run db:generate \
    && npm run build --workspace=@staffhub/shared \
    && npm run build --workspace=@staffhub/api

EXPOSE 4000

CMD ["npm", "run", "start:prod", "--workspace=@staffhub/api"]
