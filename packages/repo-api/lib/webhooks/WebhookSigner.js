import crypto from 'crypto';

/**
 * Handles webhook signature generation and verification
 */
class WebhookSigner {
  /**
   * Generate HMAC-SHA256 signature for payload
   * @param {Object|string} payload - Payload to sign
   * @param {string} secret - Secret key
   * @returns {string} - Hex-encoded signature
   */
  static sign(payload, secret) {
    const payloadString = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
      
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }
  
  /**
   * Verify webhook signature
   * @param {Object|string} payload - Payload to verify
   * @param {string} signature - Signature to verify against
   * @param {string} secret - Secret key
   * @returns {boolean} - True if signature is valid
   */
  static verify(payload, signature, secret) {
    const expected = this.sign(payload, secret);
    
    // Remove any prefix (e.g., "sha256=")
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  }
  
  /**
   * Generate a secure webhook secret
   * @returns {string} - Random secret suitable for webhook signing
   */
  static generateSecret() {
    return crypto.randomBytes(32).toString('base64');
  }
  
  /**
   * Create signature header value
   * @param {Object|string} payload - Payload to sign
   * @param {string} secret - Secret key
   * @returns {string} - Formatted signature header value
   */
  static createSignatureHeader(payload, secret) {
    const signature = this.sign(payload, secret);
    return `sha256=${signature}`;
  }
  
  /**
   * Verify webhook with multiple signature formats
   * @param {Object|string} payload - Payload to verify
   * @param {string} signatureHeader - Signature header value
   * @param {string} secret - Secret key
   * @returns {boolean} - True if any signature format is valid
   */
  static verifyMultiFormat(payload, signatureHeader, secret) {
    if (!signatureHeader || !secret) {
      return false;
    }
    
    // Try different signature formats
    const formats = [
      signatureHeader, // Raw signature
      signatureHeader.replace(/^sha256=/, ''), // Without prefix
      signatureHeader.replace(/^sha1=/, ''), // Legacy format
    ];
    
    for (const format of formats) {
      try {
        if (this.verify(payload, format, secret)) {
          return true;
        }
      } catch (error) {
        // Continue to next format
      }
    }
    
    return false;
  }
  
  /**
   * Create a signature for form-encoded data
   * @param {Object} data - Form data as object
   * @param {string} secret - Secret key
   * @returns {string} - Hex-encoded signature
   */
  static signFormData(data, secret) {
    // Sort keys for consistent ordering
    const sortedKeys = Object.keys(data).sort();
    const parts = sortedKeys.map(key => `${key}=${data[key]}`);
    const payload = parts.join('&');
    
    return this.sign(payload, secret);
  }
}

export default WebhookSigner;