# MonkeysCloud Platform

> **Multi-Stack Developer Platform** — Git • Task Management • Multi-Stack Hosting • AutoDeploy • Vertex AI Integration • Custom CI/CD

## Prerequisites

- **Docker Desktop** ≥ 4.x (with Docker Compose v2)
- **Git** ≥ 2.x
- **Make** (pre-installed on macOS/Linux)

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> monkeyscloud
cd monkeyscloud

# 2. First-time setup (copies env, builds images, starts services, runs migrations)
make setup

# 3. You're done! Open the dashboard
open http://localhost:3000
```

## Service URLs

| Service           | URL                   | Description              |
| ----------------- | --------------------- | ------------------------ |
| **Dashboard**     | http://localhost:3000 | Next.js frontend         |
| **API**           | http://localhost:8000 | MonkeysLegion PHP API    |
| **Git Server**    | http://localhost:3001 | Custom Git smart HTTP    |
| **Mailpit**       | http://localhost:8025 | Email testing UI         |
| **MinIO Console** | http://localhost:9001 | S3-compatible storage UI |
| **MySQL**         | localhost:3306        | Database                 |
| **Redis**         | localhost:6379        | Cache & queues           |

## Common Commands

```bash
make help              # Show all available commands
make up                # Start all services
make down              # Stop all services
make logs              # Follow all logs
make status            # Show service status + URLs
make shell-api         # Open shell in API container
make shell-db          # Open MySQL shell
make migrate           # Run database migrations
make seed              # Seed database with test data
make test              # Run PHP tests
make fresh             # Full reset (destroys data!)
```

## Project Structure

```
monkeyscloud/
├── api/                 # MonkeysLegion PHP backend
├── dashboard/           # Next.js frontend (Tailwind CSS)
├── mobile/              # Flutter app (Riverpod)
├── git-server/          # Custom Git smart HTTP server
├── cicd/                # Custom CI/CD pipeline engine
├── docker/              # Dockerfiles & configs per service
│   ├── api/             # PHP 8.4 + FrankenPHP
│   ├── dashboard/       # Node 22 + Next.js
│   ├── git-server/      # FrankenPHP + Git
│   ├── cicd/            # Build runner + Docker CLI
│   ├── nginx/           # Reverse proxy configs
│   └── mysql/           # Init scripts
├── k8s/                 # Kubernetes manifests (GKE)
├── infra/               # Terraform IaC (GCP)
├── docker-compose.yml   # Local dev environment
├── Makefile             # Developer commands
└── .env.example         # Environment template
```

## Architecture

The platform runs on 10 Docker services locally:

| Category  | Services                                                            |
| --------- | ------------------------------------------------------------------- |
| **Apps**  | API (FrankenPHP), Dashboard (Next.js), Git Server, CI/CD Worker     |
| **Data**  | MySQL 8.4, Redis 7                                                  |
| **Infra** | Nginx (reverse proxy), MinIO (S3), Mailpit (email), Docker Registry |

All data persists in named Docker volumes. Hot reload is enabled for API (`./api → /app`) and Dashboard (`./dashboard → /app`) via volume mounts.

## Environments

| Environment        | Stack           | Notes                            |
| ------------------ | --------------- | -------------------------------- |
| **Local**          | Docker Compose  | This setup, `make up`            |
| **GCP Dev**        | GKE + Terraform | `infra/environments/dev/`        |
| **GCP Staging**    | GKE + Terraform | `infra/environments/staging/`    |
| **GCP Production** | GKE + Terraform | `infra/environments/production/` |

---

_MonkeysCloud Corp • Denver, Colorado • monkeys.cloud_
