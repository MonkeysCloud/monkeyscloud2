# Production environment
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

inputs = {
  # Full-size instances for production
  gke_num_nodes_platform     = 5
  gke_machine_type_platform  = "e2-standard-4"
  gke_num_nodes_customers    = 10
  gke_machine_type_customers = "e2-standard-2"
  db_tier                    = "db-n1-standard-2"
  db_ha_enabled              = true
  redis_memory_size_gb       = 10
  ai_monthly_budget_usd      = 500
}
