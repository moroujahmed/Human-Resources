FROM node:22-bookworm-slim

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
