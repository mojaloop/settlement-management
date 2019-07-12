FROM node:8.11.3-alpine AS builder

RUN apk update && apk add openssh-client git

WORKDIR /src

# TODO: use a GH read-only repo token for the build

# An SSH key is required for building. Specifically, one with access to the Casa Github
# casablanca-lib repo. The key is used for `npm install` during the docker container build. We use
# a multi-stage build to avoid the key leaking into the published container.
# Invoke docker build as follows:
# docker build -t ${TAG} -f Dockerfile --build-arg SSH_KEY="$(cat ~/.ssh/id_rsa)" .
ARG SSH_KEY
RUN mkdir -p /root/.ssh && \
    chmod 0700 /root/.ssh && \
    ssh-keyscan github.com > /root/.ssh/known_hosts && \
    echo "${SSH_KEY}" > /root/.ssh/id_rsa && \
    chmod 600 /root/.ssh/id_rsa
COPY ./package.json ./package-lock.json /src/
# Delete the ssh key after the build; this will eliminate the possibility of copying it into the
# final container.
RUN eval `ssh-agent -s` && \
    ssh-add $HOME/.ssh/id_rsa && \
    npm install --production && \
    rm -rf /root/.ssh

FROM node:8.11.3-alpine

WORKDIR /src
CMD ["node", "/src/index.js"]

COPY --from=builder /src /src
COPY ./config.js ./db.js ./index.js ./lib.js /src/
