# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Nginx config for SPA
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Non-root
RUN chown -R appuser:appgroup /usr/share/nginx /var/cache/nginx /var/run && \
    chmod -R 755 /usr/share/nginx && \
    sed -i 's/user  nginx;/user appuser;/g' /etc/nginx/nginx.conf

USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
