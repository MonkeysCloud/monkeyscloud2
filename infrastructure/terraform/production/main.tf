terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project     = var.project_id
  region      = var.region
  credentials = file("../../../gcp-key.json")
}

# --- VPC & Firewall ---
resource "google_compute_firewall" "allow_web" {
  name    = "prod-allow-web"
  network = "default"
  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
}

# --- Static IP & DNS ---
resource "google_compute_address" "prod_ip" {
  name   = "monkeyscloud-prod-ip"
  region = var.region
}

data "google_dns_managed_zone" "prod_zone" {
  name        = "monkeys-cloud"
}

resource "google_dns_record_set" "a_records" {
  for_each = toset(["", "api.", "git.", "ws.", "app."])

  name         = "${each.key}${data.google_dns_managed_zone.prod_zone.dns_name}"
  managed_zone = data.google_dns_managed_zone.prod_zone.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_address.prod_ip.address]
}

# --- Dedicated Git SSD Disk ---
resource "google_compute_disk" "git_data" {
  name  = "monkeyscloud-git-data"
  type  = "pd-ssd"
  zone  = var.zone
  size  = 50
}

# --- Compute Engine VM ---
resource "google_compute_instance" "app_server" {
  name         = "monkeyscloud-prod-vm"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["web-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 30
      type  = "pd-balanced"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.prod_ip.address
    }
  }

  attached_disk {
    source      = google_compute_disk.git_data.id
    device_name = "git-data"
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${var.ssh_pub_key}"
  }

  metadata_startup_script = <<-EOT
    #!/bin/bash
    set -e

    LOG_FILE="/var/log/startup-script.log"
    exec > >(tee -a "$LOG_FILE") 2>&1
    echo "Starting prod VM setup at $(date)"

    # --- 1. Mount Dedicated Git Disk ---
    echo "Formatting and mounting Git SSD..."
    if ! blkid /dev/disk/by-id/google-git-data; then
      mkfs.ext4 -m 0 -F -E lazy_itable_init=0,lazy_journal_init=0,discard /dev/disk/by-id/google-git-data
    fi
    mkdir -p /mnt/git-data
    echo UUID=$(blkid -s UUID -o value /dev/disk/by-id/google-git-data) /mnt/git-data ext4 discard,defaults,nofail 0 2 | tee -a /etc/fstab
    mount -a

    # --- 2. Setup Deploy User ---
    echo "Setting up deploy user..."
    useradd -m -s /bin/bash ${var.ssh_user} || true
    echo "${var.ssh_user} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${var.ssh_user}
    chown -R ${var.ssh_user}:${var.ssh_user} /mnt/git-data

    # --- 3. Install Docker ---
    echo "Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git ufw

    usermod -aG docker ${var.ssh_user}
    systemctl enable docker
    systemctl start docker

    # --- 4. Setup UFW Firewall ---
    ufw --force enable
    ufw allow ssh
    ufw allow http
    ufw allow https

    echo "Production VM startup complete. Ready for GitHub Actions deployment."
  EOT

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }
}
