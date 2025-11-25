import crypto from 'crypto';

/**
 * Generates secure tokens for webhooks
 */
class WebhookTokenGenerator {
  /**
   * Generate a secure random token
   * @returns {string} - 64 character hex token
   */
  static generate() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Generate the full webhook URL for a token
   * @param {string} token - The webhook token
   * @returns {string} - Full webhook URL
   */
  static generateUrl(token) {
    const baseUrl = process.env.API_BASE_URL || 'https://api.repo.md';
    return `${baseUrl}/api/webhooks/project/${token}`;
  }
  
  /**
   * Validate token format
   * @param {string} token - Token to validate
   * @returns {boolean} - True if valid format
   */
  static isValidFormat(token) {
    // Should be 64 hex characters
    return /^[a-f0-9]{64}$/.test(token);
  }
  
  /**
   * Generate a shorter, more readable token (less secure, for development)
   * @param {string} prefix - Optional prefix for the token
   * @returns {string} - Shorter token
   */
  static generateShort(prefix = 'wh') {
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}_${random}`;
  }
}

export default WebhookTokenGenerator;