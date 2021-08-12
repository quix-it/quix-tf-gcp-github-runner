provider "google" {
  credentials = base64decode(var.google.credentials_json_b64)
  project     = var.google.project
  region      = var.google.region
  zone        = var.google.zone
}

terraform {
  backend "local" {}
}

resource "google_storage_bucket" "tfstate" {
  name                        = var.bucket
  location                    = var.google.region
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

}

data "google_iam_policy" "admin" {
  binding {
    role = "roles/storage.admin"
    members = [
      "projectOwner:${var.google.project}",
    ]
  }
}

resource "google_storage_bucket_iam_policy" "tfstate_admin" {
  bucket      = google_storage_bucket.tfstate.name
  policy_data = data.google_iam_policy.admin.policy_data
}
