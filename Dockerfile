FROM node:18-slim

LABEL maintainer="engineering@dhiway.com"

WORKDIR /demo
COPY . /demo

RUN npm install

ENTRYPOINT [ "npm" , "run" ]