FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy all application files
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
