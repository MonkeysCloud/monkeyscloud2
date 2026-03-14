terraform {
  backend "gcs" {
    bucket = "monkeyscloud-terraform-state"
    prefix = "environments"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

variable "project_id" {
  default = "monkeyscloud2"
}
