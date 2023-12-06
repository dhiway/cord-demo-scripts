FROM node:18.17.0-alpine3.18

LABEL maintainer="engineering@dhiway.com"

WORKDIR usr/src/app

RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install --no-cache

COPY src/ ./src/
COPY res/ ./res/

ENTRYPOINT [ "npx" , "tsx" ]