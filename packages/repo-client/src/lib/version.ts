/**
 * Version and build information utility
 * Works in both development and production environments
 */

export interface VersionInfo {
  version: string;
  buildDate: string;
}

/**
 * Get version info - this will be replaced by Vite during build
 */
export const getVersionInfo = (): VersionInfo => {
  // In production builds, these will be replaced by actual values
  const version = (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION || '0.0.17-dev';
  const buildDate = (import.meta as unknown as { env?: { VITE_APP_BUILD_DATE?: string } }).env?.VITE_APP_BUILD_DATE || new Date().toISOString();

  return {
    version,
    buildDate
  };
};
