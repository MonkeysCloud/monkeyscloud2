#!/usr/bin/env bash
# =============================================================================
# MonkeysCloud — Deploy Script
# =============================================================================
# Usage:
#   ./scripts/deploy.sh <environment> [image-tag]
#
# Examples:
#   ./scripts/deploy.sh production abc1234
#   ./scripts/deploy.sh staging latest
#   ./scripts/deploy.sh dev
# =============================================================================
set -euo pipefail

ENV="${1:?Usage: deploy.sh <dev|staging|production> [image-tag]}"
TAG="${2:-latest}"
PROJECT="monkeyscloud2"
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/mc-platform"

# Validate environment
if [[ ! "$ENV" =~ ^(dev|staging|production)$ ]]; then
  echo "❌ Invalid environment: $ENV (must be dev, staging, or production)"
  exit 1
fi

CLUSTER="mc-${ENV}"
NAMESPACE="monkeyscloud-${ENV}"

echo "🚀 Deploying MonkeysCloud to ${ENV} (tag: ${TAG})"
echo "   Cluster:   ${CLUSTER}"
echo "   Namespace: ${NAMESPACE}"
echo "   Registry:  ${REGISTRY}"
echo ""

# Confirm production deploys
if [[ "$ENV" == "production" ]]; then
  read -rp "⚠️  You are deploying to PRODUCTION. Continue? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Step 1: Get cluster credentials
echo "📡 Getting cluster credentials..."
gcloud container clusters get-credentials "$CLUSTER" \
  --region "$REGION" \
  --project "$PROJECT"

# Step 2: Apply Kustomize overlay
echo "📦 Applying Kustomize overlay (k8s/overlays/${ENV})..."
kubectl apply -k "k8s/overlays/${ENV}"

# Step 3: Update image tags
echo "🏷️  Setting image tags to ${TAG}..."
kubectl -n "$NAMESPACE" set image deployment/api \
  "api=${REGISTRY}/api:${TAG}" 2>/dev/null || true
kubectl -n "$NAMESPACE" set image deployment/dashboard \
  "dashboard=${REGISTRY}/dashboard:${TAG}" 2>/dev/null || true
kubectl -n "$NAMESPACE" set image deployment/git-server \
  "git-server=${REGISTRY}/git-server:${TAG}" 2>/dev/null || true
kubectl -n "$NAMESPACE" set image deployment/cicd-worker \
  "cicd-worker=${REGISTRY}/cicd-worker:${TAG}" 2>/dev/null || true

# Step 4: Wait for rollouts
echo "⏳ Waiting for rollouts..."
kubectl -n "$NAMESPACE" rollout status deployment/api --timeout=300s
kubectl -n "$NAMESPACE" rollout status deployment/dashboard --timeout=300s
kubectl -n "$NAMESPACE" rollout status deployment/git-server --timeout=300s
echo ""

# Step 5: Verify
echo "✅ Deploy complete! Verifying pods..."
kubectl -n "$NAMESPACE" get pods -o wide
echo ""

echo "🌍 Service endpoints:"
kubectl -n "$NAMESPACE" get ingress -o wide 2>/dev/null || echo "   (No ingress found)"
echo ""
echo "🎉 Done! MonkeysCloud ${ENV} is live."
