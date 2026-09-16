# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8788

EXPOSE 8788

USER node
CMD ["node", "src/index.js"]
