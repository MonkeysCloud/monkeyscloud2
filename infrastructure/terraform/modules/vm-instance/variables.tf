variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "monkeyscloud2"
}

variable "org_slug" {
  description = "Organization slug"
  type        = string
}

variable "project_slug" {
  description = "Project slug"
  type        = string
}

variable "env_slug" {
  description = "Environment slug (e.g. dev, test, prod)"
  type        = string
}

variable "env_id" {
  description = "Environment database ID"
  type        = number
}

variable "region" {
  description = "GCE zone (e.g. us-central1-a)"
  type        = string
  default     = "us-central1-a"
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-small"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 20
}

variable "stack" {
  description = "Project stack (e.g. monkeyslegion, nextjs, docker)"
  type        = string
  default     = "docker"
}

variable "ssh_user" {
  description = "SSH deploy user"
  type        = string
  default     = "deploy"
}

variable "ssh_password" {
  description = "SSH password (will be set on VM)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ssh_public_key" {
  description = "SSH public key for key-based auth"
  type        = string
  default     = ""
}

variable "git_repo_url" {
  description = "Git HTTP clone URL for the project repo"
  type        = string
}

variable "git_branch" {
  description = "Git branch to checkout"
  type        = string
  default     = "main"
}

variable "hostname" {
  description = "Full hostname (e.g. dev-myapp-myorg.monkeys.cloud)"
  type        = string
}

variable "dns_zone_name" {
  description = "Cloud DNS managed zone name for monkeys.cloud"
  type        = string
  default     = "monkeys-cloud"
}
