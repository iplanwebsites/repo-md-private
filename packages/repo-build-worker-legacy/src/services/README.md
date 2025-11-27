# Services

## Logger Service

The Logger Service (`loggerService.js`) provides isolated logging for each job processed by the worker. This implementation ensures that logs from different concurrent jobs, including logs from child processes, are properly isolated and never mixed together.

### Usage in Worker

```javascript
import loggerService from "./services/loggerService.js";

// Get a logger for a specific job
const jobLogger = loggerService.getLogger('job-123');

// Use the job-specific logger methods
jobLogger.log('Processing job...'); // Info level
jobLogger.error('Something went wrong'); // Error level

// Pass the logger to child processes via the data object
const result = await doWork(task, { 
  ...data, 
  jobId, 
  logger // Pass logger to child processes
}, logger);

// Get all logs for this job
const logs = jobLogger.getLogs();

// When done with the job, clean up
loggerService.removeLogger('job-123');
```

### Usage in Child Processes

```javascript
// In a child process like buildAssets.js
async function buildAssets(data) {
  // Extract logger from data if available
  const logger = data.logger;
  
  // Use logger if provided, otherwise fall back to console
  if (logger) {
    logger.log("Building assets...", { jobId: data.jobId });
  } else {
    console.log("Building assets...", { jobId: data.jobId });
  }
  
  // ... do work ...
  
  try {
    // ... process ...
  } catch (error) {
    if (logger) {
      logger.error("Failed to build assets", {
        jobId: data.jobId,
        error: error.message
      });
    } else {
      console.error("Failed to build assets", {
        jobId: data.jobId,
        error: error.message
      });
    }
    throw error;
  }
}
```

### Passing Loggers to Nested Functions

```javascript
// Helper function with logger parameter
async function saveJson(distFolder, filename, data, logger) {
  const filePath = path.join(distFolder, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  
  // Use logger if provided, otherwise fall back to console
  if (logger) {
    logger.log(`Saved ${filename}`);
  } else {
    console.log(`Saved ${filename}`);
  }
  
  return filePath;
}

// Call helper function with logger
const savedPath = await saveJson(distFolder, "data.json", data, logger);
```

### Advanced Usage: Console Proxying

For special cases, the logger can create a proxy object or override console:

```javascript
// Create a console-like proxy for a module that requires a console object
const logger = loggerService.getLogger('job-123');
const consoleProxy = logger.createConsoleProxy();

// Pass the console proxy to a function expecting a console-like object
someModuleFunction({ console: consoleProxy });

// Option for single-threaded contexts: temporarily override global console
// BE CAREFUL: only use this when certain no other concurrent jobs exist
const restoreConsole = logger.installGlobalProxy();
try {
  // All console.log/error calls will now be captured by this job's logger
  someFunction();
} finally {
  // Always restore the console when done
  restoreConsole();
}
```

### Concurrency Support

This logger implementation supports true concurrency where multiple jobs can run in parallel without their logs getting mixed:

1. Each job gets its own isolated logger instance that captures only its own logs
2. Loggers are tracked in a central service but maintain separate log collections
3. No global console override is used, preventing cross-contamination
4. Each logger is passed through to child processes via the data object
5. Child processes conditionally use the logger or fall back to console

### Key Features

- Creates isolated loggers for each job
- Prevents cross-contamination of logs between different jobs
- Supports truly concurrent job processing
- Handles logs from child processes
- Cleans up job loggers after job completion
- Prefixes console output with job ID for easier debugging