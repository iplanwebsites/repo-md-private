/**
 * Copyright (c) 2025 FÉLIX MÉNARD
 * All rights reserved.
 */

import { randomBytes } from "crypto";

// Generate a secure random ID
// URL-safe base64 alphabet (62 characters)
const URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const generateSecureId = (length = 32) => {
  // Calculate how many random bytes we need
  // We need more bytes than length because some might be discarded
  const bytesNeeded = Math.ceil(length * 1.5);

  // Generate random bytes
  const randomBytesArray = randomBytes(bytesNeeded);

  let result = "";

  // Convert random bytes to URL-safe characters
  for (let i = 0; i < bytesNeeded && result.length < length; i++) {
    // Use modulo to map byte to alphabet index
    const randomIndex = randomBytesArray[i] % URL_ALPHABET.length;
    result += URL_ALPHABET.charAt(randomIndex);
  }

  return result;
};
