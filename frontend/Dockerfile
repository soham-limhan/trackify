# ── Frontend Dockerfile (multi-stage) ────────────────────────────────────────

# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (layer-cache friendly)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with a lightweight nginx
FROM nginx:alpine

# Copy the built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config to proxy /api calls to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
