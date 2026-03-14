output "external_ip" {
  value = google_compute_address.prod_ip.address
}

output "nameservers" {
  value = data.google_dns_managed_zone.prod_zone.name_servers
}
