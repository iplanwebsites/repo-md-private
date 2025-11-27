#!/bin/sh
# Use PORT from environment
echo "Starting server on port: $PORT"

# Check if we should use persistence
if [ "$USE_PERSISTENT_MODELS" = "true" ]; then
  # Only download if not already downloaded
  if [ ! -f /app/models/.downloaded ]; then
    echo "Downloading AI models (persistent mode): $AI_MODELS"
    IFS=","
    for model in $AI_MODELS; do
      npx --yes @xenova/transformers download $model
    done
    touch /app/models/.downloaded
  else
    echo "Using cached AI models (persistent mode)"
  fi
else
  # Always download models on startup
  if [ -n "$AI_MODELS" ]; then
    echo "Downloading AI models (non-persistent mode): $AI_MODELS"
    IFS=","
    for model in $AI_MODELS; do
      npx --yes @xenova/transformers download $model
    done
  else
    echo "AI model downloading disabled"
  fi
fi

# Start the application
exec npm start