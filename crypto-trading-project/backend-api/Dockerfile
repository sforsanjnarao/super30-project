# backend-api/Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Run the API server
CMD [ "node", "api-server.js" ]