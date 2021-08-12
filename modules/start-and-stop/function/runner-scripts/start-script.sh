#!/bin/bash

echo "start startup script"

RUNNER_USER="runner"

## Start stack driver
sudo service stackdriver-agent start

## Fetch registration token
ZONE=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/zone)
TAINT_LABELS=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/taint-labels)
RUNNER_TYPE=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/type)
GOOGLE_ENV=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/env)
GITHUB_ORG=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/github-org)
REGISTRATION_TOKEN=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/registration-token)

if [ -n "$REGISTRATION_TOKEN" ]; then
  echo "registration token fetched successfully"
else
  echo "error fetching registration token" >&2
fi

## Runner
cd "/home/$RUNNER_USER/actions-runner" || exit 1
if [ "$TAINT_LABELS" = true ]; then
  echo "runner labels will be tainted"
  docker_label="docker-$GOOGLE_ENV"
else
  echo "runner labels will not be tainted"
  docker_label="docker"
fi

sudo -u $RUNNER_USER ./config.sh  --unattended --url https://github.com/"$GITHUB_ORG" --token "$REGISTRATION_TOKEN" --labels "$docker_label","$GOOGLE_ENV",gcp --name "$HOSTNAME"

if [ "$RUNNER_TYPE" = "ghost" ]; then
  echo "ghost runner, not launching runner"
else   
  echo "runner type $RUNNER_TYPE, installing service"
  ./svc.sh install $RUNNER_USER
  ./svc.sh start
fi

echo "end startup script with success"

exit 0
