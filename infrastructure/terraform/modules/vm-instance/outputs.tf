output "external_ip" {
  description = "External IP address of the VM"
  value       = google_compute_address.static_ip.address
}

output "internal_ip" {
  description = "Internal IP address of the VM"
  value       = google_compute_instance.vm.network_interface[0].network_ip
}

output "instance_name" {
  description = "Name of the GCE instance"
  value       = google_compute_instance.vm.name
}

output "instance_id" {
  description = "GCE instance ID"
  value       = google_compute_instance.vm.instance_id
}

output "zone" {
  description = "Zone of the instance"
  value       = google_compute_instance.vm.zone
}

output "ssh_connection" {
  description = "SSH connection string"
  value       = "ssh ${var.ssh_user}@${google_compute_address.static_ip.address}"
}

output "ssl_certificate_status" {
  description = "Status of the GCP-managed SSL certificate"
  value       = google_compute_managed_ssl_certificate.ssl.id
}

output "lb_ip" {
  description = "Global HTTPS load balancer IP"
  value       = google_compute_global_forwarding_rule.https.ip_address
}

output "domain" {
  description = "Full domain name"
  value       = "${var.env_slug}.${var.project_slug}.${var.org_slug}.monkeys.cloud"
}
