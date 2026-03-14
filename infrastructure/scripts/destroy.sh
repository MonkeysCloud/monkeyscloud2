#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# MonkeysCloud — Destroy VM via Terraform
# Usage: ./destroy.sh <workspace_dir>
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

WORKSPACE_DIR="$1"

cd "$WORKSPACE_DIR"

echo "▶ Destroying infrastructure..."
terraform destroy -input=false -no-color -auto-approve 2>&1

echo "✅ Infrastructure destroyed."
