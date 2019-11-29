FROM node:10.15.3-alpine AS builder

RUN apk update && apk add git bash mysql-client

WORKDIR /src

COPY ./init.sql /src/
COPY ./package.json ./package-lock.json /src/

RUN npm ci

FROM node:8.11.3-alpine

WORKDIR /src
CMD ["node", "/src/index.js"]

COPY --from=builder /src /src
COPY ./config.js ./db.js ./index.js ./lib.js /src/
