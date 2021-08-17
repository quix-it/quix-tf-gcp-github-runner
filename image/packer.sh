#!/bin/bash
# Exit immediately if a command returns a non-zero status
set -e

# Printing script usage
program_name=$0
usage () {
  echo "usage: $program_name [--env-file google-env-file.json] [--packer-action build]"
  exit 1
}

# Parsing script params
while true; do
  case "$1" in
    --env-file ) env_file="$2"; shift 2 ;;
    --packer-action ) packer_action="$2"; shift 2;;
    * ) break ;;
  esac
done

# Checking script params
if [ -z "$env_file" ]; then
    usage
fi

if [ -z "$packer_action" ]; then
    usage
fi

env_file_path=$(realpath "$env_file")
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
project_root_path=$(realpath "$script_dir/..")
packer_project_path=$project_root_path/image
default_tfvars_json_path="$project_root_path/terraform.tfvars.json"

# shellcheck source=.tools/extract-and-export.sh
source "$project_root_path"/.tools/extract-and-export.sh "$default_tfvars_json_path"

# shellcheck source=.tools/extract-and-export.sh
source "$project_root_path"/.tools/extract-and-export.sh "$env_file_path"

# shellcheck source=.tools/load-google-auth.sh
source "$project_root_path"/.tools/load-google-auth.sh "$env_file_path"

network=$(jq -r '.builders[]|select(.type=="googlecompute")|.network' < $packer_project_path/runner.json)
my_public_ip=$(curl -s https://api.ipify.org)

rule_name=packer-allow-ssh-$(dd if=/dev/urandom bs=16 count=1 2>/dev/null | md5sum | cut -d" " -f1)

if [ ! -z "$network" ]; then
  gcloud compute networks describe $network >/dev/null 2>&1 || gcloud compute networks create $network
  gcloud compute firewall-rules describe $rule_name >/dev/null 2>&1 || gcloud compute firewall-rules create $rule_name --network $network --allow tcp:22 --source-ranges ${my_public_ip}/32
fi

packer_cmd="packer $packer_action \
  -var region=$GOOGLE_REGION \
  -var zone=$GOOGLE_ZONE \
  -var machine_type=$RUNNER_MACHINE_TYPE \
  -var image=$RUNNER_IMAGE \
  -var project_id=$GOOGLE_PROJECT \
  -var path=$packer_project_path \
  $packer_project_path/runner.json"

eval "$packer_cmd"

if [ ! -z "$network" ]; then
  gcloud compute firewall-rules list --filter=network=${network} --format=json | jq -r '.[].name' | xargs -r -n1 gcloud compute firewall-rules --quiet delete
  gcloud compute networks delete --quiet $network
fi
