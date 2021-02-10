## Builder Image
FROM node:12.16.1-alpine as builder
USER root

WORKDIR /opt/settlement-management

RUN apk update && apk add git bash

COPY ./init.sql /opt/settlement-management/
COPY ./package.json ./package-lock.json /opt/settlement-management/
COPY ./config.js ./db.js ./index.js ./lib.js /opt/settlement-management/

RUN npm install

## Run-time Image
FROM node:12.16.0-alpine
WORKDIR /opt/settlement-management

# Create a non-root user: ml-user
RUN adduser -D ml-user 
USER ml-user

COPY --chown=ml-user --from=builder /opt/settlement-management .
RUN npm prune --production

CMD ["node", "./index.js"]
