## Builder Image
FROM node:10.15.3-alpine AS builder

WORKDIR /opt/settlement-management

RUN apk update && apk add git bash

COPY ./init.sql /opt/settlement-management/
COPY ./package.json ./package-lock.json /opt/settlement-management/
COPY ./config.js ./db.js ./index.js ./lib.js /opt/settlement-management/

RUN npm install

## Run-time Image
FROM node:10.15.3-alpine
WORKDIR /opt/settlement-management

RUN apk update && apk add bash mysql-client

COPY --from=builder /opt/settlement-management .

RUN npm prune --production

CMD ["node", "./index.js"]
