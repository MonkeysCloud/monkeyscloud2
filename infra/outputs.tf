# =============================================================================
# MonkeysCloud — Terraform Outputs
# =============================================================================

output "gke_cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.main.name
}

output "gke_cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "gke_cluster_ca_certificate" {
  description = "GKE cluster CA certificate (base64)"
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "db_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.main.private_ip_address
}

output "db_password" {
  description = "Cloud SQL app user password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "redis_host" {
  description = "Memorystore Redis host"
  value       = google_redis_instance.main.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.main.port
}

output "artifact_registry_platform" {
  description = "Platform Artifact Registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.platform.repository_id}"
}

output "artifact_registry_customers" {
  description = "Customers Artifact Registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.customers.repository_id}"
}

output "dns_zone_name" {
  description = "Cloud DNS managed zone name"
  value       = google_dns_managed_zone.main.name
}

output "dns_name_servers" {
  description = "DNS zone name servers"
  value       = google_dns_managed_zone.main.name_servers
}

output "assets_bucket" {
  description = "GCS assets bucket name"
  value       = google_storage_bucket.assets.name
}

output "api_service_account_email" {
  description = "API Workload Identity service account"
  value       = google_service_account.api.email
}

output "cicd_service_account_email" {
  description = "CI/CD Workload Identity service account"
  value       = google_service_account.cicd.email
}

output "git_service_account_email" {
  description = "Git Server Workload Identity service account"
  value       = google_service_account.git.email
}
