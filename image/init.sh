#!/bin/bash

set -e

# Hack to ensure VM is well started
sleep 15

RUNNER_USER="runner"

# Add runner user with home folder
sudo useradd -m $RUNNER_USER

## Minimum tools
sudo apt-get -y update
sudo apt-get -y install \
    git \
    curl \
    jq \
    zip

## Docker
sudo apt-get -y install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable"
sudo apt-get -y update
DOCKER_VERSION="5:20.10.7~3-0~debian-buster"
sudo apt-get -y install docker-ce=$DOCKER_VERSION docker-ce-cli=$DOCKER_VERSION containerd.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $RUNNER_USER
# Esnure Docker is correctly setup
sudo -u $RUNNER_USER docker run --rm hello-world

mkdir -p /etc/docker
cat <<EOF | sudo tee /etc/docker/daemon.json
{
  "registry-mirrors": ["https://mirror.gcr.io"]
}
EOF

## Stack driver
curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh
sudo bash add-monitoring-agent-repo.sh
sudo apt-get -y update
sudo apt-get install -y 'stackdriver-agent=6.*'

## GitHub
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
apt-get update
sudo apt-get -y install gh

## Runner
cd /home/$RUNNER_USER
sudo -u $RUNNER_USER mkdir actions-runner && cd "$_"
ACTIONS_RUNNER_URL=$(curl -sL https://api.github.com/repos/actions/runner/releases/latest | jq -r '.assets[] | select(.name | contains("actions-runner-linux-x64")) | .browser_download_url')
sudo -u $RUNNER_USER curl -O -L "$ACTIONS_RUNNER_URL"
sudo -u $RUNNER_USER tar xzf ./actions-runner-linux-x64-*.tar.gz
exit 0
