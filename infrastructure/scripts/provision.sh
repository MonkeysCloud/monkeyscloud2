#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# MonkeysCloud — Provision VM via Terraform
# Usage: ./provision.sh <workspace_dir> <module_path>
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

WORKSPACE_DIR="$1"
MODULE_PATH="$2"

cd "$WORKSPACE_DIR"

echo "▶ Initializing Terraform..."
terraform init -backend-config="prefix=environments/$(basename "$WORKSPACE_DIR")" \
    -input=false -no-color 2>&1

echo "▶ Planning..."
terraform plan -input=false -no-color -out=tfplan 2>&1

echo "▶ Applying..."
terraform apply -input=false -no-color -auto-approve tfplan 2>&1

echo "▶ Outputs:"
terraform output -json 2>&1

echo "✅ Provisioning complete."
