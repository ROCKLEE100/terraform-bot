terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "terraform-bot-repo"
  description   = "Docker repository for Terraform Bot"
  format        = "DOCKER"
}

# Backend Service
resource "google_cloud_run_v2_service" "backend" {
  name     = "terraform-bot-backend"
  location = var.region
  ingress = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}/backend:latest"
      ports {
        container_port = 8000
      }
      env {
        name  = "GROQ_API_KEY"
        value = var.groq_api_key
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "GOOGLE_CLIENT_SECRET"
        value = var.google_client_secret
      }
      env {
        name  = "SESSION_SECRET"
        value = var.session_secret
      }
    }
  }
}

# Frontend Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "terraform-bot-frontend"
  location = var.region
  ingress = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.name}/frontend:latest"
      ports {
        container_port = 80
      }
    }
  }
}

# Allow unauthenticated access to backend
resource "google_cloud_run_service_iam_member" "backend_public" {
  service  = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow unauthenticated access to frontend
resource "google_cloud_run_service_iam_member" "frontend_public" {
  service  = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
