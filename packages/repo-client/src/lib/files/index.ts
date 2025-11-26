/**
 * File Handling module for RepoMD
 * Provides functions for handling source and distribution files
 */

import { LOG_PREFIXES } from "../logger.js";

const prefix = LOG_PREFIXES.REPO_MD;

/** Source file type */
export interface SourceFile {
  path: string;
  name?: string;
  size?: number;
  hash?: string;
  [key: string]: unknown;
}

/** Distribution file type */
export interface DistFile {
  path: string;
  name?: string;
  size?: number;
  hash?: string;
  [key: string]: unknown;
}

/** Graph data type */
export interface GraphData {
  nodes?: Array<{ id: string; [key: string]: unknown }>;
  edges?: Array<{ source: string; target: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

/** File content type */
export interface FileContent {
  content?: string;
  path?: string;
  name?: string;
  [key: string]: unknown;
}

/** File endpoint configuration */
interface FileEndpoint<T> {
  path: string;
  message: string;
  defaultValue: T;
}

/** File handler configuration */
export interface FileHandlerConfig {
  fetchR2Json: <T>(path: string, options?: { defaultValue?: T; useCache?: boolean }) => Promise<T>;
  debug?: boolean;
}

/** File handler service interface */
export interface FileHandlerService {
  getSourceFilesList: (useCache?: boolean) => Promise<SourceFile[]>;
  getDistFilesList: (useCache?: boolean) => Promise<DistFile[]>;
  getGraph: (useCache?: boolean) => Promise<GraphData>;
  getFileContent: (path: string, useCache?: boolean) => Promise<FileContent | null>;
}

/**
 * Create a file handling service
 * @param config - Configuration object
 * @returns File handling functions
 */
export function createFileHandler(config: FileHandlerConfig): FileHandlerService {
  const { fetchR2Json, debug = false } = config;

  // Configuration for file endpoints
  const fileEndpoints: Record<string, FileEndpoint<unknown>> = {
    source: {
      path: "/files-source.json",
      message: "Fetching source files list",
      defaultValue: [],
    },
    dist: {
      path: "/files-dist.json",
      message: "Fetching distribution files list",
      defaultValue: [],
    },
    graph: {
      path: "/graph.json",
      message: "Fetching dependency graph data",
      defaultValue: {},
    },
  };

  // Generic file fetching function
  async function fetchFile<T>(configKey: string, useCache = true): Promise<T> {
    const endpointConfig = fileEndpoints[configKey];

    if (debug) {
      console.log(`${prefix} 📡 ${endpointConfig.message}`);
    }

    // fetchR2Json will handle revision resolution
    return await fetchR2Json<T>(endpointConfig.path, {
      defaultValue: endpointConfig.defaultValue as T,
      useCache,
    });
  }

  async function getSourceFilesList(useCache = true): Promise<SourceFile[]> {
    return await fetchFile<SourceFile[]>("source", useCache);
  }

  async function getDistFilesList(useCache = true): Promise<DistFile[]> {
    return await fetchFile<DistFile[]>("dist", useCache);
  }

  async function getGraph(useCache = true): Promise<GraphData> {
    return await fetchFile<GraphData>("graph", useCache);
  }

  /**
   * Get the content of a file by path
   * @param path - File path
   * @param useCache - Whether to use cache
   * @returns File content or null
   * @throws If path parameter is missing or invalid
   */
  async function getFileContent(path: string, useCache = true): Promise<FileContent | null> {
    // Validate path parameter
    if (!path) {
      throw new Error('Path is required for getFileContent operation');
    }

    if (typeof path !== 'string') {
      throw new Error('Path must be a string value');
    }

    if (debug) {
      console.log(`${prefix} 📡 Fetching file content: ${path}`);
    }

    return await fetchR2Json<FileContent | null>(`/files/${path}`, {
      defaultValue: null,
      useCache,
    });
  }

  return {
    getSourceFilesList,
    getDistFilesList,
    getGraph,
    getFileContent,
  };
}

