# =============================================================================
# MonkeysCloud — Terraform Root Module
# =============================================================================
# Usage:
#   cd infra/environments/dev
#   terragrunt init
#   terragrunt plan
#   terragrunt apply
# =============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }

  # State stored in GCS (configured by Terragrunt)
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# =============================================================================
# NETWORKING — VPC + Subnets
# =============================================================================

resource "google_compute_network" "main" {
  name                    = "mc-${var.environment}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "gke" {
  name          = "mc-${var.environment}-gke-subnet"
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = "10.10.0.0/20"

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.20.0.0/14"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.24.0.0/20"
  }

  private_ip_google_access = true
}

# Private Services Access (Cloud SQL, Memorystore)
resource "google_compute_global_address" "private_services" {
  name          = "mc-${var.environment}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

# NAT for outbound internet (build pulls, etc.)
resource "google_compute_router" "main" {
  name    = "mc-${var.environment}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "mc-${var.environment}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# =============================================================================
# GKE CLUSTER
# =============================================================================

resource "google_container_cluster" "main" {
  provider = google-beta

  name     = "mc-${var.environment}"
  location = var.region

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.gke.id

  # Autopilot or standard
  remove_default_node_pool = true
  initial_node_count       = 1

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Private cluster
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Binary Authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_RESOURCE"
  }

  # Logging + monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus { enabled = true }
  }

  release_channel {
    channel = var.environment == "production" ? "STABLE" : "REGULAR"
  }

  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T04:00:00Z"
      end_time   = "2024-01-01T08:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA"
    }
  }
}

# --- Platform Node Pool (API, Dashboard, Git Server) ---

resource "google_container_node_pool" "platform" {
  name     = "platform"
  cluster  = google_container_cluster.main.id
  location = var.region

  node_count = var.gke_num_nodes_platform

  node_config {
    machine_type = var.gke_machine_type_platform
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      pool        = "platform"
      environment = var.environment
    }

    taint {
      key    = "pool"
      value  = "platform"
      effect = "NO_SCHEDULE"
    }
  }

  autoscaling {
    min_node_count = var.gke_num_nodes_platform
    max_node_count = var.gke_num_nodes_platform * 3
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# --- Customer Node Pool (Customer deployments + CI/CD builds) ---

resource "google_container_node_pool" "customers" {
  name     = "customers"
  cluster  = google_container_cluster.main.id
  location = var.region

  node_count = var.gke_num_nodes_customers

  node_config {
    machine_type = var.gke_machine_type_customers
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      pool        = "customers"
      environment = var.environment
    }

    taint {
      key    = "pool"
      value  = "customers"
      effect = "NO_SCHEDULE"
    }
  }

  autoscaling {
    min_node_count = var.gke_num_nodes_customers
    max_node_count = var.gke_num_nodes_customers * 5
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# =============================================================================
# CLOUD SQL (PostgreSQL 16)
# =============================================================================

resource "google_sql_database_instance" "main" {
  name             = "mc-${var.environment}-postgres"
  database_version = "POSTGRES_16"
  region           = var.region

  depends_on = [google_service_networking_connection.private]

  settings {
    tier              = var.db_tier
    availability_type = var.db_ha_enabled ? "REGIONAL" : "ZONAL"
    disk_size         = 50
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "production"
      transaction_log_retention_days = var.environment == "production" ? 7 : 3
      backup_retention_settings {
        retained_backups = var.environment == "production" ? 30 : 7
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 4
      update_track = "stable"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
    database_flags {
      name  = "max_connections"
      value = "200"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = true
    }
  }

  deletion_protection = var.environment == "production"
}

resource "google_sql_database" "monkeyscloud" {
  name     = "monkeyscloud"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "monkeyscloud"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

# =============================================================================
# MEMORYSTORE (Redis 7)
# =============================================================================

resource "google_redis_instance" "main" {
  name           = "mc-${var.environment}-redis"
  region         = var.region
  tier           = var.environment == "production" ? "STANDARD_HA" : "BASIC"
  memory_size_gb = var.redis_memory_size_gb
  redis_version  = "REDIS_7_2"

  authorized_network = google_compute_network.main.id

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }

  depends_on = [google_service_networking_connection.private]
}

# =============================================================================
# ARTIFACT REGISTRY
# =============================================================================

resource "google_artifact_registry_repository" "platform" {
  location      = var.region
  repository_id = "mc-platform"
  format        = "DOCKER"
  description   = "Platform service images (API, Dashboard, Git Server, CI/CD)"
}

resource "google_artifact_registry_repository" "customers" {
  location      = var.region
  repository_id = "mc-customers"
  format        = "DOCKER"
  description   = "Customer application images (built by CI/CD)"
}

# =============================================================================
# CLOUD DNS
# =============================================================================

resource "google_dns_managed_zone" "main" {
  name        = "mc-${var.environment}-zone"
  dns_name    = var.environment == "production" ? "${var.domain}." : "${var.environment}.${var.domain}."
  description = "MonkeysCloud ${var.environment} DNS zone"
}

resource "google_dns_record_set" "api" {
  managed_zone = google_dns_managed_zone.main.name
  name         = var.environment == "production" ? "api.${var.domain}." : "api.${var.environment}.${var.domain}."
  type         = "A"
  ttl          = 300
  rrdatas      = [] # Populated by ingress controller external IP
}

resource "google_dns_record_set" "app" {
  managed_zone = google_dns_managed_zone.main.name
  name         = var.environment == "production" ? "${var.domain}." : "${var.environment}.${var.domain}."
  type         = "A"
  ttl          = 300
  rrdatas      = []
}

resource "google_dns_record_set" "git" {
  managed_zone = google_dns_managed_zone.main.name
  name         = var.environment == "production" ? "git.${var.domain}." : "git.${var.environment}.${var.domain}."
  type         = "A"
  ttl          = 300
  rrdatas      = []
}

# =============================================================================
# IAM — Workload Identity + Service Accounts
# =============================================================================

# API service account
resource "google_service_account" "api" {
  account_id   = "mc-${var.environment}-api"
  display_name = "MonkeysCloud API (${var.environment})"
}

resource "google_project_iam_member" "api_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_ai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

# Workload Identity binding (K8s SA → GCP SA)
resource "google_service_account_iam_member" "api_workload_identity" {
  service_account_id = google_service_account.api.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[monkeyscloud-${var.environment}/monkeyscloud-api]"
}

# CI/CD service account
resource "google_service_account" "cicd" {
  account_id   = "mc-${var.environment}-cicd"
  display_name = "MonkeysCloud CI/CD Worker (${var.environment})"
}

resource "google_project_iam_member" "cicd_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_gke" {
  project = var.project_id
  role    = "roles/container.developer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_service_account_iam_member" "cicd_workload_identity" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[monkeyscloud-${var.environment}/monkeyscloud-cicd]"
}

# Git server service account
resource "google_service_account" "git" {
  account_id   = "mc-${var.environment}-git"
  display_name = "MonkeysCloud Git Server (${var.environment})"
}

resource "google_project_iam_member" "git_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.git.email}"
}

resource "google_service_account_iam_member" "git_workload_identity" {
  service_account_id = google_service_account.git.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[monkeyscloud-${var.environment}/monkeyscloud-git]"
}

# =============================================================================
# GCS BUCKET (Backups, user uploads, build artifacts)
# =============================================================================

resource "google_storage_bucket" "assets" {
  name          = "mc-${var.environment}-assets-${var.project_id}"
  location      = var.region
  force_destroy = var.environment != "production"
  storage_class = "STANDARD"

  uniform_bucket_level_access = true

  versioning {
    enabled = var.environment == "production"
  }

  lifecycle_rule {
    action { type = "Delete" }
    condition { age = var.environment == "production" ? 365 : 90 }
  }

  cors {
    origin          = var.environment == "production" ? ["https://${var.domain}"] : ["*"]
    method          = ["GET", "PUT", "POST"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}
