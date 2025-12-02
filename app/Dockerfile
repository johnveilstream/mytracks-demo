# ---------- Build stage ----------
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies (use npm ci for reproducible installs)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the source and build
COPY . .
# Make sure your package.json has: "build": "react-scripts build" or similar
RUN npm run build

# ---------- Runtime (static) stage ----------
FROM nginx:1.27-alpine

# Copy built static files from build stage to Nginx html directory
COPY --from=build /app/build /usr/share/nginx/html

# (Optional) Custom nginx.conf for SPA routing:
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
