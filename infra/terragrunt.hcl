# =============================================================================
# MonkeysCloud — Terragrunt Root Configuration
# =============================================================================
# DRY configuration for multi-environment Terraform deployments.
# Each environment (dev/staging/production) includes this file.
# =============================================================================

# State bucket (encrypted, versioned)
remote_state {
  backend = "gcs"
  config = {
    project  = local.project_id
    location = "us"
    bucket   = "monkeyscloud-tfstate-${local.environment}"
    prefix   = "${path_relative_to_include()}/terraform.tfstate"
  }
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
}

# Common inputs for all environments
inputs = {
  project_id  = local.project_id
  region      = local.region
  environment = local.environment
  domain      = "monkeys.cloud"
}

# Read environment-specific vars
locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  project_id  = local.env_vars.locals.project_id
  region      = local.env_vars.locals.region
  environment = local.env_vars.locals.environment
}
