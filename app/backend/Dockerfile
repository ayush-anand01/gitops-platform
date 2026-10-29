# ---- deps: install production dependencies only ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: small image, non-root user ----
FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/ayush-anand01/gitops-platform" \
      org.opencontainers.image.description="TaskApp backend (Node.js API)"
ENV NODE_ENV=production
# npm/yarn aren't needed at runtime; removing them drops a common source of scanner CVEs
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Numeric UID (the "node" user) so Kubernetes can verify runAsNonRoot
USER 1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "src/server.js"]
