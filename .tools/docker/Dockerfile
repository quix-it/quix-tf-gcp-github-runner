FROM hashicorp/terraform:latest
FROM hashicorp/packer:latest
FROM node:12

COPY --from=0 /bin/terraform /bin
COPY --from=1 /bin/packer /bin

RUN apt-get update && apt-get install -y jq apt-transport-https ca-certificates gnupg

RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" >> /etc/apt/sources.list.d/google-cloud-sdk.list && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - && \
    apt-get update && apt-get install -y google-cloud-sdk

ENTRYPOINT ["/bin/bash"]
