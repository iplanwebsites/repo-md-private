import { z, type ZodTypeAny, ZodError } from 'zod';

/** Zod issue type for error handling */
interface ZodIssueLocal {
  path: (string | number)[];
  message: string;
}

/** Schema type with parse method */
interface ZodSchemaWithParse {
  parse(data: unknown): unknown;
}
import { schemas, type SchemaWithMeta } from './schemas.js';

// Type definitions for Zod internals
interface ZodDef {
  typeName?: string;
  shape?: () => Record<string, ZodTypeAny>;
  schema?: ZodTypeAny;
  innerType?: ZodTypeAny;
  values?: string[];
  defaultValue?: () => unknown;
}

/** Get the internal definition from a Zod type */
function getZodDef(zodType: ZodTypeAny): ZodDef {
  return (zodType as unknown as { _def: ZodDef })._def;
}

/** Parameter metadata interface */
export interface ParamMetadata {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

/** Validation result interface */
export interface ValidationResult<T = Record<string, unknown>> {
  success: boolean;
  data: T;
  error?: string;
}

/** Method description interface */
export interface MethodDescription {
  name: string;
  description: string;
  parameters: ParamMetadata[];
  category: string;
}

/**
 * Extract parameter metadata from schema using schema introspection
 * @param schema - The Zod schema to extract metadata from
 * @returns Array of parameter metadata objects
 */
export function extractParamMetadata(schema: ZodTypeAny): ParamMetadata[] {
  // Handle ZodEffects (schemas with refine, transform, etc.)
  let actualSchema = schema;
  const schemaDef = getZodDef(schema);
  if (schemaDef.typeName === 'ZodEffects' && schemaDef.schema) {
    actualSchema = schemaDef.schema;
  }

  // Make sure we have a shape function
  const actualDef = getZodDef(actualSchema);
  if (!actualDef.shape || typeof actualDef.shape !== 'function') {
    console.warn('Schema does not have a valid shape function:', actualSchema);
    return [];
  }

  const shape = actualDef.shape();
  const metadata: ParamMetadata[] = [];

  for (const [name, zodType] of Object.entries(shape)) {
    let type = 'unknown';
    let required = true;
    let defaultValue: unknown = undefined;
    let description = (zodType as ZodTypeAny & { description?: string }).description || '';

    const def = getZodDef(zodType);
    const typeName = def.typeName || '';

    // Determine parameter type and if it's required
    if (typeName === 'ZodString') {
      type = 'string';
    } else if (typeName === 'ZodNumber') {
      type = 'number';
    } else if (typeName === 'ZodBoolean') {
      type = 'boolean';
    } else if (typeName === 'ZodArray') {
      type = 'array';
    } else if (typeName === 'ZodObject') {
      type = 'object';
    } else if (typeName === 'ZodEnum') {
      type = `enum (${(def.values || []).join(', ')})`;
    } else if (typeName === 'ZodNullable' && def.innerType) {
      type = `${getZodTypeName(def.innerType)} | null`;
    }

    // Check if optional or has default
    if (typeName === 'ZodOptional' || typeName === 'ZodDefault') {
      required = false;

      // Get inner type for optional/default fields
      const innerType = def.innerType || zodType;

      // Extract description from inner type if available
      if ((innerType as ZodTypeAny & { description?: string }).description) {
        description = (innerType as ZodTypeAny & { description?: string }).description || '';
      }

      // Get default value if available
      if (typeName === 'ZodDefault') {
        const defaultFn = def.defaultValue;
        if (defaultFn !== undefined) {
          defaultValue = defaultFn();
        }
      } else {
        const innerDef = getZodDef(innerType);
        if (innerDef.defaultValue !== undefined) {
          defaultValue = innerDef.defaultValue();
        }
      }

      // Update type information for optional fields
      type = getZodTypeName(innerType);
    }

    // Add parameter metadata
    const paramMeta: ParamMetadata = {
      name,
      type,
      required,
    };

    if (defaultValue !== undefined) {
      paramMeta.default = defaultValue;
    }

    if (description) {
      paramMeta.description = description;
    }

    metadata.push(paramMeta);
  }

  return metadata;
}

/**
 * Helper to get the type name from a Zod type
 * @param zodType - The Zod type
 * @returns Type name string
 */
function getZodTypeName(zodType: ZodTypeAny): string {
  const def = getZodDef(zodType);
  const typeName = def.typeName || '';

  if (typeName === 'ZodString') return 'string';
  if (typeName === 'ZodNumber') return 'number';
  if (typeName === 'ZodBoolean') return 'boolean';
  if (typeName === 'ZodArray') return 'array';
  if (typeName === 'ZodObject') return 'object';
  if (typeName === 'ZodEnum') return `enum (${(def.values || []).join(', ')})`;
  if (typeName === 'ZodOptional' && def.innerType) return getZodTypeName(def.innerType);
  if (typeName === 'ZodDefault' && def.innerType) return getZodTypeName(def.innerType);
  if (typeName === 'ZodNullable' && def.innerType) return `${getZodTypeName(def.innerType)} | null`;
  if (typeName === 'ZodEffects' && def.schema) return getZodTypeName(def.schema);
  return 'unknown';
}

/** Function parameter metadata dictionary type */
export type FunctionParamMetadataDict = Record<string, ParamMetadata[]>;

/** Generated metadata for all function parameters */
export const functionParamMetadata: FunctionParamMetadataDict = {};

// Extract metadata for each function schema
for (const [funcName, schema] of Object.entries(schemas)) {
  functionParamMetadata[funcName] = extractParamMetadata(schema);
}

/**
 * Get method description from schema
 * @param functionName - The function name
 * @returns Method description or null
 */
export function getMethodDescription(functionName: string): MethodDescription | null {
  const schema = schemas[functionName];
  if (!schema) return null;

  return {
    name: functionName,
    description: (schema as ZodTypeAny & { description?: string }).description || '',
    parameters: extractParamMetadata(schema),
    category: inferCategoryFromName(functionName)
  };
}

/** All method descriptions dictionary type */
export type MethodDescriptions = Record<string, MethodDescription | null>;

/**
 * Get all method descriptions
 * @returns Dictionary of all method descriptions
 */
export function getAllMethodDescriptions(): MethodDescriptions {
  const descriptions: MethodDescriptions = {};
  for (const functionName of Object.keys(schemas)) {
    descriptions[functionName] = getMethodDescription(functionName);
  }
  return descriptions;
}

/** Category type */
export type CategoryName =
  | 'AI Inference'
  | 'Posts'
  | 'Media'
  | 'Similarity'
  | 'Files'
  | 'Project'
  | 'URLs'
  | 'API'
  | 'OpenAI'
  | 'Utility';

/**
 * Helper function to infer category from function name
 * @param functionName - The function name
 * @returns Inferred category
 */
function inferCategoryFromName(functionName: string): CategoryName {
  // Check AI Inference first before general Embedding check
  if (functionName.includes('computeTextEmbedding') || functionName.includes('computeClipTextEmbedding') || functionName.includes('computeClipImageEmbedding')) return 'AI Inference';
  if (functionName.includes('Post') || functionName.includes('posts')) return 'Posts';
  if (functionName.includes('Media') || functionName.includes('media')) return 'Media';
  if (functionName.includes('Similar') || functionName.includes('Embedding')) return 'Similarity';
  if (functionName.includes('File') || functionName.includes('Graph')) return 'Files';
  if (functionName.includes('Project') || functionName.includes('Release')) return 'Project';
  if (functionName.includes('R2') || functionName.includes('Url') || functionName.includes('Sqlite')) return 'URLs';
  if (functionName.includes('Api') || functionName.includes('fetch')) return 'API';
  if (functionName.includes('OpenAi')) return 'OpenAI';
  return 'Utility';
}

/**
 * Validate function parameters against their schema
 * @param functionName - The function name
 * @param params - The parameters to validate
 * @returns Validation result
 */
export function validateFunctionParams<T = Record<string, unknown>>(
  functionName: string,
  params: unknown
): ValidationResult<T> {
  if (!schemas[functionName]) {
    return {
      success: false,
      data: {} as T,
      error: `Schema not found for function: ${String(functionName)}`
    };
  }

  try {
    const schema = schemas[functionName] as unknown as ZodSchemaWithParse;
    const validatedData = schema.parse(params) as T;
    return { success: true, data: validatedData };
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const errorMessages = (error.errors as ZodIssueLocal[]).map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, data: {} as T, error: errorMessages };
    }
    return { success: false, data: {} as T, error: 'Validation error: ' + String(error) };
  }
}
