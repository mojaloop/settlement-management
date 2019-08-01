FROM node:8.11.3-alpine AS builder

RUN apk update && apk add git

WORKDIR /src

# 'AZURE_NPM_REGISTRY_NPMRC_B64' environment variable is available in the CircleCI environment.
# It contains the .npmrc configuration and credentials (base64 encoded) required to connect and publish to private 
# Azure Devops Services NPM repository. So in essence, we shift from using the public npm registry
# to a self-hosted npm registry.
#
# We need to grab content of this variable, decode it and write it to an .npmrc file.
# The .npmrc file is used for `npm install` or `yarn install` during the docker container build. We use
# a multi-stage build to avoid the .nmprc file leaking into the published container.
#
# Invoke docker build as follows:
#   docker build -t ${TAG} -f Dockerfile --build-arg NPMRC_B64="$AZURE_NPM_REGISTRY_NPMRC_B64" .
ARG NPMRC_B64

RUN echo "${NPMRC_B64}" | base64 -d > /src/.npmrc

COPY ./package.json ./yarn.lock /src/

# Delete the .npmrc file after the build; this will eliminate the possibility of copying it into the final container.
RUN yarn install --frozen-lockfile && \
    rm -f /src/.npmrc

FROM node:8.11.3-alpine

WORKDIR /src
CMD ["node", "/src/index.js"]

COPY --from=builder /src /src
COPY ./config.js ./db.js ./index.js ./lib.js /src/
