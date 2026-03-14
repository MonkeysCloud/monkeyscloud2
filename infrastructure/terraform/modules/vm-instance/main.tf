terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

locals {
  instance_name = "${var.org_slug}-${var.project_slug}-${var.env_slug}"
  labels = {
    org         = var.org_slug
    project     = var.project_slug
    environment = var.env_slug
    managed_by  = "monkeyscloud"
  }
  # Extract region from zone (e.g. "us-central1-a" → "us-central1")
  region = join("-", slice(split("-", var.region), 0, 2))
}

# ─── Static External IP ────────────────────────────────────────────
resource "google_compute_address" "static_ip" {
  name         = "${local.instance_name}-ip"
  project      = var.project_id
  region       = local.region
  address_type = "EXTERNAL"
}

# ─── Firewall: HTTP/HTTPS ──────────────────────────────────────────
resource "google_compute_firewall" "http" {
  name    = "${local.instance_name}-http"
  project = var.project_id
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.instance_name]
}

# ─── Firewall: SSH ─────────────────────────────────────────────────
resource "google_compute_firewall" "ssh" {
  name    = "${local.instance_name}-ssh"
  project = var.project_id
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.instance_name]
}

# ─── GCE VM Instance ──────────────────────────────────────────────
resource "google_compute_instance" "vm" {
  name         = local.instance_name
  project      = var.project_id
  zone         = var.region
  machine_type = var.machine_type

  tags = [local.instance_name]

  labels = local.labels

  boot_disk {
    initialize_params {
      image = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2404-lts-amd64"
      size  = var.disk_size_gb
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.static_ip.address
    }
  }

  metadata = {
    ssh-keys = var.ssh_public_key != "" ? "${var.ssh_user}:${var.ssh_public_key}" : ""
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh", {
    ssh_user     = var.ssh_user
    ssh_password = var.ssh_password
    stack        = var.stack
    org_slug     = var.org_slug
    project_slug = var.project_slug
    env_slug     = var.env_slug
    hostname     = var.hostname
    git_repo_url = var.git_repo_url
    git_branch   = var.git_branch
  })

  service_account {
    scopes = ["cloud-platform"]
  }

  allow_stopping_for_update = true

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }
}

# ─── GCP-Managed SSL Certificate ──────────────────────────────────
resource "google_compute_managed_ssl_certificate" "ssl" {
  name    = "${local.instance_name}-ssl"
  project = var.project_id

  managed {
    domains = [var.hostname]
  }
}

# ─── Instance Group (for LB backend) ──────────────────────────────
resource "google_compute_instance_group" "group" {
  name    = "${local.instance_name}-group"
  project = var.project_id
  zone    = var.region

  instances = [google_compute_instance.vm.id]

  named_port {
    name = "http"
    port = 80
  }
}

# ─── Health Check ─────────────────────────────────────────────────
resource "google_compute_health_check" "http" {
  name    = "${local.instance_name}-hc"
  project = var.project_id

  http_health_check {
    port         = 80
    request_path = "/"
  }

  check_interval_sec  = 10
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3
}

# ─── Backend Service ──────────────────────────────────────────────
resource "google_compute_backend_service" "backend" {
  name        = "${local.instance_name}-backend"
  project     = var.project_id
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  health_checks = [google_compute_health_check.http.id]

  backend {
    group = google_compute_instance_group.group.id
  }
}

# ─── URL Map ──────────────────────────────────────────────────────
resource "google_compute_url_map" "urlmap" {
  name            = "${local.instance_name}-urlmap"
  project         = var.project_id
  default_service = google_compute_backend_service.backend.id
}

# ─── HTTPS Target Proxy ──────────────────────────────────────────
resource "google_compute_target_https_proxy" "proxy" {
  name             = "${local.instance_name}-https-proxy"
  project          = var.project_id
  url_map          = google_compute_url_map.urlmap.id
  ssl_certificates = [google_compute_managed_ssl_certificate.ssl.id]
}

# ─── Global Forwarding Rule (HTTPS) ──────────────────────────────
resource "google_compute_global_forwarding_rule" "https" {
  name       = "${local.instance_name}-https-rule"
  project    = var.project_id
  target     = google_compute_target_https_proxy.proxy.id
  port_range = "443"
  ip_protocol = "TCP"
}

# ─── HTTP → HTTPS Redirect ──────────────────────────────────────
resource "google_compute_url_map" "redirect" {
  name    = "${local.instance_name}-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    strip_query            = false
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "${local.instance_name}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name       = "${local.instance_name}-http-rule"
  project    = var.project_id
  target     = google_compute_target_http_proxy.redirect.id
  port_range = "80"
  ip_protocol = "TCP"
}

# ─── Cloud DNS A-Record ──────────────────────────────────────────────
resource "google_dns_record_set" "env" {
  managed_zone = var.dns_zone_name
  name         = "${var.hostname}."
  type         = "A"
  ttl          = 300
  project      = var.project_id
  rrdatas      = [google_compute_global_forwarding_rule.https.ip_address]
}
