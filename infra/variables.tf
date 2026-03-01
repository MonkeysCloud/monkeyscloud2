# =============================================================================
# MonkeysCloud — Terraform Variables
# =============================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "domain" {
  description = "Base domain for the platform"
  type        = string
  default     = "monkeys.cloud"
}

# --- GKE ---
variable "gke_num_nodes_platform" {
  description = "Number of GKE nodes for platform workloads"
  type        = number
  default     = 3
}

variable "gke_machine_type_platform" {
  description = "Machine type for platform node pool"
  type        = string
  default     = "e2-standard-4"
}

variable "gke_num_nodes_customers" {
  description = "Initial number of GKE nodes for customer workloads"
  type        = number
  default     = 3
}

variable "gke_machine_type_customers" {
  description = "Machine type for customer node pool"
  type        = string
  default     = "e2-standard-2"
}

# --- Cloud SQL ---
variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-n1-standard-1"
}

variable "db_ha_enabled" {
  description = "Enable Cloud SQL High Availability"
  type        = bool
  default     = false
}

# --- Redis ---
variable "redis_memory_size_gb" {
  description = "Redis instance memory size in GB"
  type        = number
  default     = 1
}

# --- AI ---
variable "ai_monthly_budget_usd" {
  description = "Vertex AI monthly budget in USD"
  type        = number
  default     = 50
}
