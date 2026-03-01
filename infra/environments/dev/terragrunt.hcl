# Dev environment
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

inputs = {
  # Small instances for dev
  gke_num_nodes_platform     = 2
  gke_machine_type_platform  = "e2-standard-2"
  gke_num_nodes_customers    = 2
  gke_machine_type_customers = "e2-medium"
  db_tier                    = "db-f1-micro"
  db_ha_enabled              = false
  redis_memory_size_gb       = 1
  ai_monthly_budget_usd      = 50
}
