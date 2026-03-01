# Staging environment
include "root" {
  path = find_in_parent_folders("terragrunt.hcl")
}

inputs = {
  gke_num_nodes_platform     = 3
  gke_machine_type_platform  = "e2-standard-4"
  gke_num_nodes_customers    = 5
  gke_machine_type_customers = "e2-standard-2"
  db_tier                    = "db-n1-standard-1"
  db_ha_enabled              = false
  redis_memory_size_gb       = 5
  ai_monthly_budget_usd      = 200
}
