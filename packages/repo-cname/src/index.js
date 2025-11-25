/**
 * Cloudflare CNAME Worker
 * Relays requests to theme worker with domain headers
 */

const logo = `
▄▖            ▌
▙▘█▌▛▌▛▌  ▛▛▌▛▌
▌▌▙▖▙▌▙▌▗ ▌▌▌▙▌
    ▌

    `;

// Emojified logger for better visibility in logs
const log = {
  info: (message, data = {}) => {
    console.log(`ℹ️ INFO: ${message}`, data);
  },
  success: (message, data = {}) => {
    console.log(`✅ SUCCESS: ${message}`, data);
  },
  warn: (message, data = {}) => {
    console.log(`⚠️ WARNING: ${message}`, data);
  },
  error: (message, data = {}) => {
    console.log(`❌ ERROR: ${message}`, data);
  },
  request: (message, data = {}) => {
    console.log(`🔄 REQUEST: ${message}`, data);
  },
  response: (message, data = {}) => {
    console.log(`📤 RESPONSE: ${message}`, data);
  },
};

// Theme templates (these are the complete worker URLs to forward to)
const t = {
  blog1: "https://simple-blog-remix.repo.md",
};

/*


testing configs 
dig CNAME example.com

dig CNAME blog.example.org
dig CNAME remixed.repo.md
dig CNAME remixed2.repo.md
dig CNAME remixed3.repo.md


*/
// Domain to target worker mapping - use complete URLs
const DOMAIN_TARGETS = {
  "example.com": t.blog1,
  "blog.example.org": t.blog1,
  "remixed.repo.md": t.blog1,
  "remixed2.repo.md": t.blog1,
  "remixed3.repo.md": t.blog1,

  //apps
  "remixed.app.repo.md": t.blog1,
  "remixed2.app.repo.md": t.blog1,
  "remixed3.app.repo.md": t.blog1,
  "remixed4.app.repo.md": t.blog1,
  // Add more domain -> target mappings as needed
};

export default {
  async fetch(request, env, ctx) {
    // Get the hostname from the request
    const url = new URL(request.url);
    const hostname = url.hostname;

    log.request(`Received request for [${hostname}]`, {
      url: request.url,
      method: request.method,
    });

    // Special case for cname.repo.md - show a friendly welcome page
    if (hostname === "cname.repo.md") {
      log.info(`🏠 Serving welcome page for [${hostname}]`);
      const welcomeMessage = `
${logo}
Welcome to Repo.md CNAME service!

This service allows you to connect your custom domain to a Repo.md site.

To get started:
1. Set up a CNAME record pointing to cname.repo.md
2. Configure your domain in the app : www.repo.md

Learn more at:
- https://repo.md/docs
- https://repo.me

Need help? Contact support@repo.md
`;
      log.response(`📃 Returning welcome page for [${hostname}]`, {
        status: 200,
      });
      return new Response(welcomeMessage, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Find the target worker URL for this domain
    const targetUrl = DOMAIN_TARGETS[hostname];

    if (targetUrl) {
      log.info(`🎯 Found target [${targetUrl}] for domain [${hostname}]`);
    } else {
      log.warn(`⚠️ No target found for domain [${hostname}]`);
      const notFoundMessage = `${logo}                         

Oops! This domain isn't configured yet.
🌐 ${hostname}

If you're the domain owner:
1. Make sure your CNAME record is set up correctly
2. Check that your domain is registered in our system

Need help? Visit https://repo.md/docs or contact support@repo.md
`;
      log.response(`🚫 Returning not found page for [${hostname}]`, {
        status: 404,
      });
      return new Response(notFoundMessage, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Clone the request to modify it
    const modifiedRequest = new Request(request);

    // Create headers object from the original request headers
    const headers = new Headers(request.headers);

    // Extract the theme name from the URL (for use in headers)
    const themeName = targetUrl.split("//")[1]; // Remove https://
    log.info(`🏷️ Setting theme headers [${themeName}] for [${hostname}]`);

    // Add the domain and theme as custom headers
    headers.set("x-theme", themeName);
    headers.set("x-original-domain", hostname);

    // Create a new request with the modified headers
    const forwardUrl = targetUrl + url.pathname + url.search;
    log.request(`🔀 Forwarding request from [${hostname}] to [${forwardUrl}]`, {
      method: request.method,
      path: url.pathname,
    });

    const newRequest = new Request(forwardUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: "follow",
    });

    // Forward the request to the target worker
    log.info(`⏳ Fetching from target worker [${targetUrl}]`);
    const response = await fetch(newRequest);
    log.success(
      `✅ Received response from [${targetUrl}]: ${response.status} ${response.statusText}`
    );

    // Return the response from the target worker
    log.response(
      `📤 Returning proxied response to [${hostname}]: ${response.status} ${response.statusText}`,
      {
        status: response.status,
        url: request.url,
      }
    );
    return response;
  },
};
