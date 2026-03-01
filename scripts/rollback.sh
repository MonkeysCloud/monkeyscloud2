#!/usr/bin/env bash
# =============================================================================
# MonkeysCloud — Rollback Script
# =============================================================================
# Usage:
#   ./scripts/rollback.sh <environment> [service]
#
# Examples:
#   ./scripts/rollback.sh production        # rollback all services
#   ./scripts/rollback.sh production api     # rollback only API
# =============================================================================
set -euo pipefail

ENV="${1:?Usage: rollback.sh <dev|staging|production> [service]}"
SERVICE="${2:-all}"
PROJECT="monkeyscloud2"
REGION="us-central1"
CLUSTER="mc-${ENV}"
NAMESPACE="monkeyscloud-${ENV}"

echo "⏪ Rolling back MonkeysCloud ${ENV}"

gcloud container clusters get-credentials "$CLUSTER" \
  --region "$REGION" --project "$PROJECT"

rollback() {
  local svc="$1"
  echo "   ↩️  Rolling back ${svc}..."
  kubectl -n "$NAMESPACE" rollout undo "deployment/${svc}"
  kubectl -n "$NAMESPACE" rollout status "deployment/${svc}" --timeout=180s
}

if [[ "$SERVICE" == "all" ]]; then
  rollback api
  rollback dashboard
  rollback git-server
  rollback cicd-worker
else
  rollback "$SERVICE"
fi

echo ""
echo "✅ Rollback complete!"
kubectl -n "$NAMESPACE" get pods -o wide
