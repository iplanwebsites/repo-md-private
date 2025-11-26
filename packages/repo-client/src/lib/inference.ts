/**
 * Inference module for RepoMD
 * Handles embedding computations using various models
 */

import { fetchJson } from "./utils.js";

const API_DOMAIN = "api.repo.md";
const API_BASE = `https://${API_DOMAIN}/v1`;

/** Options for fetch operations */
export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  errorMessage?: string;
  useCache?: boolean;
  returnErrorObject?: boolean;
}

/** Response from inference API with error handling */
interface InferenceApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/** Embedding response data */
export interface EmbeddingData {
  embedding: number[];
  model?: string;
  dimensions?: number;
}

/**
 * Fetch data from the inference API
 * @param path - API path
 * @param options - Fetch options (method, body, headers, etc.)
 * @param debug - Whether to log debug info
 * @returns Parsed response data
 */
async function fetchInferenceApi<T>(
  path = "/",
  options: FetchOptions = {},
  debug = false
): Promise<T> {
  const url = `${API_BASE}${path}`;

  try {
    const result = await fetchJson<InferenceApiResponse<T>>(
      url,
      {
        errorMessage: "Error fetching inference API route: " + path,
        useCache: false,
        returnErrorObject: true,
        ...options,
      },
      debug
    );

    if (result && result.success === false) {
      throw new Error(result.error || `Failed to fetch data from ${url}`);
    }

    if (result === null || result === undefined) {
      throw new Error(
        `Failed to fetch data from ${url} - please verify your request`
      );
    }

    return result.data as T;
  } catch (error) {
    const errorMsg = `Inference API Request Failed: ${(error as Error).message}`;

    if (debug) {
      console.error(`❌ ${errorMsg}`);
      console.error(`🔍 Failed URL: ${url}`);
    }

    throw new Error(`Failed to access inference API: ${(error as Error).message}`);
  }
}

/** Text embedding request payload */
interface TextEmbeddingPayload {
  text: string;
  instruction?: string;
}

/** Text embedding response */
interface TextEmbeddingResponse {
  success: boolean;
  message?: string;
  data: EmbeddingData;
}

/**
 * Compute text embedding from the inference API
 * @param text - Text to compute embedding for
 * @param instruction - Optional instruction for the embedding
 * @param debug - Whether to log debug info
 * @returns Embedding response with metadata
 */
export async function computeTextEmbedding(
  text: string,
  instruction: string | null = null,
  debug = false
): Promise<EmbeddingData> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text parameter is required and must be a non-empty string');
  }

  const payload: TextEmbeddingPayload = { text };
  if (instruction) {
    payload.instruction = instruction;
  }

  const response = await fetchInferenceApi<TextEmbeddingResponse>('/inference/text-embedding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, debug);

  if (!response.success) {
    throw new Error(response.message || 'Failed to compute text embedding');
  }

  return response.data;
}

/** CLIP embedding response */
interface ClipEmbeddingResponse {
  success: boolean;
  message?: string;
  data: EmbeddingData;
}

/**
 * Compute CLIP text embedding from the inference API
 * @param text - Text to compute CLIP embedding for
 * @param debug - Whether to log debug info
 * @returns CLIP embedding response with metadata
 */
export async function computeClipTextEmbedding(
  text: string,
  debug = false
): Promise<EmbeddingData> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text parameter is required and must be a non-empty string');
  }

  const response = await fetchInferenceApi<ClipEmbeddingResponse>('/inference/clip-by-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }, debug);

  if (!response.success) {
    throw new Error(response.message || 'Failed to compute CLIP text embedding');
  }

  return response.data;
}

/** CLIP image request payload */
interface ClipImagePayload {
  imageUrl?: string;
  imageData?: string;
}

/**
 * Compute CLIP image embedding from the inference API
 * @param image - Image input as either a URL or base64-encoded data string
 * @param debug - Whether to log debug info
 * @returns CLIP image embedding response with metadata
 */
export async function computeClipImageEmbedding(
  image: string,
  debug = false
): Promise<EmbeddingData> {
  if (!image || typeof image !== 'string' || image.trim().length === 0) {
    throw new Error('Image parameter is required and must be a non-empty string');
  }

  const isUrl = image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:');

  const payload: ClipImagePayload = isUrl ? { imageUrl: image } : { imageData: image };

  const response = await fetchInferenceApi<ClipEmbeddingResponse>('/inference/clip-by-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, debug);

  if (!response.success) {
    throw new Error(response.message || 'Failed to compute CLIP image embedding');
  }

  return response.data;
}
