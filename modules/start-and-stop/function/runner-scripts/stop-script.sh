#!/bin/bash

echo "start stop script"

RUNNER_USER="runner"
ZONE=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/zone)
RUNNER_TYPE=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/type)

## Exit now if ghost runner
if [ "$RUNNER_TYPE" = "ghost" ]; then
  echo "Ghost runner, exiting"
  exit 0
fi

## Fetch remove token
FUNCTION_URL=$(curl -H Metadata-Flavor:Google http://metadata/computeMetadata/v1/instance/attributes/get-remove-token-trigger-url)
REMOVE_TOKEN=$(curl -s -H "Authorization: Bearer $(gcloud auth print-identity-token)" $FUNCTION_URL)

if [ -n "$REMOVE_TOKEN" ]; then
  echo "remove token fetched with success"
else
  echo "error fetching remove token" >&2
fi

## Unregister runner
cd "/home/$RUNNER_USER/actions-runner" || exit 1
./svc.sh stop
./svc.sh uninstall
sudo -u $RUNNER_USER ./config.sh remove --token "$REMOVE_TOKEN"
cd /home/$RUNNER_USER || exit 1

echo "end stop with success"

exit 0
