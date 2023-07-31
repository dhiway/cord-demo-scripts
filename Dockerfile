FROM node

LABEL maintainer="engineering@dhiway.com"

WORKDIR /demo
COPY . /demo

RUN npm install

ENTRYPOINT [ "npm" , "run" ]
