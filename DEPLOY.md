# MonkeysCloud — Production Deployment Checklist

## Pre-Deploy

- [ ] All CI checks pass on `main` branch
- [ ] Database migrations reviewed and tested on staging
- [ ] Terraform plan reviewed (`cd infra/environments/production && terragrunt plan`)
- [ ] Secrets configured (`./scripts/setup-secrets.sh production`)
- [ ] Artifact Registry images built and tagged
- [ ] DNS records point to GKE ingress external IP
- [ ] SSL certificates provisioned via cert-manager

## Infrastructure (First Time Only)

```bash
# 1. Provision GCP resources
cd infra/environments/production
terragrunt init
terragrunt apply

# 2. Configure secrets from Terraform outputs
./scripts/setup-secrets.sh production

# 3. Install ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 4. Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 5. Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@monkeys.cloud
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

## Deploy

```bash
# Deploy to production
./scripts/deploy.sh production <commit-sha>

# Or via Cloud Build (automatic on push to main)
git push origin main
```

## Post-Deploy

- [ ] Health endpoints responding (`curl https://api.monkeys.cloud/health`)
- [ ] Dashboard loads (`curl -I https://monkeys.cloud`)
- [ ] Git server responds (`curl https://git.monkeys.cloud/health`)
- [ ] Login flow works end-to-end
- [ ] Build queue consuming (check Redis)
- [ ] AI endpoints responding (Vertex AI key configured)

## Rollback

```bash
# Rollback all services
./scripts/rollback.sh production

# Rollback single service
./scripts/rollback.sh production api
```

## Monitoring

| Resource          | URL                                                          |
| ----------------- | ------------------------------------------------------------ |
| Cloud Logging     | `console.cloud.google.com/logs?project=monkeyscloud2`        |
| Cloud Monitoring  | `console.cloud.google.com/monitoring?project=monkeyscloud2`  |
| GKE Dashboard     | `console.cloud.google.com/kubernetes?project=monkeyscloud2`  |
| Cloud Build       | `console.cloud.google.com/cloud-build?project=monkeyscloud2` |
| Artifact Registry | `console.cloud.google.com/artifacts?project=monkeyscloud2`   |

## Environment Variables Reference

| Variable            | Source                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `DB_HOST`           | Terraform: `google_sql_database_instance.main.private_ip_address` |
| `DB_PASSWORD`       | Terraform: `random_password.db_password.result`                   |
| `REDIS_HOST`        | Terraform: `google_redis_instance.main.host`                      |
| `JWT_SECRET`        | Generated: `openssl rand -base64 64`                              |
| `VERTEX_AI_API_KEY` | GCP Console → APIs & Services → Credentials                       |
| `REGISTRY_URL`      | `us-central1-docker.pkg.dev/monkeyscloud2/mc-customers`           |
