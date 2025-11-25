/**
 * Sanitizer for AI-generated code and content
 * Ensures security and quality of generated files
 */

// Patterns that indicate potential security risks
const SECURITY_PATTERNS = {
  // API Keys and Secrets
  apiKeys: [
    /sk-[a-zA-Z0-9]{48}/g, // OpenAI style keys
    /AIza[0-9A-Za-z\-_]{35}/g, // Google API keys
    /[0-9a-f]{40}/g, // Generic SHA1 (potential tokens)
    /ghp_[0-9a-zA-Z]{36}/g, // GitHub personal access tokens
    /gho_[0-9a-zA-Z]{36}/g, // GitHub OAuth tokens
  ],
  
  // Passwords and credentials
  credentials: [
    /password\s*[:=]\s*["'].*?["']/gi,
    /passwd\s*[:=]\s*["'].*?["']/gi,
    /pwd\s*[:=]\s*["'].*?["']/gi,
    /secret\s*[:=]\s*["'].*?["']/gi,
    /token\s*[:=]\s*["'].*?["']/gi,
  ],
  
  // Dangerous code patterns
  dangerous: [
    /eval\s*\(/,
    /Function\s*\(/,
    /setTimeout\s*\(\s*["']/,
    /setInterval\s*\(\s*["']/,
    /<script[^>]*>/i,
    /document\.write/,
    /innerHTML\s*=/,
  ],
  
  // System access patterns
  systemAccess: [
    /require\s*\(\s*["']child_process["']\s*\)/,
    /require\s*\(\s*["']fs["']\s*\).*unlink/,
    /require\s*\(\s*["']fs["']\s*\).*rmdir/,
    /process\.exit/,
    /process\.kill/,
  ],
  
  // Network requests to suspicious domains
  suspiciousUrls: [
    /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, // IP addresses
    /\.tk\//g,
    /\.ml\//g,
    /ngrok\.io/g,
    /localhost:\d+/g,
  ]
};

// File extensions that should contain only specific content types
const CONTENT_TYPE_VALIDATORS = {
  '.json': isValidJSON,
  '.md': isValidMarkdown,
  '.yml': isValidYAML,
  '.yaml': isValidYAML,
  '.toml': isValidTOML,
  '.xml': isValidXML,
  '.html': isValidHTML,
  '.css': isValidCSS
};

// Maximum file size limits by extension
const FILE_SIZE_LIMITS = {
  '.jpg': 5 * 1024 * 1024, // 5MB
  '.jpeg': 5 * 1024 * 1024,
  '.png': 5 * 1024 * 1024,
  '.gif': 5 * 1024 * 1024,
  '.svg': 1 * 1024 * 1024, // 1MB
  '.json': 1 * 1024 * 1024,
  default: 10 * 1024 * 1024 // 10MB default
};

/**
 * Main sanitization function
 */
export async function sanitizeFiles(files) {
  const sanitized = {};
  const issues = [];
  
  for (const [path, content] of Object.entries(files)) {
    const validation = await validateFile(path, content);
    
    if (!validation.valid) {
      issues.push({
        path,
        issues: validation.issues
      });
      continue;
    }
    
    // Sanitize content
    const sanitizedContent = sanitizeContent(content, path);
    sanitized[path] = sanitizedContent;
  }
  
  return {
    files: sanitized,
    issues,
    fileCount: Object.keys(sanitized).length,
    issueCount: issues.length
  };
}

/**
 * Validate a single file
 */
async function validateFile(path, content) {
  const issues = [];
  
  // Validate file path
  const pathValidation = validateFilePath(path);
  if (!pathValidation.valid) {
    issues.push(...pathValidation.issues);
  }
  
  // Check file size
  const size = Buffer.byteLength(content, 'utf8');
  const extension = getFileExtension(path);
  const sizeLimit = FILE_SIZE_LIMITS[extension] || FILE_SIZE_LIMITS.default;
  
  if (size > sizeLimit) {
    issues.push(`File exceeds size limit: ${size} bytes (limit: ${sizeLimit})`);
  }
  
  // Validate content type
  if (CONTENT_TYPE_VALIDATORS[extension]) {
    const contentValidation = CONTENT_TYPE_VALIDATORS[extension](content);
    if (!contentValidation.valid) {
      issues.push(`Invalid ${extension} content: ${contentValidation.error}`);
    }
  }
  
  // Check for security issues
  const securityIssues = checkSecurityPatterns(content);
  if (securityIssues.length > 0) {
    issues.push(...securityIssues);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validate file path
 */
function validateFilePath(path) {
  const issues = [];
  
  // No path traversal
  if (path.includes('..')) {
    issues.push('Path traversal detected');
  }
  
  // Must not start with /
  if (path.startsWith('/')) {
    issues.push('Absolute paths not allowed');
  }
  
  // Must have valid characters
  if (!/^[a-zA-Z0-9._\-\/]+$/.test(path)) {
    issues.push('Invalid characters in path');
  }
  
  // Must not be in restricted directories
  const restrictedDirs = ['.git', 'node_modules', '.env'];
  if (restrictedDirs.some(dir => path.startsWith(dir + '/') || path === dir)) {
    issues.push('Restricted directory');
  }
  
  // Path depth limit
  if (path.split('/').length > 10) {
    issues.push('Path too deep');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Check for security patterns in content
 */
function checkSecurityPatterns(content) {
  const issues = [];
  
  // Check each security pattern category
  for (const [category, patterns] of Object.entries(SECURITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        issues.push(`Potential security issue detected: ${category}`);
        break; // Only report once per category
      }
    }
  }
  
  return issues;
}

/**
 * Sanitize content by replacing sensitive patterns
 */
function sanitizeContent(content, path) {
  let sanitized = content;
  
  // Replace API keys
  SECURITY_PATTERNS.apiKeys.forEach(pattern => {
    sanitized = sanitized.replace(pattern, 'YOUR_API_KEY_HERE');
  });
  
  // Replace credentials
  SECURITY_PATTERNS.credentials.forEach(pattern => {
    sanitized = sanitized.replace(pattern, (match) => {
      const key = match.split(/[:=]/)[0];
      return `${key}: "YOUR_${key.toUpperCase()}_HERE"`;
    });
  });
  
  // Replace localhost URLs with placeholders
  sanitized = sanitized.replace(/http:\/\/localhost:\d+/g, 'https://your-domain.com');
  sanitized = sanitized.replace(/127\.0\.0\.1:\d+/g, 'your-domain.com');
  
  // Add environment variable placeholders
  sanitized = sanitized.replace(/process\.env\.(\w+)/g, 'process.env.$1 || "YOUR_$1_HERE"');
  
  return sanitized;
}

/**
 * Validation functions for specific file types
 */
function isValidJSON(content) {
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function isValidMarkdown(content) {
  // Basic markdown validation
  if (content.length === 0) {
    return { valid: false, error: 'Empty file' };
  }
  
  // Check for common markdown elements
  const hasMarkdown = /^#|^##|^\*|^\-|^\d+\.|```|`[^`]+`|\[.*\]\(.*\)/.test(content);
  
  return { valid: true }; // Markdown is very permissive
}

function isValidYAML(content) {
  // Basic YAML validation
  try {
    // Check for basic YAML structure
    if (!/^[\s\S]*?[\w\-]+\s*:\s*[\s\S]*$/m.test(content)) {
      throw new Error('Invalid YAML structure');
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function isValidTOML(content) {
  // Basic TOML validation
  try {
    // Check for basic TOML structure
    if (!/^\s*\[?[\w\-\.]+\]?\s*=|^\s*\[[\w\-\.]+\]/m.test(content)) {
      throw new Error('Invalid TOML structure');
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function isValidXML(content) {
  // Basic XML validation
  try {
    // Check for basic XML structure
    if (!/<\?xml|^<[\w\-]+[^>]*>[\s\S]*<\/[\w\-]+>$/m.test(content)) {
      throw new Error('Invalid XML structure');
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function isValidHTML(content) {
  // Basic HTML validation
  if (content.includes('<script') && content.includes('eval(')) {
    return { valid: false, error: 'Dangerous script content' };
  }
  
  return { valid: true };
}

function isValidCSS(content) {
  // Basic CSS validation
  if (content.includes('expression(') || content.includes('javascript:')) {
    return { valid: false, error: 'Dangerous CSS content' };
  }
  
  return { valid: true };
}

/**
 * Get file extension from path
 */
function getFileExtension(path) {
  const match = path.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

/**
 * Validate project structure
 */
export function validateProjectStructure(files) {
  const issues = [];
  const filePaths = Object.keys(files);
  
  // Must have at least one file
  if (filePaths.length === 0) {
    issues.push('No files in project');
  }
  
  // Should have a README
  if (!filePaths.some(path => /readme\.md/i.test(path))) {
    issues.push('Missing README.md file');
  }
  
  // Check for common project files based on detected type
  const hasPackageJson = filePaths.includes('package.json');
  const hasRequirementsTxt = filePaths.includes('requirements.txt');
  const hasGoMod = filePaths.includes('go.mod');
  
  if (hasPackageJson) {
    // Node.js project checks
    const packageContent = files['package.json'];
    try {
      const pkg = JSON.parse(packageContent);
      if (!pkg.name) issues.push('package.json missing name field');
      if (!pkg.version) issues.push('package.json missing version field');
    } catch (e) {
      issues.push('Invalid package.json');
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    projectType: detectProjectType(filePaths)
  };
}

/**
 * Detect project type from file structure
 */
function detectProjectType(filePaths) {
  if (filePaths.includes('package.json')) {
    if (filePaths.some(p => p.includes('react') || p.endsWith('.jsx'))) return 'react';
    if (filePaths.some(p => p.includes('vue') || p.endsWith('.vue'))) return 'vue';
    if (filePaths.some(p => p.includes('angular'))) return 'angular';
    return 'node';
  }
  if (filePaths.includes('requirements.txt') || filePaths.some(p => p.endsWith('.py'))) return 'python';
  if (filePaths.includes('go.mod') || filePaths.some(p => p.endsWith('.go'))) return 'go';
  if (filePaths.includes('Cargo.toml') || filePaths.some(p => p.endsWith('.rs'))) return 'rust';
  if (filePaths.some(p => p.endsWith('.html'))) return 'static';
  return 'unknown';
}