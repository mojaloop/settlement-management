## Builder Image
FROM node:10.15.3-alpine AS builder

WORKDIR /opt/settlement-management

RUN apk update && apk add git bash mysql-client

COPY ./init.sql /opt/settlement-management/
COPY ./package.json ./package-lock.json /opt/settlement-management/
COPY ./config.js ./db.js ./index.js ./lib.js /opt/settlement-management/

RUN npm install

## Run-time Image
FROM node:8.11.3-alpine
WORKDIR /opt/operator-settlement

COPY --from=builder /opt/operator-settlement .

RUN npm prune --production

CMD ["node", "./index.js"]
