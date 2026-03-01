#!/usr/bin/env bash
# =============================================================================
# MonkeysCloud — Setup Secrets from Terraform Outputs
# =============================================================================
# Reads Terraform outputs and creates K8s secrets.
# Run after `terragrunt apply` in the target environment.
#
# Usage:
#   ./scripts/setup-secrets.sh <environment>
# =============================================================================
set -euo pipefail

ENV="${1:?Usage: setup-secrets.sh <dev|staging|production>}"
PROJECT="monkeyscloud2"
REGION="us-central1"
CLUSTER="mc-${ENV}"
NAMESPACE="monkeyscloud-${ENV}"

echo "🔐 Setting up secrets for ${ENV}..."

# Get cluster credentials
gcloud container clusters get-credentials "$CLUSTER" \
  --region "$REGION" --project "$PROJECT"

# Create namespace if needed
kubectl create namespace "$NAMESPACE" 2>/dev/null || true

# Read Terraform outputs
cd "infra/environments/${ENV}"
DB_PASSWORD=$(terragrunt output -raw db_password 2>/dev/null || echo "CHANGE_ME")
DB_HOST=$(terragrunt output -raw db_private_ip 2>/dev/null || echo "")
REDIS_HOST=$(terragrunt output -raw redis_host 2>/dev/null || echo "")
cd -

# Generate JWT secret if not set
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
WEBHOOK_KEY=$(openssl rand -hex 32)

# Create API secrets
kubectl -n "$NAMESPACE" create secret generic api-secrets \
  --from-literal=DB_USERNAME=monkeyscloud \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=WEBHOOK_SIGNING_KEY="$WEBHOOK_KEY" \
  --from-literal=VERTEX_AI_API_KEY="${VERTEX_AI_API_KEY:-}" \
  --from-literal=MAIL_USERNAME="${MAIL_USERNAME:-}" \
  --from-literal=MAIL_PASSWORD="${MAIL_PASSWORD:-}" \
  --from-literal=MINIO_ROOT_USER="${MINIO_ROOT_USER:-}" \
  --from-literal=MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Patch ConfigMaps with Terraform IPs
kubectl -n "$NAMESPACE" create configmap api-config \
  --from-literal=DB_HOST="$DB_HOST" \
  --from-literal=REDIS_HOST="$REDIS_HOST" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create git-server secrets
kubectl -n "$NAMESPACE" create secret generic git-secrets \
  --from-literal=PLATFORM_API_TOKEN="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ Secrets configured for ${ENV}!"
echo "   DB Host:    ${DB_HOST}"
echo "   Redis Host: ${REDIS_HOST}"
echo "   JWT:        (set)"
echo ""
echo "Next: run ./scripts/deploy.sh ${ENV}"
