FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy app
COPY . .

# Build
RUN npm run build

# Serve
FROM node:18-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=0 /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
