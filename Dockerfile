FROM node:22-alpine AS deps
WORKDIR /app
ARG VITE_SHOPIFY_API_KEY
ENV VITE_SHOPIFY_API_KEY=$VITE_SHOPIFY_API_KEY
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_SHOPIFY_API_KEY
ENV VITE_SHOPIFY_API_KEY=$VITE_SHOPIFY_API_KEY
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ARG VITE_SHOPIFY_API_KEY
ENV VITE_SHOPIFY_API_KEY=$VITE_SHOPIFY_API_KEY
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY --from=build /app/prisma ./prisma
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
