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

# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user: ml-user
RUN adduser -D ml-user 
USER ml-user

COPY --chown=ml-user --from=builder /opt/settlement-management .
RUN npm prune --production

CMD ["node", "./index.js"]
