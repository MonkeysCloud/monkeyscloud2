# =============================================================================
# MonkeysCloud Nginx — Reverse Proxy
# =============================================================================
FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our configs
COPY docker/nginx/conf.d/ /etc/nginx/conf.d/
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1
