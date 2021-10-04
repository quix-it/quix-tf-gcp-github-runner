#!/bin/bash

echo "startup script started"

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
RUNNER_LABELS=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/runner-labels)

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

LABELS="$docker_label","$GOOGLE_ENV","$RUNNER_LABELS"
LABELS=$(jq --arg a "$LABELS" -nr '$a|split(",")|map(select(length>0))|unique|join(",")')

sudo -u $RUNNER_USER ./config.sh  --unattended --url https://github.com/"$GITHUB_ORG" --token "$REGISTRATION_TOKEN" --labels "$LABELS" --name "$HOSTNAME"

if [ "$RUNNER_TYPE" = "ghost" ]; then
  echo "ghost runner, not launching runner"
else   
  echo "runner type $RUNNER_TYPE, launching runner"
  sudo -u $RUNNER_USER ./run.sh &
fi

echo "startup script completed successfully"

exit 0
