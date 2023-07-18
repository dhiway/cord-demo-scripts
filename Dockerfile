FROM node:18-slim

LABEL maintainer="engineering@dhiway.com"

WORKDIR /demo
COPY . /demo

RUN npm install

EXPOSE 30333 9933 9944 9615

ENTRYPOINT [ "npm" , "run" , "demo" ]