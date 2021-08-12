#!/bin/bash
# Exit immediately if a command returns a non-zero status
set -e

# Printing script usage
program_name=$0
usage () {
  echo "usage: $program_name { linux | windows | --google-env-file google-env-file.json --github-env-file github-env-file.json --backend-config-file backend.json } [ --skip-packer-deploy ] [ --skip-terraform-deploy ] [ --auto-approve ]"
  exit 1
}

init () {
  jq -r '.google.credentials_json_b64' $google_env_file_path | base64 -d > $(dirname $google_env_file_path)/auth.json
  gcloud auth activate-service-account $(jq -r .client_email $(dirname $google_env_file_path)/auth.json) --key-file=$(dirname $google_env_file_path)/auth.json --project=$(jq -r .project_id $(dirname $google_env_file_path)/auth.json)
}

packer_deploy () {
  # Deploy packer image
  echo "Deploying runner image using packer..."
  cd image
  base_packer_cmd="bash packer.sh --env-file $google_env_file_path --packer-action"
  packer_cmd_build="$base_packer_cmd 'build'"
  set +e
  eval "$packer_cmd_build"
  packer_cmd_exit_code=$?
  set -e
  if [ $packer_cmd_exit_code -ne 0 ]; then
    echo "Packer build failed, maybe the image already exists, check logs for more info"
    if [ "$auto_approve" = false ]; then
      read -r -p "Would you like to force deploy the image? (y/n):" input
    fi
    if [ "$input" = "y" ] || [ "$auto_approve" = true ]; then
      packer_cmd_build_force="$base_packer_cmd 'build -force'"
      eval "$packer_cmd_build_force"
    fi
  fi
  echo "Deploying runner image using packer done"
  cd "$project_root_path"
}

terraform_deploy () {
  # Compile TS
  declare -a js_src_folders=("modules/start-and-stop/function" "modules/github-api/src" "modules/github-hook/function" "modules/get-remove-token/function")
  if [ "$skip_function_rebuild" = "false" ]; then
    for js_src_folder in "${js_src_folders[@]}"; do
      cd "$project_root_path/$js_src_folder" && echo "$js_src_folder"
      npm ci && npm run build
    done
    # while [ $(jobs | wc -l) -gt 0 ]; do sleep 1; done
  fi
  cd "$project_root_path"

  # Deploy terraform
  echo "Deploying infra using terraform..."
  terraform init -backend-config="$backend_config_file_path"
  terraform_apply_cmd="terraform apply -var-file=$google_env_file_path -var-file=$github_env_file_path"
  if [ "$auto_approve" = true ]; then
    terraform_apply_cmd="$terraform_apply_cmd -auto-approve"
  fi
  eval "$terraform_apply_cmd"
  
  echo "Deploying infra using terraform done"
}

# Default scripts params
skip_packer_deploy=false
skip_terraform_deploy=false
auto_approve=false
skip_function_rebuild=false
platform=""
# Parsing script params
while true; do
  case "$1" in
    --google-env-file ) google_env_file="$2"; shift 2 ;;
    --github-env-file ) github_env_file="$2"; shift 2 ;;
    --backend-config-file ) backend_config_file="$2"; shift 2 ;;
    linux ) platform=linux; shift 1 ;;
    windows ) platform=windows; shift 1;;
    --skip-packer-deploy ) skip_packer_deploy=true; shift 1;;
    --skip-terraform-deploy ) skip_terraform_deploy=true; shift 1;;
    --auto-approve ) auto_approve=true; shift 1;;
    --skip-function-rebuild ) skip_function_rebuild=true; shift 1;;
    * ) break ;;
  esac
done

if [ -z "$platform" ]; then
  usage
fi

google_env_file="google-${platform}.tfvars.json"
github_env_file="github-${platform}.tfvars.json"
backend_config_file="backend-${platform}.tfvars.json"

# Checking script params
if [ -z "$google_env_file" ]; then
  usage
fi

if [ -z "$github_env_file" ]; then
  usage
fi

if [ -z "$backend_config_file" ]; then
  usage
fi

google_env_file_path=$(realpath "$google_env_file")
github_env_file_path=$(realpath "$github_env_file")
backend_config_file_path=$(realpath "$backend_config_file")
project_root_path=$(realpath "$(dirname "$0")/..")

# cd project root directory
cd "$project_root_path"

init

if [ "$skip_packer_deploy" = true ]; then
  echo "Skipping packer deploy"
else
  packer_deploy
fi

if [ "$skip_terraform_deploy" = true ]; then
  echo "Skipping terraform deploy"
else
  terraform_deploy
fi

