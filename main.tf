provider "google" {
  credentials = base64decode(var.google.credentials_json_b64)
  project     = var.google.project
  region      = var.google.region
  zone        = var.google.zone
}

terraform {
  backend "gcs" {}
}

resource "google_project_service" "gcp_services" {
  for_each = toset([
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "secretmanager.googleapis.com",
    "compute.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
  ])

  service = each.key

  disable_on_destroy = false
}

resource "google_compute_network" "network" {
  name                    = var.runner.network
  auto_create_subnetworks = true
}

module "start_and_stop" {
  source                       = "./modules/start-and-stop"
  google                       = var.google
  runner                       = var.runner
  scaling                      = var.scaling
  triggers                     = var.triggers
  github_api_trigger_url       = module.github_api.https_trigger_url
  github_org                   = var.github.organisation
  get_remove_token_trigger_url = module.get_remove_token.https_trigger_url

  depends_on = [
    google_project_service.gcp_services
  ]
}

module "get_remove_token" {
  source                 = "./modules/get-remove-token"
  google                 = var.google
  github_api_trigger_url = module.github_api.https_trigger_url
  github_org             = var.github.organisation

  depends_on = [
    google_project_service.gcp_services
  ]
}

module "github_api" {
  source             = "./modules/github-api"
  secret_github_json = module.secrets.secret_github_json
  google             = var.google

  depends_on = [google_project_service.gcp_services]
}

module "secrets" {
  source = "./modules/secrets"
  github = var.github

  depends_on = [google_project_service.gcp_services]
}

module "github_hook" {
  source                    = "./modules/github-hook"
  google                    = var.google
  secret_github_json        = module.secrets.secret_github_json
  start_and_stop_topic_name = module.start_and_stop.start_and_stop_topic_name

  depends_on = [google_project_service.gcp_services]
}

module "staging_artifacts" {
  source = "./modules/staging-artifacts"
  google = var.google

  depends_on = [google_project_service.gcp_services]
}

output "github_webhook_url" {
  value = module.github_hook.github_hook_trigger_url
}

output "runner_service_account_email" {
  value = module.start_and_stop.runner_service_account_email
}

output "staging_artifacts_bucket" {
  value = module.staging_artifacts.staging_artifacts_bucket
}

locals {
  github_api_invokers = [
    "serviceAccount:${module.start_and_stop.function_service_account_name}",
    "serviceAccount:${module.get_remove_token.function_service_account_name}"
  ]
  get_remove_token_invokers = [
    "serviceAccount:${module.start_and_stop.runner_service_account_email}"
  ]
  artifacts_managers = [
    "serviceAccount:${module.start_and_stop.runner_service_account_email}"
  ]
}

resource "google_cloudfunctions_function_iam_member" "github_api_invokers" {
  count          = length(local.github_api_invokers)
  cloud_function = module.github_api.function_name
  role           = "roles/cloudfunctions.invoker"
  member         = local.github_api_invokers[count.index]
}

resource "google_cloudfunctions_function_iam_member" "get_remove_token_invokers" {
  count          = length(local.get_remove_token_invokers)
  cloud_function = module.get_remove_token.function_name
  role           = "roles/cloudfunctions.invoker"
  member         = local.get_remove_token_invokers[count.index]
}

resource "google_storage_bucket_iam_member" "artifacts_managers" {
  count  = length(local.artifacts_managers)
  bucket = module.staging_artifacts.staging_artifacts_bucket
  role   = module.staging_artifacts.artifacts_manager_role
  member = local.artifacts_managers[count.index]
}
