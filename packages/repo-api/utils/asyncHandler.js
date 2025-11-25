/**
 * Enhanced error handler wrapper for async route handlers with detailed logging
 * This utility helps catch and log detailed information about errors in async route handlers
 * 
 * @param {Function} fn - The async route handler function
 * @returns {Function} - Express middleware function with error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    // Log detailed error information
    console.error(`[API][${req.method}][${req.originalUrl}] Error:`);
    console.error(`- Message: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    
    // Add request information to help with debugging
    const requestInfo = {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.body ? (Object.keys(req.body).length > 0 ? '(body content present)' : '(empty body)') : '(no body)',
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'accept': req.headers['accept']
      }
    };
    console.error('- Request info:', JSON.stringify(requestInfo, null, 2));
    
    // Forward to express error handler
    next(error);
  });
};

export default asyncHandler;