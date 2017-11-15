# Use node 4.4.5 LTS
FROM node:6.11.1

# Copy source code
COPY . /matchmaker

# Change working directory
WORKDIR /matchmaker

# Install dependencies
RUN npm install

# Expose API port to the outside
EXPOSE 8080 5000

# Launch application
CMD ["npm","start"]