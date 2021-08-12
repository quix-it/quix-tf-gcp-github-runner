resource "google_storage_bucket" "staging_artifacts" {
  name                        = "${var.google.artifacts_bucket}_${var.google.env}"
  location                    = var.google.region
  force_destroy               = true
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 1
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_project_iam_custom_role" "artifacts_manager" {
  role_id     = "artifacts_manager_role"
  title       = "Artifacts manager role"
  description = "Artifacts get, create, update"
  permissions = ["storage.objects.get", "storage.objects.create", "storage.objects.update", "storage.objects.delete"]
}

# data "google_iam_policy" "admin" {
#   binding {
#     role = "roles/storage.admin"
#     members = [
#       "projectOwner:${var.google.project}",
#     ]
#   }
# }

# resource "google_storage_bucket_iam_policy" "staging_artifacts_admin_policy" {
#   bucket      = google_storage_bucket.staging_artifacts.name
#   policy_data = data.google_iam_policy.admin.policy_data
# }

output "staging_artifacts_bucket" {
  value = google_storage_bucket.staging_artifacts.name
}

output "artifacts_manager_role" {
  value = google_project_iam_custom_role.artifacts_manager.id
}
