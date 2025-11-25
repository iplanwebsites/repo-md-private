/**
 * R2 Assets Worker with Immutable Caching
 *
 * This worker serves assets from R2 with optimal caching headers
 * for improved performance and proper CORS implementation.
 */

// Define the worker's main functionality
export default {
  // The fetch handler is called when a request is made to the worker
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx)
  },
}

/**
 * Main request handler
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context
 * @returns {Response} The response to return
 */
async function handleRequest(request, env, ctx) {
  try {
    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          Vary: 'Origin',
        },
      })
    }

    // Handle OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400', // Maximum preflight cache time (24 hours)
          'Cache-Control': 'public, max-age=86400', // Cache the OPTIONS response
          Vary: 'Origin',
        },
      })
    }

    // Access the R2 bucket binding from env
    const ASSETS_BUCKET = env.ASSETS_BUCKET

    // Check if bucket binding is available
    if (!ASSETS_BUCKET) {
      console.error('R2 bucket binding is undefined')
      return new Response('Storage configuration error', { status: 500 })
    }

    // Parse the URL and pathname
    const url = new URL(request.url)
    const pathname = url.pathname

    // Remove leading slash to get R2 object key
    let objectKey = pathname.replace(/^\/+/, '')

    // Check for empty paths (security measure)
    if (!objectKey || objectKey === '') {
      return new Response('No asset specified', { status: 400 })
    }

    // Check cache first
    // Create a clean URL string without query parameters
    const cleanUrlString = createCacheKey(url)

    // Create the cache key using the clean URL
    const cacheKey = new Request(cleanUrlString, request)
    const cache = caches.default

    // Try to get response from the cache
    let response = await cache.match(cacheKey)
    if (response) {
      console.log(`Cache hit for: ${objectKey}`)
      return response
    }

    console.log(`Cache miss for: ${objectKey}, fetching from R2...`)

    // Get the object from R2
    const object = await ASSETS_BUCKET.get(objectKey)

    // Return 404 if the object doesn't exist
    if (object === null) {
      return new Response(
        `Asset not found: ${pathname} [Repo.md  static server]`,
        {
          status: 404,
          headers: {
            'Cache-Control': 'public, max-age=60', // Cache 404s briefly
            'Access-Control-Allow-Origin': '*',
            Vary: 'Origin',
          },
        },
      )
    }

    // Set up headers for the response
    const headers = new Headers()

    // Add CORS headers
    headers.set('Access-Control-Allow-Origin', '*')

    // Add Vary header for proper CORS caching
    headers.set('Vary', 'Origin')

    // Copy any metadata headers from the R2 object
    object.writeHttpMetadata(headers)

    // Set additional headers
    headers.set('etag', object.httpEtag)

    // Add content-type if it doesn't exist
    if (!headers.has('content-type')) {
      headers.set('content-type', getContentType(objectKey))
    }

    // Set immutable cache headers for maximum caching
    let age = 31536000 // 1 year in seconds
    // age = 333 // Preserved for debugging as requested

    headers.set('Cache-Control', 'public, max-age=' + age + ', immutable')
    headers.set('CDN-Cache-Control', 'public, max-age=' + age + ', immutable')

    // Create the response
    response = new Response(object.body, {
      headers,
    })

    // Store the response in the cache
    ctx.waitUntil(cache.put(cacheKey, response.clone()))

    // Return the response
    return response
  } catch (error) {
    // Log the error
    console.error(`Error serving asset: ${error.message}`)

    // Return a generic error
    return new Response('Internal server error', {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        Vary: 'Origin',
      },
    })
  }
}

/**
 * Helper function to determine content type based on file extension
 */
function getContentType(path) {
  const extension = path.split('.').pop().toLowerCase()

  const contentTypes = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    txt: 'text/plain',
    xml: 'application/xml',
    zip: 'application/zip',
    gz: 'application/gzip',
  }

  return contentTypes[extension] || 'application/octet-stream'
}

/**
 * Helper function to create a cache key by stripping URL query parameters
 * @param {URL} url - The URL object
 * @returns {string} A clean URL string without query parameters
 */
function createCacheKey(url) {
  // Create a new URL object to avoid modifying the original
  const cleanUrl = new URL(url)

  // Remove all query parameters
  cleanUrl.search = ''

  // Return the clean URL string
  return cleanUrl.toString()
}
