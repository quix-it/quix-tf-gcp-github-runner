data "archive_file" "get_remove_token" {
  type        = "zip"
  source_dir  = "${path.module}/function/"
  output_path = "${path.module}/get_remove_token.zip"
  excludes    = ["test"]
}

resource "google_storage_bucket" "get_remove_token_bucket" {
  name = "get_remove_token_bucket_${var.google.env}"
}

resource "google_storage_bucket_object" "get_remove_token" {
  name   = "get_remove_token_${data.archive_file.get_remove_token.output_md5}.zip"
  bucket = google_storage_bucket.get_remove_token_bucket.name
  source = "${path.module}/get_remove_token.zip"
}

resource "google_cloudfunctions_function" "get_remove_token" {
  name                  = "get_remove_token_function"
  description           = "Retrieving a remove token to un-register a self-hosted runner from the organisation"
  runtime               = "nodejs12"
  available_memory_mb   = 128
  timeout               = 60
  source_archive_bucket = google_storage_bucket.get_remove_token_bucket.name
  source_archive_object = google_storage_bucket_object.get_remove_token.name
  entry_point           = "getRemoveToken"
  service_account_email = google_service_account.get_remove_token.email
  trigger_http          = true

  environment_variables = {
    "GITHUB_API_TRIGGER_URL" = var.github_api_trigger_url
    "GITHUB_ORG"             = var.github_org
  }

}

resource "google_service_account" "get_remove_token" {
  account_id   = "get-remove-token-user"
  display_name = "get-remove-token User"
}

resource "google_project_iam_member" "get_remove_token_iam_service_account_user" {
  role   = "roles/iam.serviceAccountUser"
  member = "serviceAccount:${google_service_account.get_remove_token.email}"
}

output "function_name" {
  value = google_cloudfunctions_function.get_remove_token.name
}

output "function_service_account_name" {
  value = google_service_account.get_remove_token.email
}

output "https_trigger_url" {
  value = google_cloudfunctions_function.get_remove_token.https_trigger_url
}
