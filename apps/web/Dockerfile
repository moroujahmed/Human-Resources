FROM node:22-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace=@staffhub/shared \
    && npm run build --workspace=@staffhub/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@staffhub/web"]
