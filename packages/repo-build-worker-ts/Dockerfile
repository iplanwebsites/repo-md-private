FROM nikolaik/python-nodejs:python3.10-nodejs20-bullseye
WORKDIR /app

# https://hub.docker.com/r/nikolaik/python-nodejs/tags?name=python3.10-nodejs20

# Copy package files first for better caching
COPY package*.json ./

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libvips-dev \
    libsqlite3-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js dependencies
RUN npm ci && \
    npm rebuild sharp

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV TRANSFORMERS_CACHE="/app/models"
ENV AI_MODELS="XENOVA/DISTILBERT-BASE-UNCASED-FINETUNED-SST-2-ENGLISH"
ENV USE_PERSISTENT_MODELS="false"

# Create directory for models
RUN mkdir -p /app/models && \
    chmod +x /app/scripts/docker-start.sh

# Expose the port
EXPOSE 5000

# Start the application
CMD ["/bin/sh", "/app/scripts/docker-start.sh"]