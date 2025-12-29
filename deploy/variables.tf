variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "domain_name" {
  description = "The custom domain name"
  type        = string
}

variable "groq_api_key" {
  description = "Groq API Key"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google Client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google Client Secret"
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "Session Secret"
  type        = string
  sensitive   = true
}
