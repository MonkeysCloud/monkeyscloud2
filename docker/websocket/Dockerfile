# =============================================================================
# MonkeysCloud WebSocket Server — Node.js + Socket.IO
# =============================================================================

FROM node:22-alpine

WORKDIR /app

COPY websocket/package.json websocket/package-lock.json* ./
RUN npm install --production

COPY websocket/src/ ./src/

USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

CMD ["node", "src/server.js"]
