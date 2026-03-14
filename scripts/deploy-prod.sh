#!/bin/bash
set -euo pipefail

SERVICE="${1:?Usage: deploy-prod.sh <service-name> [image-tag]}"
IMAGE_TAG="${2:-$(git rev-parse --short HEAD)}"
PROJECT_ID="${PROJECT_ID:-monkeyscloud2}"
REGION="${REGION:-us-central1}"
CLUSTER="mc-prod-cluster"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/mc-prod-services"
NAMESPACE="monkeyscloud"

echo "=== PRODUCTION DEPLOY: $SERVICE (tag: $IMAGE_TAG) ==="
echo "⚠️  This will deploy to PRODUCTION. Are you sure? (yes/no)"
read -r confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Aborted."
    exit 1
fi

# 1. Determine Dockerfile
case "$SERVICE" in
    api)         DOCKERFILE="docker/api/Dockerfile" ;;
    dashboard)   DOCKERFILE="docker/dashboard/Dockerfile" ;;
    socket-server) DOCKERFILE="docker/websocket/Dockerfile" ;;
    git-server)  DOCKERFILE="docker/git-server/Dockerfile" ;;
    *)           echo "Unknown service: $SERVICE"; exit 1 ;;
esac

# 2. Build + push
echo "→ Building image..."
docker build -t "$REGISTRY/$SERVICE:$IMAGE_TAG" -f "$DOCKERFILE" .
docker push "$REGISTRY/$SERVICE:$IMAGE_TAG"

# 3. Update deployment
echo "→ Updating K8s deployment..."
gcloud container clusters get-credentials "$CLUSTER" --region "$REGION"

MANIFEST="k8s/services/$SERVICE.yaml"
if [[ -f "$MANIFEST" ]]; then
    echo "→ Applying manifest: $MANIFEST"
    sed "s|IMAGE_PLACEHOLDER|${REGISTRY}/${SERVICE}:${IMAGE_TAG}|g" "$MANIFEST" \
      | kubectl apply -n "$NAMESPACE" -f -
else
    kubectl set image "deployment/$SERVICE" \
      "$SERVICE=$REGISTRY/$SERVICE:$IMAGE_TAG" \
      -n "$NAMESPACE"
fi

# 4. Wait for rollout
echo "→ Waiting for rollout..."
kubectl rollout status "deployment/$SERVICE" -n "$NAMESPACE" --timeout=600s

# 5. Verify health
echo "→ Verifying health..."
sleep 10
POD=$(kubectl get pod -n "$NAMESPACE" -l "app=$SERVICE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [[ -n "$POD" ]]; then
    kubectl exec -n "$NAMESPACE" "$POD" -- curl -sf http://localhost:8000/health 2>/dev/null || {
        echo "❌ Health check failed! Rolling back..."
        kubectl rollout undo "deployment/$SERVICE" -n "$NAMESPACE"
        exit 1
    }
fi

echo "✅ $SERVICE deployed to PRODUCTION (tag: $IMAGE_TAG)"
