# Use an official lightweight Node.js image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# The command to run your application
# YOU WILL NEED TO CHANGE THE SCRIPT NAME FOR EACH SERVICE
CMD [ "node", "price-poller.js" ]