variable "project_id" {
  type    = string
  default = "monkeyscloud2"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "machine_type" {
  type    = string
  default = "e2-medium"
}

variable "ssh_user" {
  type    = string
  default = "deploy"
}

variable "ssh_pub_key" {
  type        = string
  description = "Public SSH key for the deploy user"
}
