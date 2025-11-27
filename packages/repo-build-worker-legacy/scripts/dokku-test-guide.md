# Testing Your Dokku Deployment Locally

This guide explains how to test your application's Docker configuration locally to ensure it will work correctly when deployed to Dokku.

## Quick Start

Run the following command to build and test your Docker container with Dokku-like settings:

```bash
npm run test:dokku
```

This will:
1. Build a Docker image using your current Dockerfile
2. Run a container with environment variables similar to Dokku
3. Display the container logs to verify it's working

## Manual Testing

If you want more control over the test process, you can follow these steps manually:

### 1. Build the Docker image

```bash
docker build -t repo-build-worker:dokku-test .
```

### 2. Run the container with Dokku-like environment

```bash
docker run -d --name repo-build-worker-dokku-test \
  -p 5522:5522 \
  -e PORT=5522 \
  -e NODE_ENV=production \
  -e USE_PERSISTENT_MODELS=false \
  repo-build-worker:dokku-test
```

### 3. View the logs

```bash
docker logs -f repo-build-worker-dokku-test
```

### 4. Test the API

Once the container is running, you can test your API:

```bash
curl http://localhost:5522/api/health
```

### 5. Clean up

When you're done testing, stop and remove the container:

```bash
docker stop repo-build-worker-dokku-test
docker rm repo-build-worker-dokku-test
```

## Troubleshooting

### Script Not Found 

If you see an error like:
```
exec: line 11: /app/start.sh: not found
```

Check:
1. The start.sh file is being created correctly in your Dockerfile
2. The file has executable permissions
3. The path in CMD is correct

### Port Issues

If your application isn't accessible, check:
1. The PORT environment variable is being respected by your application
2. You've mapped the port correctly in the docker run command
3. Your application is actually starting and binding to the port

### Container Exits Immediately

If your container exits immediately:
1. Run with `-it` instead of `-d` to see the output directly
2. Check the logs with `docker logs repo-build-worker-dokku-test`
3. Ensure your application doesn't exit when there's an error

## Common Dokku Environment Variables

These variables are commonly set by Dokku:

- `PORT`: The port your application should listen on
- `NODE_ENV`: Usually set to 'production'
- `DOKKU_APP_NAME`: Your application name
- `DOKKU_APP_TYPE`: The application type (usually 'nodejs')

You can add these to your test environment to better simulate Dokku.